import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import { initializeFirebase } from './config/firebase.js'
import apiRouter from './routes/index.js'

const app = express()

const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

// Support multiple origins (comma-separated) and wildcard "*"
const origins = CORS_ORIGIN.split(',').map((s) => s.trim())
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true) // allow non-browser tools
    if (origins.includes('*') || origins.includes(origin)) return callback(null, true)
    return callback(new Error('CORS not allowed from this origin'))
  },
  credentials: true,
}

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

app.use(cors(corsOptions))
app.use(express.json())
app.use(morgan('dev'))

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
  const isProd = process.env.NODE_ENV === 'production'
  res.status(500).json({ error: isProd ? 'Internal Server Error' : err.message })
})

export default app
