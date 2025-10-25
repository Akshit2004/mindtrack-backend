require('dotenv').config();
const express = require('express');
const admin = require('firebase-admin');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const rawServiceAccountPath = process.env.SERVICE_ACCOUNT_PATH || path.join('..', 'serviceAccountKey.json');

let serviceAccount;
let lastError = null;

if (process.env.SERVICE_ACCOUNT_JSON) {
  try {
    serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_JSON);
    console.log('Loaded service account from SERVICE_ACCOUNT_JSON environment variable');
  } catch (err) {
    lastError = err;
    console.error('Failed to parse SERVICE_ACCOUNT_JSON:', err.message);
  }
}

if (!serviceAccount) {
  const candidatePaths = [];

  if (rawServiceAccountPath) {
    if (path.isAbsolute(rawServiceAccountPath)) {
      candidatePaths.push(rawServiceAccountPath);
    } else {
      candidatePaths.push(path.resolve(__dirname, rawServiceAccountPath));
      candidatePaths.push(path.resolve(__dirname, '..', rawServiceAccountPath));
      candidatePaths.push(path.resolve(process.cwd(), rawServiceAccountPath));
    }
  }

  candidatePaths.push(path.resolve(__dirname, '..', 'serviceAccountKey.json'));
  candidatePaths.push(path.resolve(__dirname, 'serviceAccountKey.json'));

  for (const p of candidatePaths) {
    try {
      serviceAccount = require(p);
      if (serviceAccount) {
        console.log('Loaded service account from', p);
        break;
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (!serviceAccount) {
    console.error('Failed to load service account. Attempted paths:');
    candidatePaths.forEach(p => console.error(' -', p));
    if (lastError && lastError.message) console.error('Last error:', lastError.message);
    console.error('Set SERVICE_ACCOUNT_JSON (preferred) or SERVICE_ACCOUNT_PATH to resolve this.');
    process.exit(1);
  }
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.post('/verifyToken', async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: 'idToken is required in body' });

  try {
    const decoded = await admin.verifyIdToken(idToken);
    return res.json({ uid: decoded.uid, email: decoded.email, decoded });
  } catch (err) {
    console.error('Token verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token', details: err.message });
  }
});

app.post('/api/v1/auth/register', async (req, res) => {
  const { email, password, displayName } = req.body || {}

    let userRecord = null
    try {
      userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: displayName || undefined,
      })

      const customToken = await admin.auth().createCustomToken(userRecord.uid)

      const user = {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName || null,
      }

      try {
        await db.collection('users').doc(userRecord.uid).set({
          uid: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName || null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        })
      } catch (fireErr) {
        console.error('Failed to write user to Firestore:', fireErr.message)
      }

      return res.status(201).json({ token: customToken, user })
    } catch (err) {
      console.error('Register error:', err)

      if (process.env.NODE_ENV === 'development') {
        if (userRecord) {
          return res.status(201).json({ token: `dev-token-${userRecord.uid}`, user: {
            uid: userRecord.uid,
            email: userRecord.email,
            displayName: userRecord.displayName || null,
          }})
        }
        return res.status(201).json({ token: 'dev-token-local', user: { uid: 'local-dev', email } })
      }

      if (err.code === 'auth/email-already-exists') {
        return res.status(409).json({ error: 'Email already in use' })
      }

      return res.status(500).json({ error: 'Failed to create user', details: err.message })
    }
})

const _habits = []
const _checkins = []

function makeId(prefix = '') {
  return `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`
}
 

app.post('/api/v1/auth/login', async (req, res) => {
  const { email } = req.body || {}
  if (!email) return res.status(400).json({ error: 'email is required' })

  try {
    const userRecord = await admin.auth().getUserByEmail(email)
    const customToken = await admin.auth().createCustomToken(userRecord.uid)

    const user = {
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName || null,
    }

    try {
      const docRef = db.collection('users').doc(userRecord.uid)
      const doc = await docRef.get()
      if (!doc.exists) {
        await docRef.set({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        })
      }
    } catch (fireErr) {
      console.error('Failed to ensure user in Firestore during login:', fireErr.message)
    }

    return res.json({ token: customToken, user })
  } catch (err) {
    console.error('Login error:', err.message)
    return res.status(401).json({ error: 'User not found' })
  }
})

app.get('/api/v1/habits', async (req, res) => {
  const { userId, uid } = req.query || {}
  const qUserId = userId || uid

  try {
    const col = db.collection('habits')
    let items = []

    if (qUserId) {
      const [byUserIdSnap, byUidSnap] = await Promise.all([
        col.where('userId', '==', qUserId).get().catch(() => null),
        col.where('uid', '==', qUserId).get().catch(() => null),
      ])

      const collect = (snap) => {
        if (!snap) return []
        return snap.docs.map((d) => {
          const data = d.data()
          if (data && data.createdAt && data.createdAt.toDate) {
            data.createdAt = data.createdAt.toDate().toISOString()
          }
          return { id: d.id, ...data }
        })
      }

      const merged = [...collect(byUserIdSnap), ...collect(byUidSnap)]
      const map = new Map()
      for (const it of merged) map.set(it.id, it)
      items = Array.from(map.values())
  items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    } else {
      const snap = await col.orderBy('createdAt', 'desc').get()
      items = snap.docs.map((d) => {
        const data = d.data()
        if (data && data.createdAt && data.createdAt.toDate) {
          data.createdAt = data.createdAt.toDate().toISOString()
        }
        return { id: d.id, ...data }
      })
    }

    return res.json(items)
  } catch (err) {
    if (qUserId) {
      return res.json(_habits.filter(h => h.userId === qUserId || h.uid === qUserId))
    }
    return res.json(_habits)
  }
})

app.post('/api/v1/habits', async (req, res) => {
  const data = req.body || {}
  const habit = {
    title: data.title || 'Untitled Habit',
    description: data.description || null,
    createdAt: new Date().toISOString(),
    archived: false,
    frequency: data.frequency || 'daily',
    emoji: data.emoji || '✅',
    is_completed: !!data.is_completed,
    userId: data.userId || data.uid || null,
    uid: data.uid || data.userId || null,
    ...data,
  }

  try {
    const id = makeId('h_')
    await db.collection('habits').doc(id).set({ ...habit, createdAt: admin.firestore.Timestamp.fromDate(new Date(habit.createdAt)) })
    return res.status(201).json({ id, ...habit })
  } catch (err) {
    const fallback = { id: makeId('h_'), ...habit }
    _habits.push(fallback)
    return res.status(201).json(fallback)
  }
})

app.patch('/api/v1/habits/:id', async (req, res) => {
  const { id } = req.params
  const updates = req.body || {}
  try {
    const docRef = db.collection('habits').doc(id)
    const doc = await docRef.get()
    if (!doc.exists) throw new Error('not-found')
    await docRef.update({ ...updates })
    const updatedDoc = (await docRef.get()).data()
    if (updatedDoc && updatedDoc.createdAt && updatedDoc.createdAt.toDate) {
      updatedDoc.createdAt = updatedDoc.createdAt.toDate().toISOString()
    }
    return res.json({ id, ...updatedDoc })
  } catch (err) {
    const idx = _habits.findIndex(h => h.id === id)
    if (idx === -1) return res.status(404).json({ error: 'Habit not found' })
    _habits[idx] = { ..._habits[idx], ...updates }
    return res.json(_habits[idx])
  }
})

app.delete('/api/v1/habits/:id', async (req, res) => {
  const { id } = req.params
  try {
    const docRef = db.collection('habits').doc(id)
    const doc = await docRef.get()
    if (!doc.exists) throw new Error('not-found')
    await docRef.delete()
    return res.json({ success: true })
  } catch (err) {
    const idx = _habits.findIndex(h => h.id === id)
    if (idx === -1) return res.status(404).json({ error: 'Habit not found' })
    const [removed] = _habits.splice(idx, 1)
    return res.json({ success: true, habit: removed })
  }
})

app.post('/api/v1/habits/:habitId/checkins', async (req, res) => {
  const { habitId } = req.params
  
  try {
    const habitDoc = await db.collection('habits').doc(habitId).get()
    if (!habitDoc.exists) {
      const habit = _habits.find(h => h.id === habitId)
      if (!habit) return res.status(404).json({ error: 'Habit not found' })
    }
  } catch (err) {
    const habit = _habits.find(h => h.id === habitId)
    if (!habit) return res.status(404).json({ error: 'Habit not found' })
  }

  const payload = req.body || {}
  const checkin = {
    id: makeId('c_'),
    habitId,
    date: payload.date || new Date().toISOString().slice(0,10),
    notes: payload.notes || null,
    createdAt: new Date().toISOString(),
  }
  _checkins.push(checkin)
  return res.status(201).json(checkin)
})

app.get('/api/v1/checkins', (req, res) => {
  const { from, to, habitId } = req.query
  let results = _checkins.slice()
  if (habitId) results = results.filter(c => c.habitId === habitId)
  if (from) results = results.filter(c => c.date >= from)
  if (to) results = results.filter(c => c.date <= to)
  return res.json(results)
})

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Backend listening on port ${PORT}`));
}
