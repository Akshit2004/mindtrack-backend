require('dotenv').config();
const express = require('express');
const admin = require('firebase-admin');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Load service account - try several candidate locations for resilience.
// Default expectation: serviceAccountKey.json at repo root (one level up)
const rawServiceAccountPath = process.env.SERVICE_ACCOUNT_PATH || path.join('..', 'serviceAccountKey.json');

// Build a list of candidate absolute paths to try (in order).
const candidatePaths = [];

// If the user provided an absolute-looking path, try it as-is first.
if (rawServiceAccountPath) {
  // If it starts with a slash on Windows someone may have meant a relative path; still attempt a few resolutions.
  if (path.isAbsolute(rawServiceAccountPath)) {
    candidatePaths.push(rawServiceAccountPath);
  } else {
    // Resolve relative to backend directory
    candidatePaths.push(path.resolve(__dirname, rawServiceAccountPath));
    // Resolve relative to repo root (one level up from backend)
    candidatePaths.push(path.resolve(__dirname, '..', rawServiceAccountPath));
    // Resolve relative to current working directory
    candidatePaths.push(path.resolve(process.cwd(), rawServiceAccountPath));
  }
}

// Also always try the common default: one level up from backend
candidatePaths.push(path.resolve(__dirname, '..', 'serviceAccountKey.json'));
candidatePaths.push(path.resolve(__dirname, 'serviceAccountKey.json'));

let serviceAccount;
let lastError = null;
for (const p of candidatePaths) {
  try {
    // Use require so JSON is parsed; attempt the path if file exists-ish
    serviceAccount = require(p);
    if (serviceAccount) {
      console.log('Loaded service account from', p);
      break;
    }
  } catch (err) {
    lastError = err;
    // continue to next candidate
  }
}

if (!serviceAccount) {
  console.error('Failed to load service account. Attempted paths:');
  candidatePaths.forEach(p => console.error(' -', p));
  if (lastError && lastError.message) console.error('Last error:', lastError.message);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// POST /verifyToken
// Body: { idToken: string }
// Verifies Firebase ID token and returns decoded token + basic user info
app.post('/verifyToken', async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: 'idToken is required in body' });

  try {
    const decoded = await admin.verifyIdToken(idToken);
    // Return a minimal safe subset
    return res.json({ uid: decoded.uid, email: decoded.email, decoded });
  } catch (err) {
    console.error('Token verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token', details: err.message });
  }
});

// Register route expected by the frontend: POST /api/v1/auth/register
// Body: { email, password, displayName, timezone }
app.post('/api/v1/auth/register', async (req, res) => {
  const { email, password, displayName } = req.body || {}

    let userRecord = null
    try {
      // Create the user in Firebase Auth
      userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: displayName || undefined,
      })

      // Create a custom token for the user. Note: custom tokens should be
      // exchanged by the client for an ID token using the Firebase client SDK.
      // For the frontend flow in this project we return the custom token so
      // the client can store something and proceed. Adjust as needed later.
      const customToken = await admin.auth().createCustomToken(userRecord.uid)

      const user = {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName || null,
      }

      // Persist basic user profile in Firestore so we can link habits to a user
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

      // If running locally in development, provide a lightweight fallback so
      // the frontend can continue during local testing while the Firebase
      // credential issue is resolved. This returns a harmless dev token and
      // the created user info (if available).
      if (process.env.NODE_ENV === 'development') {
        if (userRecord) {
          return res.status(201).json({ token: `dev-token-${userRecord.uid}`, user: {
            uid: userRecord.uid,
            email: userRecord.email,
            displayName: userRecord.displayName || null,
          }})
        }
        // If userRecord isn't available (createUser failed), return a dev stub
        return res.status(201).json({ token: 'dev-token-local', user: { uid: 'local-dev', email } })
      }

      // Handle common Firebase errors with friendly status codes
      if (err.code === 'auth/email-already-exists') {
        return res.status(409).json({ error: 'Email already in use' })
      }

      // Otherwise return a helpful error to the client so the frontend can
      // surface a useful message instead of a generic "Failed to create user".
      return res.status(500).json({ error: 'Failed to create user', details: err.message })
    }
})

// --- Simple in-memory storage for development/testing ---
// This is intentionally lightweight. For production use a real DB.
const _habits = []
const _checkins = []

// Helpers
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

    // Ensure user doc exists in Firestore
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

// GET /api/v1/habits
app.get('/api/v1/habits', async (req, res) => {
  const { userId } = req.query || {}

  // If Firestore is available, prefer persisted habits
  try {
    const col = db.collection('habits')
    let query = col
    if (userId) query = query.where('userId', '==', userId)

    const snap = await query.orderBy('createdAt', 'desc').get()
    const items = snap.docs.map((d) => {
      const data = d.data()
      // normalize Firestore Timestamp to ISO string for frontend convenience
      if (data && data.createdAt && data.createdAt.toDate) {
        data.createdAt = data.createdAt.toDate().toISOString()
      }
      return { id: d.id, ...data }
    })
    return res.json(items)
  } catch (err) {
    // Fallback to in-memory storage
    if (userId) {
      return res.json(_habits.filter(h => h.userId === userId))
    }
    return res.json(_habits)
  }
})

// POST /api/v1/habits
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
    userId: data.userId || null,
    // include any other fields
    ...data,
  }

  try {
    const id = makeId('h_')
    await db.collection('habits').doc(id).set({ ...habit, createdAt: admin.firestore.Timestamp.fromDate(new Date(habit.createdAt)) })
    return res.status(201).json({ id, ...habit })
  } catch (err) {
    // fallback to in-memory
    const fallback = { id: makeId('h_'), ...habit }
    _habits.push(fallback)
    return res.status(201).json(fallback)
  }
})

// PATCH /api/v1/habits/:id
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
    // fallback to in-memory
    const idx = _habits.findIndex(h => h.id === id)
    if (idx === -1) return res.status(404).json({ error: 'Habit not found' })
    _habits[idx] = { ..._habits[idx], ...updates }
    return res.json(_habits[idx])
  }
})

// DELETE /api/v1/habits/:id
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

// POST /api/v1/habits/:habitId/checkins
app.post('/api/v1/habits/:habitId/checkins', async (req, res) => {
  const { habitId } = req.params
  
  // Check if habit exists in Firestore first, fallback to in-memory
  try {
    const habitDoc = await db.collection('habits').doc(habitId).get()
    if (!habitDoc.exists) {
      // fallback check in-memory
      const habit = _habits.find(h => h.id === habitId)
      if (!habit) return res.status(404).json({ error: 'Habit not found' })
    }
  } catch (err) {
    // Firestore error, check in-memory
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

// GET /api/v1/checkins?from=YYYY-MM-DD&to=YYYY-MM-DD&habitId=
app.get('/api/v1/checkins', (req, res) => {
  const { from, to, habitId } = req.query
  let results = _checkins.slice()
  if (habitId) results = results.filter(c => c.habitId === habitId)
  if (from) results = results.filter(c => c.date >= from)
  if (to) results = results.filter(c => c.date <= to)
  return res.json(results)
})

// Force the backend to always listen on port 5000 per project requirement.
const PORT = 5000;
app.listen(PORT, () => console.log(`Backend listening on port ${PORT}`));
