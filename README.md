# Mindtrack Backend

This small Express backend verifies Firebase ID tokens using the Firebase Admin SDK.

Files added:
- `index.js` - Express server with `/verifyToken` endpoint
- `package.json` - dependencies and scripts
- `.env` - environment template (set SERVICE_ACCOUNT_PATH if needed)
- `.gitignore` - ignore node_modules and .env

## Local usage
1) Install deps:

   npm install

2) Start server (dev):

   npm run dev

3) Healthcheck: http://localhost:5000/health

4) Verify token (POST):

   POST http://localhost:5000/verifyToken
   Content-Type: application/json
   Body: { "idToken": "<FIREBASE_ID_TOKEN>" }

Server responds with decoded token info if valid.

The server binds to PORT from env (default 5000).

## Deploying

Vercel does not host long‑running Node.js servers. It only supports serverless/edge functions. Because this repository is an Express server (stateful, long‑running), deploy it to a serverful host and keep your frontend on Vercel if desired.

Recommended options:

- Render (free tier): uses `render.yaml` in this repo.
- Railway, Fly.io, or Google Cloud Run (Docker/Node supported).

### Render (one‑click-ish)

1) Create a new Web Service on Render from this repo.
2) Render auto-detects Node. Build: `npm ci` Start: `npm start`.
3) Set environment variables:
   - SERVICE_ACCOUNT_JSON: Paste the full JSON from your Firebase service account.
   - (optional) NODE_ENV=production
4) Deploy. Render will expose a URL like `https://mindtrack-backend.onrender.com`.
5) Point your frontend `.env` to that URL.

### Environment variables

- SERVICE_ACCOUNT_JSON (preferred): the entire service account JSON.
- SERVICE_ACCOUNT_PATH (fallback): absolute/relative path to the JSON file.
- PORT: provided by host; defaults to 5000 locally.

Notes
- For local dev this will try `backend/serviceAccountKey.json` automatically. You can set `SERVICE_ACCOUNT_PATH` in `.env` to change this, or set `SERVICE_ACCOUNT_JSON` instead.
- Keep `serviceAccountKey.json` secure and do not commit it to public repos.

## Vercel (static placeholder)

This repo includes a minimal `vercel.json` that builds a static page from `public/` so that a deployment to Vercel succeeds and shows a friendly message. It does NOT run the API on Vercel. Use one of the serverful hosts above for the actual backend.
