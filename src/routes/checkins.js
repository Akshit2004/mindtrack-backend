import { Router } from 'express'
import { getDb } from '../config/firebase.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// All routes require authentication
router.use(authMiddleware)

// POST /api/v1/habits/:id/checkins - Create check-in
router.post('/:habitId/checkins', async (req, res) => {
  try {
    const { habitId } = req.params
    const { checkedAt, quantity, note } = req.body

    const db = getDb()
    
    // Verify habit exists and belongs to user
    const habitRef = db.collection('habits').doc(habitId)
    const habitDoc = await habitRef.get()

    if (!habitDoc.exists) {
      return res.status(404).json({ error: 'Habit not found' })
    }

    const habitData = habitDoc.data()
    if (habitData.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const checkinData = {
      habitId,
      userId: req.user.id,
      checkedAt: checkedAt || new Date().toISOString(),
      quantity: quantity || 1,
      note: note || '',
      createdAt: new Date().toISOString(),
    }

    const checkinDoc = await db.collection('checkins').add(checkinData)

    res.status(201).json({
      id: checkinDoc.id,
      ...checkinData,
    })
  } catch (error) {
    console.error('Create checkin error:', error)
    res.status(500).json({ error: 'Failed to create check-in' })
  }
})

// GET /api/v1/checkins - Get check-ins with optional filters (no composite index required)
router.get('/', async (req, res) => {
  try {
    const { from, to, habitId } = req.query

    const db = getDb()

    // Query only by userId to avoid composite index requirements, then filter in memory
    const snapshot = await db
      .collection('checkins')
      .where('userId', '==', req.user.id)
      .get()

    const checkins = []
    snapshot.forEach(doc => {
      checkins.push({ id: doc.id, ...doc.data() })
    })

    const filtered = checkins
      .filter(c => (habitId ? c.habitId === habitId : true))
      .filter(c => {
        if (!from) return true
        // Extract date part from ISO timestamp for comparison (YYYY-MM-DD)
        const checkinDate = c.checkedAt.substring(0, 10)
        return checkinDate >= from
      })
      .filter(c => {
        if (!to) return true
        // Extract date part from ISO timestamp for comparison (YYYY-MM-DD)
        const checkinDate = c.checkedAt.substring(0, 10)
        return checkinDate <= to
      })
      .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime())

    res.json(filtered)
  } catch (error) {
    console.error('Get checkins error:', error)
    res.status(500).json({ error: 'Failed to fetch check-ins' })
  }
})

export default router
