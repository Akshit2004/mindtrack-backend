import { Router } from 'express'
import authRoutes from './auth.js'
import habitsRoutes from './habits.js'
import checkinsRoutes from './checkins.js'
import analyticsRoutes from './analytics.js'

const router = Router()

// API v1 routes
router.use('/v1/auth', authRoutes)
router.use('/v1/habits', habitsRoutes)
router.use('/v1/habits', checkinsRoutes) // Mount checkins under habits for nested routes
router.use('/v1/checkins', checkinsRoutes) // Also available at top level
router.use('/v1/analytics', analyticsRoutes)

export default router
