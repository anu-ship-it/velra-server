const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const rateLimit = require('express-rate-limit')

dotenv.config()

const analyzeRoute = require('./routes/analyze')
const trendingRoute = require('./routes/trending')
const articleRoute = require('./routes/article')

const app = express()
app.use(cors())
app.use(express.json())

// Health check — no auth needed
app.get('/', (req, res) => {
  res.json({ message: 'Velra API is running' })
})

// Secret key auth — must be before all routes
const VELRA_SECRET = process.env.VELRA_SECRET_KEY
app.use((req, res, next) => {
  if (req.path === '/') return next()
  const key = req.headers['x-velra-key']
  if (!key || key !== VELRA_SECRET) {
    return res.status(403).json({ success: false, message: 'Forbidden' })
  }
  next()
})

// Rate limiter
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'Too many requests. Try again later.' }
})

// Routes
app.use('/analyze', limiter)
app.use('/analyze', analyzeRoute)
app.use('/trending', trendingRoute)
app.use('/article', limiter)
app.use('/article', articleRoute)

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
