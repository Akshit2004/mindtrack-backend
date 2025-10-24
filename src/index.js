import 'dotenv/config'
import express from 'express'
// Vercel serverless entry: export the Express app without calling listen.
import app from './app.js'

export default app
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal Server Error' })
})

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`)
})
