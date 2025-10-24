import { Router } from 'express'
import apiRoutes from './api.js'

const router = Router()

// Legacy hello route for testing
router.get('/hello', (_req, res) => {
  res.json({ message: 'Hello from MindTrack backend' })
})

// Mount API routes
router.use('/', apiRoutes)

export default router
