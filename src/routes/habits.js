import { Router } from 'express'
import { getDb } from '../config/firebase.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// All routes require authentication
router.use(authMiddleware)

// GET /api/v1/habits - Get all user's habits
router.get('/', async (req, res) => {
  try {
    const db = getDb()
    const habitsRef = db.collection('habits')

    // Minimize Firestore index requirements: query only by userId, then filter/sort in memory
    const snapshot = await habitsRef
      .where('userId', '==', req.user.id)
      .get()

    const habits = []
    snapshot.forEach(doc => {
      habits.push({ id: doc.id, ...doc.data() })
    })

    // Filter active and sort by createdAt desc in memory to avoid composite index requirements
    const filtered = habits
      .filter(h => h.active !== false) // treat missing "active" as true
      .sort((a, b) => {
        const aTime = new Date(a.createdAt || 0).getTime()
        const bTime = new Date(b.createdAt || 0).getTime()
        return bTime - aTime
      })

    res.json(filtered)
  } catch (error) {
    console.error('Get habits error:', error)
    res.status(500).json({ error: 'Failed to fetch habits' })
  }
})

// POST /api/v1/habits - Create new habit
router.post('/', async (req, res) => {
  try {
    const { title, description, frequency, target, emoji, color, is_completed } = req.body

    if (!title) {
      return res.status(400).json({ error: 'Title is required' })
    }

    const db = getDb()
    const habitData = {
      userId: req.user.id,
      title,
      description: description || '',
      frequency: frequency || 'daily',
      target: target || 1,
      emoji: emoji || '✅',
      color: color || '#4F46E5',
      active: true,
      // Mark completion state; default to false when not provided
      is_completed: typeof is_completed === 'boolean' ? is_completed : false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const habitDoc = await db.collection('habits').add(habitData)

    res.status(201).json({
      id: habitDoc.id,
      ...habitData,
    })
  } catch (error) {
    console.error('Create habit error:', error)
    res.status(500).json({ error: 'Failed to create habit' })
  }
})

// PATCH /api/v1/habits/:id - Update habit
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body

    const db = getDb()
    const habitRef = db.collection('habits').doc(id)
    const habitDoc = await habitRef.get()

    if (!habitDoc.exists) {
      return res.status(404).json({ error: 'Habit not found' })
    }

    const habitData = habitDoc.data()

    // Check ownership
    if (habitData.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    // Update allowed fields
    const allowedFields = ['title', 'description', 'frequency', 'target', 'emoji', 'color', 'active', 'is_completed']
    const updateData = {}
    
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field]
      }
    })

    updateData.updatedAt = new Date().toISOString()

    await habitRef.update(updateData)

    res.json({
      id,
      ...habitData,
      ...updateData,
    })
  } catch (error) {
    console.error('Update habit error:', error)
    res.status(500).json({ error: 'Failed to update habit' })
  }
})

// DELETE /api/v1/habits/:id - Soft delete habit
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const db = getDb()
    const habitRef = db.collection('habits').doc(id)
    const habitDoc = await habitRef.get()

    if (!habitDoc.exists) {
      return res.status(404).json({ error: 'Habit not found' })
    }

    const habitData = habitDoc.data()

    // Check ownership
    if (habitData.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    // Soft delete
    await habitRef.update({
      active: false,
      updatedAt: new Date().toISOString(),
    })

    res.status(204).send()
  } catch (error) {
    console.error('Delete habit error:', error)
    res.status(500).json({ error: 'Failed to delete habit' })
  }
})

export default router
