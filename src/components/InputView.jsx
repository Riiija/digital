import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  CornerDownLeft,
  Cpu,
  Delete,
  Handshake,
  KeyRound,
  Leaf,
  Lightbulb,
  Loader2,
  Rocket,
  Send,
  Sparkles,
  UsersRound,
} from 'lucide-react'
import { CATEGORY_LIST } from '../constants.js'
import { analyzeContribution, buildIllustration } from '../aiClient.js'
import { getActiveEvent, getStorage, setStorage } from '../storage.js'

const ICONS = { Lightbulb, Leaf, Handshake, Cpu, UsersRound, Rocket }

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back']

export default function InputView({ data, setData }) {
  const [text, setText] = useState('')
  const [pseudo, setPseudo] = useState('')
  const [category, setCategory] = useState('')
  const [done, setDone] = useState(null)
  const [cooldown, setCooldown] = useState(0)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const requireActivation = data.displayConfig?.requireActivation !== false
  const [activated, setActivated] = useState(!requireActivation)
  const [activationCode, setActivationCode] = useState('')
  const [activationError, setActivationError] = useState('')

  const activeEvent = useMemo(() => getActiveEvent(data), [data])
  const expectedCode = String(data.displayConfig?.activationCode || '2030')

  useEffect(() => {
    if (!requireActivation) setActivated(true)
  }, [requireActivation])

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  useEffect(() => {
    if (activated || !requireActivation) return undefined
    const onKeyDown = (event) => {
      if (/^\d$/.test(event.key)) {
        setActivationCode((value) => (value + event.key).slice(0, 8))
        setActivationError('')
      }
      if (event.key === 'Backspace') setActivationCode((value) => value.slice(0, -1))
      if (event.key === 'Enter') validateActivation()
      if (event.key === 'Escape') {
        setActivationCode('')
        setActivationError('')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activated, activationCode, requireActivation])

  const validateActivation = () => {
    if (activationCode === expectedCode) {
      setActivated(true)
      setActivationError('')
      return
    }
    setActivationError('Code incorrect')
    setActivationCode('')
  }

  const tapKey = (key) => {
    if (key === 'clear') {
      setActivationCode('')
      setActivationError('')
      return
    }
    if (key === 'back') {
      setActivationCode((value) => value.slice(0, -1))
      return
    }
    setActivationCode((value) => (value + key).slice(0, 8))
    setActivationError('')
  }

  const resetForm = () => {
    setText('')
    setPseudo('')
    setCategory('')
    if (requireActivation) {
      setActivated(false)
      setActivationCode('')
    }
  }

  const submit = async () => {
    if (sending) return
    if (!text.trim()) {
      setError('Ecrivez une idee avant de valider.')
      return
    }
    if (!category) {
      setError('Choisissez une thematique.')
      return
    }
    if (cooldown > 0) {
      setError(`Patientez encore ${cooldown}s avant un nouvel envoi.`)
      return
    }

    setSending(true)
    setError('')
    const analysis = await analyzeContribution({
      text: text.trim(),
      category,
      config: data.displayConfig?.aiProvider,
      eventName: activeEvent?.name || data.displayConfig?.eventName,
    })
    const imageUrl = analysis.imageUrl || buildIllustration({
      category,
      sentiment: analysis.sentiment,
      keywords: analysis.keywords,
      visualPrompt: analysis.visualPrompt,
      palette: analysis.palette,
    })
    const contribution = {
      id: `${Date.now()}`,
      eventId: activeEvent?.id || 'e1',
      pseudonym: pseudo.trim() || 'Anonyme',
      text: text.trim(),
      category,
      aiTheme: analysis.aiTheme,
      sentiment: analysis.sentiment,
      keywords: analysis.keywords,
      relevanceScore: analysis.relevanceScore,
      reactions: { like: 0, fire: 0, heart: 0 },
      imageUrl,
      visualPrompt: analysis.visualPrompt,
      aiSummary: analysis.summary,
      aiProvider: analysis.provider,
      aiError: analysis.aiError || '',
      status: data.displayConfig?.autoModeration === false ? 'pending' : analysis.moderationStatus,
      isHighlighted: analysis.relevanceScore >= 90,
      createdAt: new Date().toISOString(),
    }

    const latest = getStorage() || data
    const nextData = {
      ...latest,
      contributions: [contribution, ...(latest.contributions || [])],
    }
    setStorage(nextData)
    setData(nextData)
    setDone({ provider: analysis.provider, fallback: analysis.provider === 'local-fallback' })
    setCooldown(30)
    setSending(false)
    window.setTimeout(() => {
      setDone(null)
      resetForm()
    }, 3300)
  }

  if (done) {
    return (
      <section className="touch-screen confirmation-screen">
        <div className="digital-background" />
        <div className="confirmation-orbit">
          <CheckCircle2 size={88} strokeWidth={1.7} />
        </div>
        <h1>Idee envoyee</h1>
        <p>
          Analyse {done.fallback ? 'locale de secours' : 'IA'} terminee. Le mur se met a jour en temps reel.
        </p>
        <div className="progress-rail">
          <span />
        </div>
      </section>
    )
  }

  if (!activated && requireActivation) {
    return (
      <section className="touch-screen activation-screen">
        <div className="digital-background" />
        <div className="activation-panel">
          <span className="status-pill">
            <KeyRound size={15} />
            Station tactile securisee
          </span>
          <h1>Activation participant</h1>
          <p>{activeEvent?.name || data.displayConfig?.eventName}</p>
          <div className="code-display" aria-label="Code saisi">
            {expectedCode.split('').map((_, index) => (
              <span key={index} className={activationCode[index] ? 'is-filled' : ''} />
            ))}
          </div>
          {activationError && <strong className="inline-error">{activationError}</strong>}
          <div className="keypad">
            {KEYS.map((key) => (
              <button key={key} className="keypad-key" onClick={() => tapKey(key)}>
                {key === 'clear' && <ArrowLeft size={22} />}
                {key === 'back' && <Delete size={22} />}
                {!['clear', 'back'].includes(key) && key}
              </button>
            ))}
          </div>
          <button className="primary-action" onClick={validateActivation}>
            <CornerDownLeft size={20} />
            Activer la saisie
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="touch-screen input-screen">
      <div className="digital-background" />
      <div className="input-layout">
        <header className="input-hero">
          <span className="status-pill">
            <Sparkles size={15} />
            Capture IA en direct
          </span>
          <h1>Partagez votre vision pour 2030</h1>
          <p>{activeEvent?.description || 'Votre idee alimente le mur digital et les tendances IA.'}</p>
        </header>

        <div className="input-workspace">
          <div className="category-grid">
            {CATEGORY_LIST.map((item) => {
              const Icon = ICONS[item.icon] || Lightbulb
              const active = category === item.id
              return (
                <button
                  key={item.id}
                  className={`category-tile ${active ? 'is-selected' : ''}`}
                  style={{ '--tile': item.color, '--tile-glow': item.glow }}
                  onClick={() => setCategory(item.id)}
                >
                  <Icon size={30} strokeWidth={1.8} />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>

          <div className="idea-panel">
            <label htmlFor="idea">Votre idee</label>
            <textarea
              id="idea"
              value={text}
              onChange={(event) => setText(event.target.value.slice(0, 280))}
              placeholder="Exemple : comment l'IA, le numerique ou la collaboration peuvent transformer SOFTWELL d'ici 2030 ?"
              rows={6}
            />
            <div className="field-row">
              <input
                value={pseudo}
                onChange={(event) => setPseudo(event.target.value.slice(0, 32))}
                placeholder="Votre prenom (optionnel)"
              />
              <span className={text.length > 250 ? 'limit-count is-hot' : 'limit-count'}>{text.length}/280</span>
            </div>
            {error && <div className="inline-error">{error}</div>}
            <button className="send-button" onClick={submit} disabled={sending || cooldown > 0}>
              {sending ? <Loader2 className="spin" size={22} /> : <Send size={22} />}
              {sending ? 'Analyse IA...' : cooldown > 0 ? `Nouvel envoi dans ${cooldown}s` : 'Envoyer sur le mur'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
