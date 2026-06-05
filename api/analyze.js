const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'
const DEFAULT_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1-mini'

const json = (response, status, payload) => {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

const parseBody = async (request) => {
  if (request.body && typeof request.body === 'object') return request.body
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

const endpointFor = () => {
  const baseUrl = (process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
  return baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`
}

const imageEndpointFor = () => {
  const baseUrl = (process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
  return baseUrl.endsWith('/images/generations') ? baseUrl : `${baseUrl}/images/generations`
}

const safeJsonParse = (value) => {
  const text = String(value || '').trim().replace(/^```json\s*/i, '').replace(/```$/i, '')
  try {
    return JSON.parse(text)
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

module.exports = async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (request.method === 'OPTIONS') {
    response.statusCode = 204
    response.end()
    return
  }

  if (request.method !== 'POST') {
    json(response, 405, { error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_API_TOKEN
  if (!apiKey) {
    json(response, 503, {
      error: 'OPENAI_API_KEY absent. Configurez la variable d environnement Vercel pour activer le proxy IA.',
      provider: 'proxy-unconfigured',
    })
    return
  }

  try {
    const { text, category, eventName, generateImages, imageModel } = await parseBody(request)
    if (!text || !category) {
      json(response, 400, { error: 'text et category sont obligatoires.' })
      return
    }

    const upstream = await fetch(endpointFor(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: [
              'Tu es le moteur IA du Mur Digital Interactif Intelligent de SOFTWELL.',
              'Analyse les contributions pour identifier les tendances innovation 2030.',
              'Reponds uniquement en JSON valide.',
              'Schema: sentiment, aiTheme, keywords, relevanceScore, moderationStatus, summary, visualPrompt, palette.',
              'sentiment: positif/neutre/negatif. moderationStatus: visible/pending/hidden.',
              'palette: tableau de 3 couleurs hexadecimales.',
            ].join(' '),
          },
          {
            role: 'user',
            content: JSON.stringify({ eventName, category, contribution: text }),
          },
        ],
      }),
    })

    const payload = await upstream.json().catch(async () => ({ error: await upstream.text() }))
    if (!upstream.ok) {
      json(response, upstream.status, {
        error: payload?.error?.message || payload?.error || 'Erreur upstream IA',
        provider: 'proxy-error',
      })
      return
    }

    const content = payload?.choices?.[0]?.message?.content
    const parsed = safeJsonParse(content)
    if (!parsed) {
      json(response, 502, {
        error: 'Reponse IA non JSON.',
        provider: 'proxy-invalid-json',
      })
      return
    }

    let imageUrl = ''
    if (generateImages !== false && process.env.OPENAI_GENERATE_IMAGES !== 'false') {
      const imagePrompt = [
        parsed.visualPrompt || parsed.summary || text,
        'Style: digital modern UI, installation evenementielle, image abstraite premium, sans texte lisible, couleurs lumineuses.',
      ].join(' ')
      const imagePayload = await fetch(imageEndpointFor(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: imageModel || DEFAULT_IMAGE_MODEL,
          prompt: imagePrompt,
          size: '1024x1024',
          quality: 'low',
          output_format: 'webp',
        }),
      }).then((res) => res.ok ? res.json() : null).catch(() => null)

      const firstImage = imagePayload?.data?.[0]
      if (firstImage?.b64_json) imageUrl = `data:image/webp;base64,${firstImage.b64_json}`
      if (!imageUrl && firstImage?.url) imageUrl = firstImage.url
    }

    json(response, 200, {
      ...parsed,
      imageUrl,
      provider: payload?.model || DEFAULT_MODEL,
    })
  } catch (error) {
    json(response, 500, {
      error: error instanceof Error ? error.message : 'Erreur serveur IA',
      provider: 'proxy-exception',
    })
  }
}
