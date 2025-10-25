# Mindtrack Backend

This small Express backend verifies Firebase ID tokens using the Firebase Admin SDK.

Files added:
- `index.js` - Express server with `/verifyToken` endpoint
- `package.json` - dependencies and scripts
- `.env` - environment template (set SERVICE_ACCOUNT_PATH if needed)
- `.gitignore` - ignore node_modules and .env

Usage
1. From `d:\masai\backend` install deps:

   npm install

2. Start server (dev):

   npm run dev

3. Client should POST an ID token to `/verifyToken`:

   POST http://localhost:5000/verifyToken
   Content-Type: application/json
   Body: { "idToken": "<FIREBASE_ID_TOKEN>" }

Server responds with decoded token info if valid.

Notes
- This expects `serviceAccountKey.json` at the repository root by default (path: `../serviceAccountKey.json`). You can set `SERVICE_ACCOUNT_PATH` in `.env` to change this.
- Keep `serviceAccountKey.json` secure and do not commit it to public repos.
