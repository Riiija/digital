import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart3,
  Clock3,
  Flame,
  Heart,
  MessageSquareText,
  Pause,
  Play,
  Sparkles,
  ThumbsUp,
  Zap,
} from 'lucide-react'
import { CATEGORY_LIST, CATS, SENT_COLOR } from '../constants.js'
import { buildIllustration } from '../aiClient.js'
import { getActiveEvent, getStorage, setStorage, timeAgo } from '../storage.js'

function getVisibleContributions(data) {
  return data.contributions
    .filter((contribution) => contribution.status === 'visible')
    .sort((a, b) => {
      if (a.isHighlighted !== b.isHighlighted) return a.isHighlighted ? -1 : 1
      return new Date(b.createdAt) - new Date(a.createdAt)
    })
}

function useLiveStorage(setData) {
  const [tick, setTick] = useState(0)
  const [newIds, setNewIds] = useState(new Set())
  const prevIds = useRef(new Set())

  useEffect(() => {
    const sync = () => {
      const fresh = getStorage()
      if (!fresh) return
      const freshIds = new Set(fresh.contributions.map((contribution) => contribution.id))
      const added = [...freshIds].filter((id) => !prevIds.current.has(id))
      if (added.length) {
        setNewIds(new Set(added))
        window.setTimeout(() => setNewIds(new Set()), 2400)
      }
      prevIds.current = freshIds
      setData(fresh)
      setTick((value) => value + 1)
    }
    sync()
    const timer = window.setInterval(sync, 2000)
    window.addEventListener('mur-digital:storage', sync)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('mur-digital:storage', sync)
    }
  }, [setData])

  return { tick, newIds }
}

function ContributionMedia({ contribution }) {
  const image = contribution.imageUrl || buildIllustration(contribution)
  return (
    <div className="contribution-media">
      <img src={image} alt="" loading="lazy" />
      <span className="media-shine" />
    </div>
  )
}

function ReactionButton({ icon: Icon, value, onClick, label, type }) {
  return (
    <button className={`reaction-button reaction-${type}`} onClick={onClick} title={label}>
      <Icon size={15} />
      <span>{value || 0}</span>
    </button>
  )
}

function ContributionCard({ contribution, isNew, onReact, compact = false }) {
  const cat = CATS[contribution.category] || CATS.innovation
  return (
    <article
      className={`contribution-card ${isNew ? 'is-new' : ''} ${compact ? 'is-compact' : ''} ${contribution.isHighlighted ? 'is-highlighted' : ''}`}
      style={{
        '--cat': cat.color,
        '--cat-glow': cat.glow,
        '--sentiment': SENT_COLOR[contribution.sentiment] || SENT_COLOR.neutre,
      }}
    >
      {!compact && <ContributionMedia contribution={contribution} />}
      <div className="contribution-body">
        <div className="card-meta">
          <span className="theme-chip">{cat.label}</span>
          <span className="score-chip">
            <Zap size={12} />
            {contribution.relevanceScore}
          </span>
          {contribution.isHighlighted && (
            <span className="live-chip">
              <Sparkles size={12} />
              Top
            </span>
          )}
        </div>
        <p className="contribution-text">{contribution.text}</p>
        <div className="ai-line">
          <span>{contribution.aiTheme}</span>
          <span>{contribution.aiProvider === 'local-fallback' ? 'Secours local' : contribution.aiProvider}</span>
        </div>
        <div className="card-footer">
          <span className="author">@{contribution.pseudonym} - {timeAgo(contribution.createdAt)}</span>
          <div className="reaction-row">
            <ReactionButton type="like" icon={ThumbsUp} value={contribution.reactions.like} label="J'aime" onClick={() => onReact(contribution.id, 'like')} />
            <ReactionButton type="heart" icon={Heart} value={contribution.reactions.heart} label="Coeur" onClick={() => onReact(contribution.id, 'heart')} />
            <ReactionButton type="fire" icon={Flame} value={contribution.reactions.fire} label="Intense" onClick={() => onReact(contribution.id, 'fire')} />
          </div>
        </div>
      </div>
    </article>
  )
}

function MosaicWall({ contributions, newIds, onReact }) {
  return (
    <div className="mosaic-grid">
      {contributions.slice(0, 20).map((contribution, index) => (
        <div key={contribution.id} className={index % 7 === 0 ? 'tile-wide' : ''}>
          <ContributionCard contribution={contribution} isNew={newIds.has(contribution.id)} onReact={onReact} />
        </div>
      ))}
    </div>
  )
}

function StreamWall({ contributions, newIds, onReact }) {
  return (
    <div className="stream-grid">
      {contributions.slice(0, 16).map((contribution) => (
        <ContributionCard
          key={contribution.id}
          contribution={contribution}
          isNew={newIds.has(contribution.id)}
          onReact={onReact}
          compact
        />
      ))}
    </div>
  )
}

function SpotlightWall({ contributions, newIds, onReact, rotationSpeed }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const active = contributions[index % contributions.length]
  const next = contributions.filter((_, itemIndex) => itemIndex !== index).slice(0, 4)

  useEffect(() => {
    if (paused || contributions.length <= 1) return undefined
    const timer = window.setInterval(() => {
      setIndex((value) => (value + 1) % contributions.length)
    }, Math.max(3, rotationSpeed || 8) * 1000)
    return () => window.clearInterval(timer)
  }, [paused, contributions.length, rotationSpeed])

  useEffect(() => {
    setIndex((value) => Math.min(value, Math.max(0, contributions.length - 1)))
  }, [contributions.length])

  if (!active) return null

  return (
    <div className="spotlight-layout">
      <div className="spotlight-main">
        <ContributionCard contribution={active} isNew={newIds.has(active.id)} onReact={onReact} />
        <button className="spotlight-toggle" onClick={() => setPaused((value) => !value)} title={paused ? 'Reprendre' : 'Pause'}>
          {paused ? <Play size={18} /> : <Pause size={18} />}
        </button>
      </div>
      <div className="spotlight-strip">
        {next.map((contribution) => (
          <button
            key={contribution.id}
            className="spotlight-next"
            onClick={() => setIndex(contributions.findIndex((item) => item.id === contribution.id))}
          >
            <ContributionCard contribution={contribution} isNew={false} onReact={onReact} compact />
          </button>
        ))}
      </div>
    </div>
  )
}

function WallStats({ total, topTheme, positivePct, activeEvent }) {
  return (
    <header className="wall-header">
      <div className="wall-title">
        <span className="brand-mark">
          <Sparkles size={18} />
        </span>
        <div>
          <h1>{activeEvent?.name || 'Mur Digital'}</h1>
          <p>Affichage intelligent en temps reel</p>
        </div>
      </div>
      <div className="wall-ticker">
        <span>
          <MessageSquareText size={16} />
          <b>{total}</b> idees
        </span>
        <span>
          <BarChart3 size={16} />
          {topTheme?.label || 'Tendance'} en tete
        </span>
        <span>
          <Zap size={16} />
          {positivePct}% positif
        </span>
      </div>
      <div className="wall-clock">
        <Clock3 size={16} />
        {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </header>
  )
}

export default function WallView({ data, setData }) {
  const { tick, newIds } = useLiveStorage(setData)
  const activeEvent = useMemo(() => getActiveEvent(data), [data])
  const visible = useMemo(() => getVisibleContributions(data), [data.contributions, tick])
  const layout = data.displayConfig?.layout || 'mosaic'
  const rotationSpeed = data.displayConfig?.rotationSpeed || 8

  const stats = useMemo(() => {
    const categoryStats = CATEGORY_LIST.map((cat) => ({
      ...cat,
      count: visible.filter((contribution) => contribution.category === cat.id).length,
    })).sort((a, b) => b.count - a.count)
    const positivePct = visible.length
      ? Math.round((visible.filter((contribution) => contribution.sentiment === 'positif').length / visible.length) * 100)
      : 0
    return {
      categoryStats,
      topTheme: categoryStats[0],
      positivePct,
    }
  }, [visible])

  const doReact = (id, type) => {
    const latest = getStorage() || data
    const nextContributions = latest.contributions.map((contribution) => {
      if (contribution.id !== id) return contribution
      return {
        ...contribution,
        reactions: {
          ...contribution.reactions,
          [type]: (contribution.reactions?.[type] || 0) + 1,
        },
      }
    })
    const nextData = { ...latest, contributions: nextContributions }
    setStorage(nextData)
    setData(nextData)
  }

  const topThree = stats.categoryStats.filter((item) => item.count > 0).slice(0, 3)

  return (
    <section className={`wall-screen wall-${layout}`}>
      <div className="digital-background" />
      <WallStats total={visible.length} topTheme={stats.topTheme} positivePct={stats.positivePct} activeEvent={activeEvent} />

      {visible.length === 0 ? (
        <div className="empty-wall">
          <Sparkles size={64} />
          <h2>Le mur attend sa premiere idee</h2>
          <p>Activez la station de saisie et envoyez une contribution.</p>
        </div>
      ) : (
        <div className="wall-stage">
          {layout === 'spotlight' ? (
            <SpotlightWall contributions={visible} newIds={newIds} onReact={doReact} rotationSpeed={rotationSpeed} />
          ) : layout === 'stream' ? (
            <StreamWall contributions={visible} newIds={newIds} onReact={doReact} />
          ) : (
            <MosaicWall contributions={visible} newIds={newIds} onReact={doReact} />
          )}
        </div>
      )}

      {data.displayConfig?.showBanner && visible.length > 0 && (
        <footer className="live-marquee">
          <div>
            <span>Themes dominants</span>
            {topThree.map((item) => (
              <b key={item.id} style={{ color: item.color }}>
                {item.label} ({item.count})
              </b>
            ))}
            <span>Rapport IA pret pour la roadmap 2030</span>
          </div>
        </footer>
      )}
    </section>
  )
}
