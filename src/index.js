import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import { initializeFirebase } from './config/firebase.js'
import apiRouter from './routes/index.js'

const app = express()

const PORT = process.env.PORT || 5000
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

// Initialize Firebase (don't crash server if credentials missing)
initializeFirebase().catch((error) => {
  console.error('Failed to initialize Firebase:', error)
  console.error('Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_PROJECT_ID in backend/.env')
})

app.use(cors({ origin: CORS_ORIGIN, credentials: true }))
app.use(express.json())
app.use(morgan('dev'))

// Ensure Firebase is initialized before handling requests (avoids race conditions
// on cold starts in serverless environments)
app.use(async (_req, _res, next) => {
  try {
    await initializeFirebase()
    next()
  } catch (err) {
    next(err)
  }
})

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

// API routes
app.use('/api', apiRouter)

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path })
})

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal Server Error' })
})

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`)
})
