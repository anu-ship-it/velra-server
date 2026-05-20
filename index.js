const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const analyzeRoute = require('./routes/analyze')

dotenv.config();

const app = express()
app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.json({ message: 'SnapSkin API is running' })
})

// Analyze route
app.use('/analyze', analyzeRoute)

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
const rateLimit = require('express-rate-limit')

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  message: { success: false, message: 'Too many requests. Try again later.'}
})

app.use('/analyze', limiter)