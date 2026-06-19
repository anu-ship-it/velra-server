const express = require('express')
const router = express.Router()

let cachedTrending = null
let cachedDate = null

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY

async function fetchUnsplashImage(query) {
  try {
    const response = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&client_id=${UNSPLASH_ACCESS_KEY}`
    )
    if (!response.ok) return null
    const data = await response.json()
    return data.urls?.regular || null
  } catch {
    return null
  }
}

async function fetchTrendingFromGemini() {
  const prompt = `Give me 3 trending or commonly searched skin conditions/concerns right now, written for a general audience. For each one provide:
- name (short, 2-4 words)
- a one-sentence trending reason or seasonal relevance
- a one-sentence quick tip
- a short image search keyword (2-3 words, for finding a relevant stock photo, e.g. "sunscreen application" or "moisturizer skincare")

Respond ONLY in this exact JSON format, no markdown, no extra text:
{
  "topics": [
    { "name": "...", "reason": "...", "tip": "...", "imageQuery": "..." }
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

  return [
    { name: 'Sun Protection', reason: 'Seasonal skin concern', tip: 'Use SPF 30+ daily, even when indoors near windows.', imageQuery: 'sunscreen skincare' },
    { name: 'Hydration', reason: 'Common year-round concern', tip: 'Drink water and moisturize within 3 minutes of washing your face.', imageQuery: 'face moisturizer' },
    { name: 'Acne Care', reason: 'Most searched skin topic', tip: 'Avoid touching your face and change pillowcases weekly.', imageQuery: 'skincare routine' },
  ]
}

router.get('/', async (req, res) => {
  const today = new Date().toISOString().split('T')[0]

  if (cachedTrending && cachedDate === today) {
    return res.json({ success: true, topics: cachedTrending, cached: true })
  }

  try {
    const topics = await fetchTrendingFromGemini()

    // Fetch images for each topic in parallel
    const topicsWithImages = await Promise.all(
      topics.map(async (topic) => {
        const imageUrl = await fetchUnsplashImage(topic.imageQuery || topic.name)
        return { ...topic, imageUrl }
      })
    )

    cachedTrending = topicsWithImages
    cachedDate = today
    res.json({ success: true, topics: topicsWithImages, cached: false })
  } catch (err) {
    res.json({
      success: true,
      topics: [
        { name: 'Sun Protection', reason: 'Seasonal skin concern', tip: 'Use SPF 30+ daily, even when indoors near windows.', imageUrl: null },
        { name: 'Hydration', reason: 'Common year-round concern', tip: 'Drink water and moisturize within 3 minutes of washing your face.', imageUrl: null },
        { name: 'Acne Care', reason: 'Most searched skin topic', tip: 'Avoid touching your face and change pillowcases weekly.', imageUrl: null },
      ],
      cached: false,
    })
  }
})

module.exports = router
