import { CATS, DEFAULT_CONFIG, DEMO_DATA } from './constants.js'
import { buildIllustration } from './aiClient.js'

export const STORAGE_KEY = 'mur_digital_v3'
const LEGACY_KEYS = ['mur_digital_v2', 'mur_digital_data']

const clone = (value) => JSON.parse(JSON.stringify(value))

const readKey = (key) => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const getStorage = () => readKey(STORAGE_KEY)

export const setStorage = (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeData(data)))
    window.dispatchEvent(new CustomEvent('mur-digital:storage'))
  } catch {
    // localStorage can fail in private mode; the React state still keeps the UI alive.
  }
}

const normalizeContribution = (contribution) => {
  const normalized = {
    id: contribution.id || crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    eventId: contribution.eventId || 'e1',
    pseudonym: contribution.pseudonym || 'Anonyme',
    text: contribution.text || '',
    category: CATS[contribution.category] ? contribution.category : 'innovation',
    aiTheme: contribution.aiTheme || CATS[contribution.category]?.label || 'General',
    sentiment: ['positif', 'neutre', 'negatif'].includes(contribution.sentiment) ? contribution.sentiment : 'neutre',
    keywords: Array.isArray(contribution.keywords) ? contribution.keywords.slice(0, 6) : [],
    relevanceScore: Number.isFinite(Number(contribution.relevanceScore)) ? Number(contribution.relevanceScore) : 70,
    reactions: {
      like: Number(contribution.reactions?.like || 0),
      fire: Number(contribution.reactions?.fire || 0),
      heart: Number(contribution.reactions?.heart || 0),
    },
    imageUrl: contribution.imageUrl || '',
    mediaStyle: contribution.mediaStyle || null,
    visualPrompt: contribution.visualPrompt || '',
    aiSummary: contribution.aiSummary || '',
    aiProvider: contribution.aiProvider || 'local',
    aiError: contribution.aiError || '',
    status: ['visible', 'pending', 'hidden'].includes(contribution.status) ? contribution.status : 'visible',
    isHighlighted: Boolean(contribution.isHighlighted),
    createdAt: contribution.createdAt || new Date().toISOString(),
  }

  if (!normalized.imageUrl) {
    normalized.imageUrl = buildIllustration(normalized)
  }

  return normalized
}

export const normalizeData = (source) => {
  const demo = clone(DEMO_DATA)
  const incoming = source || demo
  const displayConfig = {
    ...DEFAULT_CONFIG,
    ...(incoming.displayConfig || {}),
    aiProvider: {
      ...DEFAULT_CONFIG.aiProvider,
      ...(incoming.displayConfig?.aiProvider || {}),
    },
  }

  return {
    events: Array.isArray(incoming.events) && incoming.events.length ? incoming.events : demo.events,
    contributions: Array.isArray(incoming.contributions)
      ? incoming.contributions.map(normalizeContribution)
      : demo.contributions.map(normalizeContribution),
    adminUser: incoming.adminUser || demo.adminUser,
    displayConfig,
    session: {
      ...demo.session,
      ...(incoming.session || {}),
    },
  }
}

export const initData = () => {
  const current = getStorage()
  if (current) {
    const normalized = normalizeData(current)
    setStorage(normalized)
    return normalized
  }

  for (const key of LEGACY_KEYS) {
    const legacy = readKey(key)
    if (legacy) {
      const migrated = normalizeData(legacySafe(legacy))
      setStorage(migrated)
      return migrated
    }
  }

  const fresh = normalizeData(clone(DEMO_DATA))
  setStorage(fresh)
  return fresh
}

const legacySafe = (legacy) => ({
  ...legacy,
  displayConfig: {
    ...DEFAULT_CONFIG,
    ...(legacy.displayConfig || {}),
    eventName: legacy.displayConfig?.eventName || legacy.events?.[0]?.name || DEFAULT_CONFIG.eventName,
  },
})

export const getActiveEvent = (data) => {
  const currentId = data?.session?.currentEventId
  return data?.events?.find((event) => event.id === currentId) || data?.events?.find((event) => event.isActive) || data?.events?.[0]
}

export const timeAgo = (iso) => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso)) / 1000))
  if (seconds < 45) return "a l'instant"
  if (seconds < 3600) return `il y a ${Math.floor(seconds / 60)} min`
  if (seconds < 86400) return `il y a ${Math.floor(seconds / 3600)} h`
  return `il y a ${Math.floor(seconds / 86400)} j`
}

export const exportCSV = (contributions) => {
  const header = ['ID', 'Pseudo', 'Texte', 'Categorie', 'Theme IA', 'Sentiment', 'Score IA', 'Likes', 'Coeurs', 'Feux', 'Statut', 'Source IA', 'Date']
  const rows = contributions.map((contribution) => [
    contribution.id,
    contribution.pseudonym,
    `"${String(contribution.text).replace(/"/g, '""')}"`,
    contribution.category,
    contribution.aiTheme,
    contribution.sentiment,
    contribution.relevanceScore,
    contribution.reactions.like,
    contribution.reactions.heart,
    contribution.reactions.fire,
    contribution.status,
    contribution.aiProvider,
    contribution.createdAt,
  ])
  const csv = [header, ...rows].map((row) => row.join(',')).join('\n')
  const anchor = document.createElement('a')
  anchor.href = `data:text/csv;charset=utf-8,\uFEFF${encodeURIComponent(csv)}`
  anchor.download = `mur_digital_contributions_${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
}
