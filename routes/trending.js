const express = require('express')
const router = express.Router()

// In-memory cache — resets if server restarts (Render free tier sleeps, so this
// naturally refreshes periodically, which is fine for daily content anyway)
let cachedTrending = null
let cachedDate = null

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']

async function fetchTrendingFromGemini() {
  const prompt = `Give me 3 trending or commonly searched skin conditions/concerns right now, written for a general audience. For each one provide:
- name (short)
- a one-sentence trending reason or seasonal relevance
- a one-sentence quick tip

Respond ONLY in this exact JSON format, no markdown, no extra text:
{
  "topics": [
    { "name": "...", "reason": "...", "tip": "..." }
  ]
}`

  for (const model of GEMINI_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      )

      if (!response.ok) continue

      const data = await response.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) continue

      const cleaned = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(cleaned)
      if (parsed.topics && parsed.topics.length > 0) {
        return parsed.topics
      }
    } catch (err) {
      continue
    }
  }

  // Fallback if all models fail
  return [
    { name: 'Sun Protection', reason: 'Seasonal skin concern', tip: 'Use SPF 30+ daily, even when indoors near windows.' },
    { name: 'Hydration', reason: 'Common year-round concern', tip: 'Drink water and moisturize within 3 minutes of washing your face.' },
    { name: 'Acne Care', reason: 'Most searched skin topic', tip: 'Avoid touching your face and change pillowcases weekly.' },
  ]
}

router.get('/', async (req, res) => {
  const today = new Date().toISOString().split('T')[0]

  if (cachedTrending && cachedDate === today) {
    return res.json({ success: true, topics: cachedTrending, cached: true })
  }

  try {
    const topics = await fetchTrendingFromGemini()
    cachedTrending = topics
    cachedDate = today
    res.json({ success: true, topics, cached: false })
  } catch (err) {
    res.json({
      success: true,
      topics: [
        { name: 'Sun Protection', reason: 'Seasonal skin concern', tip: 'Use SPF 30+ daily, even when indoors near windows.' },
        { name: 'Hydration', reason: 'Common year-round concern', tip: 'Drink water and moisturize within 3 minutes of washing your face.' },
        { name: 'Acne Care', reason: 'Most searched skin topic', tip: 'Avoid touching your face and change pillowcases weekly.' },
      ],
      cached: false,
    })
  }
})

module.exports = router
