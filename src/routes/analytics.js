import { Router } from 'express'
import { getDb } from '../config/firebase.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

router.use(authMiddleware)

// Helper function to calculate streaks
function calculateStreaks(checkinsByDate) {
  const dates = Object.keys(checkinsByDate).sort()
  
  if (dates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 }
  }

  let currentStreak = 0
  let longestStreak = 0
  let tempStreak = 0

  // Get today's date in user timezone
  const today = new Date().toISOString().split('T')[0]

  // Calculate longest streak
  for (let i = 0; i < dates.length; i++) {
    if (i === 0) {
      tempStreak = 1
    } else {
      const prevDate = new Date(dates[i - 1])
      const currDate = new Date(dates[i])
      const diffDays = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24))

      if (diffDays === 1) {
        tempStreak++
      } else {
        tempStreak = 1
      }
    }

    longestStreak = Math.max(longestStreak, tempStreak)
  }

  // Calculate current streak (backwards from today)
  const lastDate = dates[dates.length - 1]
  const daysSinceLastCheckin = Math.round(
    (new Date(today) - new Date(lastDate)) / (1000 * 60 * 60 * 24)
  )

  if (daysSinceLastCheckin <= 1) {
    // Still within streak window
    currentStreak = 1
    for (let i = dates.length - 2; i >= 0; i--) {
      const prevDate = new Date(dates[i])
      const currDate = new Date(dates[i + 1])
      const diffDays = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24))

      if (diffDays === 1) {
        currentStreak++
      } else {
        break
      }
    }
  }

  return { currentStreak, longestStreak }
}

// GET /api/v1/analytics/calendar - Get calendar data with streaks
router.get('/calendar', async (req, res) => {
  try {
    const { year, month } = req.query

    if (!year || !month) {
      return res.status(400).json({ error: 'Year and month are required' })
    }

    const startDate = new Date(year, month - 1, 1).toISOString()
    const endDate = new Date(year, month, 0, 23, 59, 59).toISOString()

    const db = getDb()

    // Get all user's habits then filter active in memory to avoid composite index requirements
    const habitsSnapshot = await db.collection('habits')
      .where('userId', '==', req.user.id)
      .get()

    const habitIds = []
    habitsSnapshot.forEach(doc => {
      const data = doc.data()
      if (data.active !== false) {
        habitIds.push(doc.id)
      }
    })

    if (habitIds.length === 0) {
      return res.json({ days: [], streaks: { currentStreak: 0, longestStreak: 0 } })
    }

    // Get check-ins for the user, then filter by date in memory to avoid composite index requirements
    const checkinsSnapshot = await db.collection('checkins')
      .where('userId', '==', req.user.id)
      .get()

    // Group by date
    const dateMap = {}
    const allCheckinsByDate = {}

    checkinsSnapshot.forEach(doc => {
      const data = doc.data()
      if (!data.checkedAt) return
      if (data.checkedAt < startDate || data.checkedAt > endDate) return
      const date = data.checkedAt.split('T')[0]
      
      if (!dateMap[date]) {
        dateMap[date] = {
          date,
          completedCount: 0,
          habitsCompleted: new Set(),
        }
      }

      dateMap[date].completedCount += data.quantity || 1
      dateMap[date].habitsCompleted.add(data.habitId)
      allCheckinsByDate[date] = true
    })

    // Convert to array
    const days = Object.values(dateMap).map(day => ({
      date: day.date,
      completedCount: day.completedCount,
      habitsCompleted: Array.from(day.habitsCompleted),
    }))

    // Calculate streaks
    const streaks = calculateStreaks(allCheckinsByDate)

    res.json({ days, streaks })
  } catch (error) {
    console.error('Calendar error:', error)
    res.status(500).json({ error: 'Failed to fetch calendar data' })
  }
})

// GET /api/v1/analytics/habit/:id/trends - Get habit trends
router.get('/habit/:id/trends', async (req, res) => {
  try {
    const { id } = req.params
    const { range } = req.query
    
    const days = parseInt(range) || 30

    const db = getDb()

    // Verify habit ownership
    const habitRef = db.collection('habits').doc(id)
    const habitDoc = await habitRef.get()

    if (!habitDoc.exists) {
      return res.status(404).json({ error: 'Habit not found' })
    }

    const habitData = habitDoc.data()
    if (habitData.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    // Get check-ins for the range
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Query by habitId only and filter/sort in memory to avoid composite index requirements
    const checkinsSnapshot = await db.collection('checkins')
      .where('habitId', '==', id)
      .get()

    const checkinsByDate = {}
    const last30Days = []

    // Filter by date range and sort ascending by checkedAt
    const filteredSorted = checkinsSnapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(d => d.checkedAt && new Date(d.checkedAt) >= startDate)
      .sort((a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime())

    filteredSorted.forEach(data => {
      const date = data.checkedAt.split('T')[0]
      
      if (!checkinsByDate[date]) {
        checkinsByDate[date] = {
          date,
          count: 0,
          quantity: 0,
        }
      }

      checkinsByDate[date].count++
      checkinsByDate[date].quantity += data.quantity || 1

      last30Days.push({
        date: data.checkedAt,
        quantity: data.quantity || 1,
        note: data.note,
      })
    })

    // Calculate weekly average
    const totalQuantity = Object.values(checkinsByDate).reduce((sum, day) => sum + day.quantity, 0)
    const weeklyAverage = (totalQuantity / days) * 7

    // Calculate streaks
    const streaks = calculateStreaks(checkinsByDate)

    res.json({
      weeklyAverage: Math.round(weeklyAverage * 10) / 10,
      currentStreak: streaks.currentStreak,
      longestStreak: streaks.longestStreak,
      last30Days,
      completionRate: (Object.keys(checkinsByDate).length / days * 100).toFixed(1),
    })
  } catch (error) {
    console.error('Trends error:', error)
    res.status(500).json({ error: 'Failed to fetch trends' })
  }
})

export default router
