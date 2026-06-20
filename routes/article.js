const express = require('express')
const router = express.Router()

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']

router.post('/', async (req, res) => {
  const { name, reason, tip } = req.body

  if (!name) {
    return res.status(400).json({ success: false, message: 'Topic name required' })
  }

  const prompt = `Write a short, helpful article (250-350 words) about the skin topic "${name}" for a general audience using a skin health app called Velra.

Context: ${reason || ''} ${tip || ''}

Structure the article with these sections, each as a short paragraph:
1. What it is (brief, simple explanation)
2. Common causes
3. Practical care tips (3-4 actionable tips)
4. When to see a dermatologist

Respond ONLY in this exact JSON format, no markdown, no extra text:
{
  "title": "...",
  "sections": [
    { "heading": "What It Is", "content": "..." },
    { "heading": "Common Causes", "content": "..." },
    { "heading": "Care Tips", "content": "..." },
    { "heading": "When To See A Dermatologist", "content": "..." }
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
      if (parsed.sections && parsed.sections.length > 0) {
        return res.json({ success: true, article: parsed })
      }
    } catch (err) {
      continue
    }
  }

  res.json({
    success: false,
    message: 'Could not generate article right now. Please try again later.',
  })
})

module.exports = router
