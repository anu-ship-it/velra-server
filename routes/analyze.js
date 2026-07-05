const express = require('express')
const multer = require('multer')
const sharp = require('sharp')

const router = express.Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
})

const MODELS = [
  'gemini-2.5-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro'
]

const callGemini = async (base64Image) => {
  let lastError = null

  for (const model of MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                {
                  text: `You are a dermatology assistant. Analyze this skin condition image.
                  Respond ONLY in this exact JSON format, nothing else:
                  {
                    "conditions": [
                      {
                        "name": "condition name",
                        "confidence": 85,
                        "description": "brief description",
                        "causes": ["cause1", "cause2"],
                        "contagious": false,
                        "homeCare": ["tip1", "tip2"],
                        "seeDoctor": "when to see a doctor"
                      }
                    ],
                    "overallConfidence": 85,
                    "unclear": false
                  }
                  Return top 3 possible conditions ranked by confidence.
                  If image is unclear or not a skin condition set unclear to true.`
                },
                {
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: base64Image
                  }
                }
              ]
            }]
          })
        }
      )

      const data = await response.json()

      if (!response.ok) {
        console.warn(`Model ${model} failed with ${response.status}. Trying next...`)
        lastError = data
        continue
      }

      console.log(`Success with model: ${model}`)
      return data

    } catch (err) {
      console.warn(`Model ${model} threw error. Trying next...`)
      lastError = err
      continue
    }
  }

  throw new Error(`All models failed. Last error: ${JSON.stringify(lastError)}`)
}

router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image provided' })
    }

    // Magic bytes check — verify actual image content, not just claimed MIME type
    const bytes = req.file.buffer.slice(0, 4)
    const isJpeg = bytes[0] === 0xFF && bytes[1] === 0xD8
    const isPng  = bytes[0] === 0x89 && bytes[1] === 0x50
    const isWebp = bytes[0] === 0x52 && bytes[1] === 0x49

    if (!isJpeg && !isPng && !isWebp) {
      return res.status(400).json({ success: false, message: 'Invalid file type. Please upload an image.' })
    }

    const compressedImage = await sharp(req.file.buffer)
      .resize(800, 800, { fit: 'inside' })
      .jpeg({ quality: 80 })
      .toBuffer()

    const base64Image = compressedImage.toString('base64')

    const data = await callGemini(base64Image)

    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      return res.status(500).json({
        success: false,
        message: 'Analysis unavailable right now. Please try again in a moment.'
      })
    }

    const responseText = data.candidates[0].content.parts[0].text
    const cleanJson = responseText.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleanJson)

    if (parsed.unclear || parsed.overallConfidence < 60) {
      return res.json({
        success: false,
        message: 'Unable to identify condition clearly. Please consult a doctor.',
        confidence: parsed.overallConfidence
      })
    }

    return res.json({
      success: true,
      results: parsed.conditions,
      disclaimer: 'This is not a medical diagnosis. Please consult a doctor.'
    })

  } catch (error) {
    console.error('Error:', error.message)
    return res.status(500).json({
      success: false,
      message: 'Analysis failed. Please try again.',
      debug: error.message
    })
  }
})

module.exports = router
