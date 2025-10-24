import { Router } from 'express'
import bcrypt from 'bcrypt'
import { getDb } from '../config/firebase.js'
import { signToken } from '../middleware/auth.js'

const router = Router()

// POST /api/v1/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, displayName, timezone } = req.body

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }

    const db = getDb()

    // Check if user exists
    const usersRef = db.collection('users')
    const existingUser = await usersRef.where('email', '==', email.toLowerCase()).get()

    if (!existingUser.empty) {
      return res.status(400).json({ error: 'Email already registered' })
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Create user
    const userData = {
      email: email.toLowerCase(),
      passwordHash,
      displayName: displayName || email.split('@')[0],
      timezone: timezone || 'UTC',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const userDoc = await usersRef.add(userData)

    // Generate token
    const token = signToken({
      userId: userDoc.id,
      email: userData.email,
    })

    // Return user (without password hash)
    const { passwordHash: _, ...userResponse } = userData

    res.status(201).json({
      token,
      user: {
        id: userDoc.id,
        ...userResponse,
      },
    })
  } catch (error) {
    console.error('Register error:', error)
    const isProd = process.env.NODE_ENV === 'production'
    res.status(500).json({
      error: isProd ? 'Registration failed' : `Registration failed: ${error.message}`,
    })
  }
})

// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const db = getDb()
    const usersRef = db.collection('users')
    const snapshot = await usersRef.where('email', '==', email.toLowerCase()).get()

    if (snapshot.empty) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const userDoc = snapshot.docs[0]
    const userData = userDoc.data()

    // Verify password
    const isValid = await bcrypt.compare(password, userData.passwordHash)

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    // Generate token
    const token = signToken({
      userId: userDoc.id,
      email: userData.email,
    })

    // Return user (without password hash)
    const { passwordHash: _, ...userResponse } = userData

    res.json({
      token,
      user: {
        id: userDoc.id,
        ...userResponse,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Login failed' })
  }
})

export default router
