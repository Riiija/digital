import { CATS, NEG_WORDS, POS_WORDS, STOP_WORDS } from './constants.js'

const cleanWord = (word) => word
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9-]/g, '')

const clampScore = (score) => Math.max(0, Math.min(100, Math.round(Number(score) || 70)))

const endpointFor = (baseUrl) => {
  const clean = (baseUrl || '').trim().replace(/\/$/, '')
  if (!clean) return ''
  if (clean.endsWith('/chat/completions')) return clean
  return `${clean}/chat/completions`
}

const safeJsonParse = (value) => {
  if (!value) return null
  if (typeof value === 'object') return value
  const withoutFence = String(value)
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim()
  try {
    return JSON.parse(withoutFence)
  } catch {
    const start = withoutFence.indexOf('{')
    const end = withoutFence.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(withoutFence.slice(start, end + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

export const localAnalyzeContribution = (text, category) => {
  const words = text.split(/\s+/).map(cleanWord).filter(Boolean)
  const pos = words.filter((word) => POS_WORDS.some((needle) => word.includes(cleanWord(needle)))).length
  const neg = words.filter((word) => NEG_WORDS.some((needle) => word.includes(cleanWord(needle)))).length
  const sentiment = neg > pos ? 'negatif' : pos > 0 ? 'positif' : 'neutre'
  const stop = new Set(STOP_WORDS.map(cleanWord))
  const keywords = [...new Set(words.filter((word) => word.length > 4 && !stop.has(word)))]
    .sort((a, b) => b.length - a.length)
    .slice(0, 5)
  const cat = CATS[category] || CATS.innovation
  const relevanceScore = clampScore(64 + keywords.length * 5 + pos * 4 - neg * 3)

  return normalizeAnalysis({
    sentiment,
    aiTheme: cat.label,
    keywords: keywords.length ? keywords : [cat.label.toLowerCase()],
    relevanceScore,
    moderationStatus: 'visible',
    summary: `Analyse locale: idee rattachee au theme ${cat.label}.`,
    visualPrompt: `${cat.prompt}. Idee: ${text.slice(0, 160)}`,
    palette: [cat.color, '#111827', sentiment === 'negatif' ? '#fb7185' : '#2dd4bf'],
    provider: 'local',
  }, category)
}

const normalizeAnalysis = (analysis, category) => {
  const cat = CATS[category] || CATS.innovation
  const sentiment = ['positif', 'neutre', 'negatif'].includes(analysis?.sentiment) ? analysis.sentiment : 'neutre'
  const keywords = Array.isArray(analysis?.keywords)
    ? analysis.keywords.map(String).filter(Boolean).slice(0, 6)
    : []

  return {
    sentiment,
    aiTheme: String(analysis?.aiTheme || analysis?.theme || cat.label).slice(0, 60),
    keywords: keywords.length ? keywords : [cat.label.toLowerCase()],
    relevanceScore: clampScore(analysis?.relevanceScore),
    moderationStatus: ['visible', 'pending', 'hidden'].includes(analysis?.moderationStatus)
      ? analysis.moderationStatus
      : 'visible',
    summary: String(analysis?.summary || analysis?.aiSummary || '').slice(0, 240),
    visualPrompt: String(analysis?.visualPrompt || analysis?.imagePrompt || cat.prompt).slice(0, 420),
    imageUrl: typeof analysis?.imageUrl === 'string' ? analysis.imageUrl : '',
    palette: Array.isArray(analysis?.palette) && analysis.palette.length
      ? analysis.palette.slice(0, 4)
      : [cat.color, '#0f172a', '#2dd4bf'],
    provider: analysis?.provider || 'api',
    raw: analysis?.raw,
  }
}

const buildMessages = ({ text, category, eventName }) => {
  const cat = CATS[category] || CATS.innovation
  return [
    {
      role: 'system',
      content: [
        'Tu es le moteur IA du Mur Digital Interactif Intelligent de SOFTWELL.',
        'Analyse des idees courtes pour un evenement innovation 2030.',
        'Reponds uniquement en JSON valide, sans Markdown.',
        'Schema obligatoire: sentiment, aiTheme, keywords, relevanceScore, moderationStatus, summary, visualPrompt, palette.',
        'sentiment vaut positif, neutre ou negatif. moderationStatus vaut visible, pending ou hidden.',
        'palette est un tableau de 3 couleurs hexadecimales.',
      ].join(' '),
    },
    {
      role: 'user',
      content: JSON.stringify({
        eventName,
        category,
        categoryMeaning: cat.prompt,
        contribution: text,
      }),
    },
  ]
}

const callChatEndpoint = async ({ endpoint, apiKey, model, timeoutMs, text, category, eventName }) => {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs || 14_000)
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: buildMessages({ text, category, eventName }),
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      const message = await response.text()
      throw new Error(message || `Erreur IA ${response.status}`)
    }

    const payload = await response.json()
    const content = payload?.choices?.[0]?.message?.content
    const parsed = safeJsonParse(content)
    if (!parsed) throw new Error('La reponse IA ne contient pas de JSON exploitable.')
    return normalizeAnalysis({ ...parsed, provider: payload?.model || model || 'api', raw: payload }, category)
  } finally {
    window.clearTimeout(timeout)
  }
}

export const analyzeContribution = async ({ text, category, config = {}, eventName = '' }) => {
  const provider = config || {}
  const mode = provider.mode || 'proxy'

  if (mode === 'local') {
    return localAnalyzeContribution(text, category)
  }

  try {
    if (mode === 'direct') {
      if (!provider.apiKey) throw new Error('Cle API absente pour le mode direct.')
      const endpoint = endpointFor(provider.apiBaseUrl)
      if (!endpoint) throw new Error('Endpoint IA direct absent.')
      return await callChatEndpoint({
        endpoint,
        apiKey: provider.apiKey,
        model: provider.model,
        timeoutMs: provider.timeoutMs,
        text,
        category,
        eventName,
      })
    }

    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        category,
        eventName,
        generateImages: provider.generateImages !== false,
        imageModel: provider.imageModel,
      }),
    })

    if (!response.ok) {
      const message = await response.text()
      throw new Error(message || `Proxy IA indisponible (${response.status})`)
    }
    const payload = await response.json()
    return normalizeAnalysis(payload, category)
  } catch (error) {
    const fallback = localAnalyzeContribution(text, category)
    return {
      ...fallback,
      provider: 'local-fallback',
      aiError: error instanceof Error ? error.message.slice(0, 180) : 'Erreur IA inconnue',
    }
  }
}

export const buildIllustration = ({ category, sentiment, keywords = [], visualPrompt = '', palette = [] }) => {
  const cat = CATS[category] || CATS.innovation
  const colors = [palette[0] || cat.color, palette[1] || '#0f172a', palette[2] || '#2dd4bf']
  const word = (keywords[0] || cat.short || cat.label).slice(0, 14).toUpperCase()
  const sub = (keywords[1] || sentiment || 'IA').slice(0, 12).toUpperCase()
  const promptHash = [...visualPrompt].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const angle = 20 + (promptHash % 120)

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 620">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="${colors[0]}"/>
          <stop offset=".58" stop-color="${colors[1]}"/>
          <stop offset="1" stop-color="${colors[2]}"/>
        </linearGradient>
        <radialGradient id="r" cx=".25" cy=".2" r=".9">
          <stop offset="0" stop-color="#ffffff" stop-opacity=".5"/>
          <stop offset=".35" stop-color="${colors[0]}" stop-opacity=".28"/>
          <stop offset="1" stop-color="#020617" stop-opacity="0"/>
        </radialGradient>
        <filter id="blur"><feGaussianBlur stdDeviation="18"/></filter>
      </defs>
      <rect width="900" height="620" rx="48" fill="url(#g)"/>
      <rect width="900" height="620" rx="48" fill="url(#r)"/>
      <g opacity=".34" stroke="#fff" stroke-width="1">
        ${Array.from({ length: 18 }, (_, i) => `<path d="M ${-120 + i * 70} 650 L ${180 + i * 70} -40"/>`).join('')}
        ${Array.from({ length: 10 }, (_, i) => `<path d="M -50 ${80 + i * 55} H 950"/>`).join('')}
      </g>
      <circle cx="${190 + (promptHash % 140)}" cy="180" r="130" fill="${colors[0]}" opacity=".45" filter="url(#blur)"/>
      <circle cx="${620 - (promptHash % 110)}" cy="420" r="165" fill="${colors[2]}" opacity=".28" filter="url(#blur)"/>
      <g transform="translate(450 310) rotate(${angle})" fill="none" stroke="#fff" stroke-opacity=".72">
        <rect x="-210" y="-118" width="420" height="236" rx="38" stroke-width="4"/>
        <path d="M-170 0H170M0-85V85M-120-70L120 70M-120 70L120-70" stroke-width="2"/>
      </g>
      <text x="58" y="506" fill="#fff" font-family="Inter, Arial, sans-serif" font-size="58" font-weight="800" letter-spacing="5">${word}</text>
      <text x="62" y="556" fill="#fff" fill-opacity=".78" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="700" letter-spacing="4">${sub}</text>
    </svg>
  `

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}
