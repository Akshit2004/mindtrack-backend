import admin from 'firebase-admin'
import { readFile } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'

let db = null

export async function initializeFirebase() {
  // If we've already created a Firestore instance, reuse it
  if (db) return db

  // If the admin SDK is already initialized (e.g., from a previous cold start),
  // just grab a new Firestore instance and return.
  // This is important on serverless platforms where module state may persist.
  if (admin.apps && admin.apps.length > 0) {
    db = admin.firestore()
    return db
  }

  // For local development, you can use the Firebase emulator
  // or provide a service account key path via FIREBASE_SERVICE_ACCOUNT_PATH env var
  
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    // Production: use service account key (support absolute/relative file paths)
    const rawPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH.trim()

    // If env contains inline JSON (rare), parse directly
    let serviceAccountObject = null
    if (rawPath.startsWith('{') && rawPath.endsWith('}')) {
      serviceAccountObject = JSON.parse(rawPath)
    } else {
      const absPath = isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath)
      const fileJson = await readFile(absPath, 'utf8')
      serviceAccountObject = JSON.parse(fileJson)
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountObject),
    })
  } else if (process.env.FIREBASE_PROJECT_ID) {
    // Use Application Default Credentials (for GCP deployment)
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID,
    })
  } else {
    // Development fallback: initialize without credentials
    // This will work if you're using Firebase emulator
    console.warn('⚠️  No Firebase credentials provided. Using default initialization.')
    console.warn('   Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_PROJECT_ID in .env')
    admin.initializeApp()
  }

  db = admin.firestore()
  console.log('✅ Firebase initialized')
  return db
}

export function getDb() {
  // If db is not set but admin is initialized (serverless warm start), use it
  if (!db) {
    if (admin.apps && admin.apps.length > 0) {
      db = admin.firestore()
    } else {
      throw new Error('Firebase not initialized. Call initializeFirebase() first.')
    }
  }
  return db
}

export { admin }
