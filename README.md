# MindTrack Backend

Express.js backend API for MindTrack that handles Firebase authentication, habit management, check-ins, and AI-powered personalized quotes.

This backend provides RESTful API endpoints for the MindTrack frontend application, with Firebase Admin SDK integration for secure user authentication and Firestore for data persistence.

---

## Table of Contents

1. [About](#about)
2. [Features](#features)
3. [Tech Stack](#tech-stack)
4. [Prerequisites](#prerequisites)
5. [Getting Started](#getting-started)
6. [Environment Variables](#environment-variables)
7. [API Endpoints](#api-endpoints)
8. [Project Structure](#project-structure)
9. [Authentication Flow](#authentication-flow)
10. [Database Schema](#database-schema)
11. [Error Handling](#error-handling)
12. [Testing](#testing)
13. [Deployment](#deployment)
14. [Troubleshooting](#troubleshooting)
15. [Contributing](#contributing)

---

## About

The MindTrack backend is an Express.js server that provides:
- Secure user authentication via Firebase Auth
- CRUD operations for habits
- Daily check-in tracking and management
- Streak calculation and calendar data
- Personalized AI quote generation data
- RESTful API for frontend consumption

Built with scalability and security in mind, this backend handles all business logic and data persistence for the MindTrack wellness tracking application.

---

## Features

### Current Features
- **Firebase Authentication**: Secure token verification and user management
- **Habit Management**: Create, read, update, and delete user habits
- **Check-in System**: Record and retrieve daily habit completions
- **Calendar Data**: Aggregate check-ins for calendar heatmap visualization
- **Streak Calculation**: Compute current and longest streaks for habits
- **CORS Support**: Configured for frontend integration
- **Environment Configuration**: Flexible service account setup
- **Health Checks**: Monitoring endpoint for uptime verification

### Planned Features
- Analytics endpoints with trend analysis
- Push notifications and reminders
- Social features (friends, sharing)
- Rate limiting and request throttling
- Redis caching for improved performance

---

## Tech Stack

- **Runtime**: Node.js 18-20
- **Framework**: [Express](https://expressjs.com/) 4.18.2
- **Authentication**: [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup) 11.10.0
- **Database**: Firebase Firestore (NoSQL)
- **CORS**: [cors](https://www.npmjs.com/package/cors) 2.8.5
- **Environment**: [dotenv](https://www.npmjs.com/package/dotenv) 16.0.0
- **Dev Tools**: [nodemon](https://nodemon.io/) 2.0.22 (for hot reload)

---

## Prerequisites

- **Node.js** 18 or higher (< 21)
- **npm** or yarn
- **Firebase Project**: Set up at [Firebase Console](https://console.firebase.google.com/)
- **Firebase Service Account**: JSON key file for Admin SDK

---

## Getting Started

### 1. Clone the Repository

```powershell
cd d:\masai\backend
```

### 2. Install Dependencies

```powershell
npm install
```

### 3. Set Up Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create or select your project
3. Navigate to **Project Settings** → **Service Accounts**
4. Click **Generate New Private Key**
5. Save the JSON file as `serviceAccountKey.json` in the backend directory or parent directory

### 4. Configure Environment Variables

Create a `.env` file in the `backend` directory:

```powershell
copy .env.example .env
```

Edit `.env`:

```env
PORT=5000
NODE_ENV=development
SERVICE_ACCOUNT_PATH=../serviceAccountKey.json
# OR use SERVICE_ACCOUNT_JSON for production
```

### 5. Start Development Server

```powershell
npm run dev
```

The server will start on `http://localhost:5000`

### 6. Verify Server is Running

Open your browser or use curl:

```powershell
curl http://localhost:5000/health
```

Expected response: `{ "status": "ok" }`

---

## Environment Variables

The backend supports flexible configuration for different environments:

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port number | No | `5000` |
| `NODE_ENV` | Environment mode (`development`, `production`) | No | `development` |
| `SERVICE_ACCOUNT_JSON` | Complete service account JSON as string | Production | - |
| `SERVICE_ACCOUNT_PATH` | Path to service account JSON file | Development | `../serviceAccountKey.json` |

### Service Account Configuration

**Option 1: File Path (Development)**
```env
SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
```

**Option 2: JSON String (Production)**
```env
SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
```

The server searches for the service account in this order:
1. `SERVICE_ACCOUNT_JSON` environment variable
2. `SERVICE_ACCOUNT_PATH` (absolute or relative)
3. `../serviceAccountKey.json` (parent directory)
4. `./serviceAccountKey.json` (backend directory)

---

## API Endpoints

### Health Check

#### `GET /health`
Check if the server is running.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-25T10:30:00.000Z"
}
```

---

### Authentication

#### `POST /verifyToken`
Verify Firebase ID token and authenticate user.

**Request:**
```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "uid": "user123",
  "email": "user@example.com",
  "displayName": "John Doe",
  "emailVerified": true
}
```

**Errors:**
- `400`: Missing or invalid token
- `401`: Token verification failed

---

### Habits

#### `GET /habits/:userId`
Get all habits for a user.

**Headers:**
```
Authorization: Bearer <firebaseIdToken>
```

**Response:**
```json
[
  {
    "id": "habit1",
    "userId": "user123",
    "title": "Drink Water",
    "description": "8 glasses per day",
    "emoji": "💧",
    "frequency": "daily",
    "active": true,
    "createdAt": "2025-10-01T00:00:00.000Z",
    "updatedAt": "2025-10-01T00:00:00.000Z"
  }
]
```

---

#### `POST /habits`
Create a new habit.

**Request:**
```json
{
  "userId": "user123",
  "title": "Morning Run",
  "description": "30 minutes cardio",
  "emoji": "🏃",
  "frequency": "daily"
}
```

**Response:**
```json
{
  "id": "habit2",
  "userId": "user123",
  "title": "Morning Run",
  "active": true,
  "createdAt": "2025-10-25T10:30:00.000Z"
}
```

---

#### `PATCH /habits/:habitId`
Update an existing habit.

**Request:**
```json
{
  "title": "Evening Run",
  "description": "45 minutes cardio"
}
```

**Response:**
```json
{
  "id": "habit2",
  "title": "Evening Run",
  "description": "45 minutes cardio",
  "updatedAt": "2025-10-25T11:00:00.000Z"
}
```

---

#### `DELETE /habits/:habitId`
Delete a habit (sets active to false).

**Response:**
```json
{
  "message": "Habit deleted successfully"
}
```

---

### Check-ins

#### `POST /checkins`
Record a habit check-in.

**Request:**
```json
{
  "habitId": "habit1",
  "userId": "user123",
  "date": "2025-10-25",
  "completed": true,
  "note": "Felt great!"
}
```

**Response:**
```json
{
  "id": "checkin1",
  "habitId": "habit1",
  "userId": "user123",
  "date": "2025-10-25",
  "completed": true,
  "createdAt": "2025-10-25T10:30:00.000Z"
}
```

---

#### `GET /checkins/:userId`
Get all check-ins for a user.

**Query Parameters:**
- `from`: Start date (YYYY-MM-DD)
- `to`: End date (YYYY-MM-DD)
- `habitId`: Filter by specific habit

**Response:**
```json
[
  {
    "id": "checkin1",
    "habitId": "habit1",
    "date": "2025-10-25",
    "completed": true,
    "note": "Felt great!"
  }
]
```

---

### Calendar & Analytics

#### `GET /calendar/:userId`
Get calendar data with aggregated check-ins.

**Query Parameters:**
- `year`: Calendar year (default: current year)
- `month`: Calendar month (1-12, default: current month)

**Response:**
```json
{
  "year": 2025,
  "month": 10,
  "days": [
    {
      "date": "2025-10-01",
      "completedHabits": 3,
      "totalHabits": 5,
      "completionRate": 0.6
    }
  ],
  "streaks": {
    "current": 7,
    "longest": 15
  }
}
```

---

#### `GET /streaks/:habitId`
Get streak information for a specific habit.

**Response:**
```json
{
  "habitId": "habit1",
  "currentStreak": 7,
  "longestStreak": 15,
  "lastCheckIn": "2025-10-25"
}
```

---

### AI Quotes Data

#### `GET /checkins/recent/:userId`
Get recent check-in data for AI quote generation.

**Query Parameters:**
- `days`: Number of days to look back (default: 7)

**Response:**
```json
{
  "userId": "user123",
  "period": "7 days",
  "checkIns": [
    {
      "habitTitle": "Drink Water",
      "date": "2025-10-25",
      "completed": true
    }
  ],
  "summary": {
    "totalCheckIns": 15,
    "completionRate": 0.71,
    "mostActiveHabit": "Drink Water"
  }
}
```

---

## Project Structure

```
backend/
├── index.js              # Main Express server
├── package.json          # Dependencies and scripts
├── .env                  # Environment variables (not committed)
├── .env.example          # Environment template
├── .gitignore           # Git ignore rules
├── README.md            # This file
└── serviceAccountKey.json  # Firebase credentials (not committed)
```

### `index.js` Structure

The main server file is organized as follows:

1. **Configuration & Setup**
   - Environment loading
   - Express middleware setup
   - CORS configuration

2. **Firebase Initialization**
   - Service account detection and loading
   - Admin SDK initialization
   - Firestore database reference

3. **Authentication Middleware**
   - Token verification
   - User validation

4. **Route Handlers**
   - Health check
   - Auth endpoints
   - Habit CRUD operations
   - Check-in management
   - Calendar and analytics

5. **Error Handling**
   - Global error middleware
   - 404 handler
   - Validation errors

6. **Server Startup**
   - Port binding
   - Startup logging

---

## Authentication Flow

1. **User Registration/Login** (Frontend)
   - User enters credentials
   - Firebase Auth creates/verifies user
   - Firebase returns ID token

2. **Token Verification** (Backend)
   - Frontend sends ID token in request header
   - Backend verifies token with Firebase Admin SDK
   - Returns user data if valid

3. **Protected Endpoints**
   - All habit and check-in endpoints require valid token
   - Middleware validates token before processing request
   - Returns 401 if token invalid or expired

### Example Middleware Usage

```javascript
// Protect route with auth middleware
app.get('/habits/:userId', verifyAuth, async (req, res) => {
  // req.user contains decoded token
  // Proceed with authorized request
})
```

---

## Database Schema

### Firestore Collections

#### `users`
```javascript
{
  uid: string,          // Firebase user ID
  email: string,
  displayName: string,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### `habits`
```javascript
{
  id: string,           // Auto-generated
  userId: string,       // Owner's Firebase UID
  title: string,
  description: string,
  emoji: string,
  frequency: string,    // 'daily', 'weekly', 'custom'
  target: number,       // Optional daily target
  active: boolean,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### `checkins`
```javascript
{
  id: string,
  habitId: string,
  userId: string,
  date: string,         // 'YYYY-MM-DD'
  completed: boolean,
  quantity: number,     // Optional
  note: string,         // Optional
  createdAt: timestamp
}
```

### Indexes

Recommended Firestore indexes:
- `habits`: `userId` + `active`
- `checkins`: `userId` + `date` + `habitId`
- `checkins`: `habitId` + `date`

---

## Error Handling

The backend uses consistent error responses:

### Error Response Format

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}  // Optional additional context
}
```

### HTTP Status Codes

- `200`: Success
- `201`: Resource created
- `400`: Bad request (validation error)
- `401`: Unauthorized (invalid/missing token)
- `403`: Forbidden (insufficient permissions)
- `404`: Resource not found
- `500`: Internal server error

---

## Testing

### Manual Testing

Use curl or Postman to test endpoints:

**Health Check:**
```powershell
curl http://localhost:5000/health
```

**Verify Token:**
```powershell
curl -X POST http://localhost:5000/verifyToken `
  -H "Content-Type: application/json" `
  -d '{"idToken":"YOUR_FIREBASE_TOKEN"}'
```

**Get Habits:**
```powershell
curl http://localhost:5000/habits/user123 `
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

### Automated Testing

Testing framework not yet implemented. Recommended setup:
- **Jest** or **Mocha** for unit tests
- **Supertest** for API endpoint testing
- **Firebase Test SDK** for Firestore rules testing

---

## Deployment

### Recommended Hosting Platforms

#### 1. Render (Free Tier Available)

1. Create a new Web Service on [Render](https://render.com/)
2. Connect your GitHub repository
3. Configure build settings:
   - **Build Command**: `npm ci`
   - **Start Command**: `npm start`
   - **Environment**: Node 18+
4. Add environment variables:
   - `SERVICE_ACCOUNT_JSON`: Paste complete JSON
   - `NODE_ENV`: `production`
5. Deploy

**render.yaml** configuration:
```yaml
services:
  - type: web
    name: mindtrack-backend
    env: node
    buildCommand: npm ci
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: SERVICE_ACCOUNT_JSON
        sync: false  # Set in Render dashboard
```

---

#### 2. Railway

1. Create project on [Railway](https://railway.app/)
2. Connect GitHub repository
3. Railway auto-detects Node.js
4. Set environment variables in dashboard
5. Deploy automatically on push

---

#### 3. Google Cloud Run

1. Containerize the application:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

2. Build and deploy:
```powershell
gcloud builds submit --tag gcr.io/PROJECT_ID/mindtrack-backend
gcloud run deploy --image gcr.io/PROJECT_ID/mindtrack-backend --platform managed
```

---

#### 4. Heroku

1. Create Heroku app:
```powershell
heroku create mindtrack-backend
```

2. Set environment variables:
```powershell
heroku config:set SERVICE_ACCOUNT_JSON='{"type":"service_account"...}'
```

3. Deploy:
```powershell
git push heroku main
```

---

### Environment Variables for Production

**Important**: Use `SERVICE_ACCOUNT_JSON` (not file path) in production:

```env
NODE_ENV=production
PORT=5000
SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
```

### CORS Configuration

Update CORS settings for production frontend URL:

```javascript
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}))
```

---

## Troubleshooting

### Service Account Not Found

**Error**: "Could not load service account"

**Solutions:**
1. Check file path in `SERVICE_ACCOUNT_PATH`
2. Verify file exists in specified location
3. Use absolute path instead of relative
4. Set `SERVICE_ACCOUNT_JSON` directly

### Firebase Initialization Failed

**Error**: "Firebase Admin SDK initialization failed"

**Solutions:**
1. Verify service account JSON is valid
2. Check Firebase project ID matches
3. Ensure service account has necessary permissions
4. Regenerate service account key if corrupted

### Token Verification Fails

**Error**: "Token verification failed"

**Solutions:**
1. Ensure token is current (not expired)
2. Check Firebase project matches service account
3. Verify token is sent in correct format
4. Regenerate token on frontend

### Port Already in Use

**Error**: "EADDRINUSE: Port 5000 already in use"

**Solutions:**
```powershell
# Find process using port 5000
netstat -ano | findstr :5000

# Kill the process (replace PID)
taskkill /PID <PID> /F

# Or use a different port
$env:PORT=5001; npm run dev
```

### CORS Errors

**Error**: "Access-Control-Allow-Origin blocked"

**Solutions:**
1. Verify frontend URL in CORS configuration
2. Check credentials settings
3. Ensure preflight requests allowed
4. Add specific origin instead of wildcard in production

---

## Contributing

We welcome contributions! Follow these guidelines:

### Development Process

1. **Create a feature branch**
   ```powershell
   git checkout -b feature/your-feature-name
   ```

2. **Make changes**
   - Keep code modular and documented
   - Follow existing patterns
   - Add error handling

3. **Test thoroughly**
   - Test all endpoints manually
   - Verify error cases
   - Check edge cases

4. **Commit with clear messages**
   ```powershell
   git commit -m "Add: new endpoint for habit analytics"
   ```

5. **Push and create PR**
   ```powershell
   git push origin feature/your-feature-name
   ```

### Code Style

- Use async/await for async operations
- Add JSDoc comments for complex functions
- Handle errors with try/catch
- Use meaningful variable names
- Keep functions focused and single-purpose

### Commit Convention

- `Add:` New features or endpoints
- `Fix:` Bug fixes
- `Update:` Changes to existing functionality
- `Remove:` Deleted features
- `Docs:` Documentation updates
- `Refactor:` Code improvements without behavior change

---

## Security Best Practices

1. **Never commit sensitive files**
   - `serviceAccountKey.json`
   - `.env` files
   - Any credentials

2. **Use environment variables**
   - All secrets in env vars
   - Different configs per environment

3. **Validate all inputs**
   - Sanitize user data
   - Check data types
   - Prevent injection attacks

4. **Implement rate limiting**
   - Protect against abuse
   - Use express-rate-limit

5. **Keep dependencies updated**
   ```powershell
   npm audit
   npm update
   ```

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start production server |
| `npm run dev` | Start development server with nodemon |
| `npm run vercel-build` | Build command for Vercel (deprecated) |

---

## License

MIT License - see LICENSE file for details

---

## Support

- **Issues**: Open a GitHub issue
- **Documentation**: See frontend README for client integration
- **Firebase**: Check Firebase Console for authentication logs

---

**Backend API for MindTrack • Built with Express + Firebase**
