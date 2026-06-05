import { useMemo, useState } from 'react'
import {
  BarChart3,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  Gauge,
  LayoutDashboard,
  Lightbulb,
  Loader2,
  LockKeyhole,
  LogOut,
  Moon,
  Palette,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Star,
  Sun,
  Trash2,
  WandSparkles,
} from 'lucide-react'
import { BarChartSVG, HBarChartSVG, PieChartSVG } from './Charts.jsx'
import { CATEGORY_LIST, CATS, DEMO_DATA, SENT_COLOR } from '../constants.js'
import { analyzeContribution, buildIllustration } from '../aiClient.js'
import { exportCSV, getActiveEvent, getStorage, setStorage, timeAgo } from '../storage.js'

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'ai', label: 'Analyse IA', icon: WandSparkles },
  { id: 'contributions', label: 'Contenus', icon: Lightbulb },
  { id: 'moderation', label: 'Moderation', icon: ShieldAlert },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'config', label: 'Config', icon: Settings },
]

function Panel({ children, className = '' }) {
  return <section className={`admin-panel ${className}`}>{children}</section>
}

function Kpi({ icon: Icon, label, value, tone = 'brand' }) {
  return (
    <div className={`kpi-card tone-${tone}`}>
      <Icon size={20} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function ActionButton({ children, icon: Icon, variant = 'ghost', ...props }) {
  return (
    <button className={`action-button ${variant}`} {...props}>
      {Icon && <Icon size={16} />}
      {children}
    </button>
  )
}

export default function AdminView({ data, setData, onLogout }) {
  const [tab, setTab] = useState('dashboard')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [aiRun, setAiRun] = useState({ running: false, message: '' })

  const activeEvent = useMemo(() => getActiveEvent(data), [data])
  const allContributions = data.contributions || []
  const pending = allContributions.filter((contribution) => contribution.status === 'pending')
  const visible = allContributions.filter((contribution) => contribution.status === 'visible')
  const hidden = allContributions.filter((contribution) => contribution.status === 'hidden')

  const filtered = allContributions.filter((contribution) => {
    if (statusFilter !== 'all' && contribution.status !== statusFilter) return false
    const haystack = `${contribution.text} ${contribution.pseudonym} ${contribution.aiTheme}`.toLowerCase()
    return !search || haystack.includes(search.toLowerCase())
  })

  const stats = useMemo(() => {
    const catStats = CATEGORY_LIST.map((category) => ({
      name: category.label,
      count: visible.filter((contribution) => contribution.category === category.id).length,
      fill: category.color,
    }))
    const sentStats = [
      { name: 'Positif', value: allContributions.filter((contribution) => contribution.sentiment === 'positif').length, fill: SENT_COLOR.positif },
      { name: 'Neutre', value: allContributions.filter((contribution) => contribution.sentiment === 'neutre').length, fill: SENT_COLOR.neutre },
      { name: 'Negatif', value: allContributions.filter((contribution) => contribution.sentiment === 'negatif').length, fill: SENT_COLOR.negatif },
    ]
    const keywords = allContributions.flatMap((contribution) => contribution.keywords || [])
    const keywordCounts = keywords.reduce((acc, keyword) => {
      acc[keyword] = (acc[keyword] || 0) + 1
      return acc
    }, {})
    return {
      catStats,
      sentStats,
      avgScore: Math.round(allContributions.reduce((sum, contribution) => sum + contribution.relevanceScore, 0) / (allContributions.length || 1)),
      positivePct: Math.round((allContributions.filter((contribution) => contribution.sentiment === 'positif').length / (allContributions.length || 1)) * 100),
      topKeywords: Object.entries(keywordCounts).sort((a, b) => b[1] - a[1]).slice(0, 12),
      aiSources: Object.entries(allContributions.reduce((acc, contribution) => {
        const source = contribution.aiProvider || 'local'
        acc[source] = (acc[source] || 0) + 1
        return acc
      }, {})),
    }
  }, [allContributions, visible])

  const persist = (nextData) => {
    setStorage(nextData)
    setData(nextData)
  }

  const updateContribution = (id, patch) => {
    const latest = getStorage() || data
    persist({
      ...latest,
      contributions: latest.contributions.map((contribution) => (
        contribution.id === id ? { ...contribution, ...patch } : contribution
      )),
    })
  }

  const saveConfig = (patch) => {
    const latest = getStorage() || data
    const nextConfig = {
      ...latest.displayConfig,
      ...patch,
      aiProvider: {
        ...(latest.displayConfig?.aiProvider || {}),
        ...(patch.aiProvider || {}),
      },
    }
    const nextEvents = patch.eventName
      ? latest.events.map((event) => (event.id === activeEvent?.id ? { ...event, name: patch.eventName } : event))
      : latest.events
    persist({ ...latest, events: nextEvents, displayConfig: nextConfig })
  }

  const resetDemo = () => {
    if (!window.confirm('Recharger les donnees de demonstration ?')) return
    persist(JSON.parse(JSON.stringify(DEMO_DATA)))
  }

  const clearContributions = () => {
    if (!window.confirm('Vider toutes les contributions ?')) return
    persist({ ...data, contributions: [] })
  }

  const exportJSON = () => {
    const anchor = document.createElement('a')
    anchor.href = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`
    anchor.download = `mur_digital_backup_${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
  }

  const rerunAi = async () => {
    const targets = allContributions.filter((contribution) => contribution.status !== 'hidden').slice(0, 6)
    if (!targets.length) return
    setAiRun({ running: true, message: `Analyse de ${targets.length} contribution(s)...` })
    let nextContributions = [...allContributions]

    for (const target of targets) {
      const analysis = await analyzeContribution({
        text: target.text,
        category: target.category,
        config: data.displayConfig?.aiProvider,
        eventName: activeEvent?.name || data.displayConfig?.eventName,
      })
      nextContributions = nextContributions.map((contribution) => {
        if (contribution.id !== target.id) return contribution
        return {
          ...contribution,
          aiTheme: analysis.aiTheme,
          sentiment: analysis.sentiment,
          keywords: analysis.keywords,
          relevanceScore: analysis.relevanceScore,
          visualPrompt: analysis.visualPrompt,
          aiSummary: analysis.summary,
          aiProvider: analysis.provider,
          aiError: analysis.aiError || '',
          imageUrl: analysis.imageUrl || buildIllustration({
            category: contribution.category,
            sentiment: analysis.sentiment,
            keywords: analysis.keywords,
            visualPrompt: analysis.visualPrompt,
            palette: analysis.palette,
          }),
        }
      })
      persist({ ...data, contributions: nextContributions })
    }

    setAiRun({ running: false, message: 'Analyse IA mise a jour sur les contributions recentes.' })
  }

  const config = data.displayConfig || {}
  const provider = config.aiProvider || {}

  return (
    <section className="admin-screen">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="brand-mark">
            <Gauge size={18} />
          </span>
          <div>
            <strong>Control Center</strong>
            <small>{activeEvent?.name}</small>
          </div>
        </div>
        <nav>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>
              <Icon size={18} />
              <span>{label}</span>
              {id === 'moderation' && pending.length > 0 && <b>{pending.length}</b>}
            </button>
          ))}
        </nav>
        <button className="logout-button" onClick={onLogout}>
          <LogOut size={17} />
          Deconnexion
        </button>
      </aside>

      <div className="admin-content">
        {tab === 'dashboard' && (
          <>
            <div className="admin-heading">
              <span className="status-pill"><Sparkles size={15} />Pilotage live</span>
              <h1>Tableau de bord</h1>
            </div>
            <div className="kpi-grid">
              <Kpi icon={Lightbulb} label="Idees" value={allContributions.length} />
              <Kpi icon={Eye} label="Visibles" value={visible.length} tone="green" />
              <Kpi icon={ShieldAlert} label="Attente" value={pending.length} tone="amber" />
              <Kpi icon={Gauge} label="Score IA moy." value={stats.avgScore} tone="violet" />
            </div>
            <div className="admin-grid two">
              <Panel>
                <h2>Repartition thematique</h2>
                <BarChartSVG data={stats.catStats} />
              </Panel>
              <Panel>
                <h2>Sentiments</h2>
                <PieChartSVG data={stats.sentStats} />
              </Panel>
            </div>
            <Panel>
              <h2>Activite recente</h2>
              <div className="activity-list">
                {allContributions.slice(0, 7).map((contribution) => (
                  <ContributionRow key={contribution.id} contribution={contribution} compact />
                ))}
              </div>
            </Panel>
          </>
        )}

        {tab === 'ai' && (
          <>
            <div className="admin-heading">
              <span className="status-pill"><WandSparkles size={15} />IA operationnelle</span>
              <h1>Analyse IA</h1>
            </div>
            <div className="kpi-grid">
              <Kpi icon={WandSparkles} label="Mode IA" value={provider.mode || 'proxy'} />
              <Kpi icon={Gauge} label="Modele" value={provider.model || 'gpt-4o-mini'} tone="violet" />
              <Kpi icon={CheckCircle2} label="% positif" value={`${stats.positivePct}%`} tone="green" />
              <Kpi icon={ShieldAlert} label="Fallback" value={allContributions.filter((c) => c.aiProvider === 'local-fallback').length} tone="amber" />
            </div>
            <div className="admin-grid two">
              <Panel>
                <h2>Sources IA</h2>
                <div className="source-list">
                  {stats.aiSources.map(([source, count]) => (
                    <div key={source}>
                      <span>{source}</span>
                      <strong>{count}</strong>
                    </div>
                  ))}
                </div>
                <ActionButton icon={RefreshCw} variant="primary" onClick={rerunAi} disabled={aiRun.running}>
                  {aiRun.running ? 'Analyse en cours' : 'Relancer IA sur les recents'}
                </ActionButton>
                {aiRun.message && (
                  <p className="run-message">
                    {aiRun.running && <Loader2 className="spin" size={16} />}
                    {aiRun.message}
                  </p>
                )}
              </Panel>
              <Panel>
                <h2>Tendances detectees</h2>
                <div className="keyword-cloud">
                  {stats.topKeywords.map(([keyword, count]) => (
                    <span key={keyword}>{keyword}<b>{count}</b></span>
                  ))}
                </div>
              </Panel>
            </div>
            <Panel>
              <h2>Brief IA pour la roadmap</h2>
              <p className="brief-text">
                Les themes dominants orientent la roadmap 2030 autour de {stats.catStats.filter((item) => item.count > 0).slice(0, 3).map((item) => item.name).join(', ') || 'la collecte initiale'}.
                Le mur combine analyse semantique, sentiment, score de pertinence et generation visuelle pour transformer chaque saisie en signal exploitable.
              </p>
            </Panel>
          </>
        )}

        {tab === 'contributions' && (
          <>
            <div className="admin-heading row">
              <div>
                <span className="status-pill"><Lightbulb size={15} />{filtered.length} contenu(s)</span>
                <h1>Gestion des contenus</h1>
              </div>
              <ActionButton icon={Download} variant="primary" onClick={() => exportCSV(allContributions)}>Exporter CSV</ActionButton>
            </div>
            <Panel>
              <div className="toolbar">
                <label className="search-field">
                  <Search size={17} />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher une idee, un pseudo, un theme IA..." />
                </label>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="all">Tous les statuts</option>
                  <option value="visible">Visible</option>
                  <option value="pending">En attente</option>
                  <option value="hidden">Masque</option>
                </select>
              </div>
              <div className="content-list">
                {filtered.map((contribution) => (
                  <ContributionRow
                    key={contribution.id}
                    contribution={contribution}
                    actions={
                      <>
                        {contribution.status !== 'visible' && <ActionButton icon={Eye} onClick={() => updateContribution(contribution.id, { status: 'visible' })}>Afficher</ActionButton>}
                        {contribution.status !== 'hidden' && <ActionButton icon={EyeOff} onClick={() => updateContribution(contribution.id, { status: 'hidden' })}>Masquer</ActionButton>}
                        <ActionButton icon={Star} onClick={() => updateContribution(contribution.id, { isHighlighted: !contribution.isHighlighted })}>
                          {contribution.isHighlighted ? 'Retirer top' : 'Top'}
                        </ActionButton>
                        <ActionButton icon={Trash2} onClick={() => updateContribution(contribution.id, { status: 'hidden' })}>Archiver</ActionButton>
                      </>
                    }
                  />
                ))}
              </div>
            </Panel>
          </>
        )}

        {tab === 'moderation' && (
          <>
            <div className="admin-heading">
              <span className="status-pill"><ShieldAlert size={15} />File de moderation</span>
              <h1>Contributions en attente</h1>
            </div>
            <Panel>
              {pending.length === 0 ? (
                <div className="empty-admin">
                  <CheckCircle2 size={54} />
                  <h2>Aucun contenu en attente</h2>
                  <p>La moderation est a jour.</p>
                </div>
              ) : (
                <div className="content-list">
                  {pending.map((contribution) => (
                    <ContributionRow
                      key={contribution.id}
                      contribution={contribution}
                      actions={
                        <>
                          <ActionButton icon={Eye} variant="primary" onClick={() => updateContribution(contribution.id, { status: 'visible' })}>Approuver</ActionButton>
                          <ActionButton icon={EyeOff} onClick={() => updateContribution(contribution.id, { status: 'hidden' })}>Refuser</ActionButton>
                        </>
                      }
                    />
                  ))}
                </div>
              )}
            </Panel>
          </>
        )}

        {tab === 'stats' && (
          <>
            <div className="admin-heading">
              <span className="status-pill"><BarChart3 size={15} />Indicateurs</span>
              <h1>Statistiques</h1>
            </div>
            <div className="kpi-grid">
              <Kpi icon={Lightbulb} label="Total" value={allContributions.length} />
              <Kpi icon={Eye} label="Visibles" value={visible.length} tone="green" />
              <Kpi icon={EyeOff} label="Masques" value={hidden.length} tone="amber" />
              <Kpi icon={Gauge} label="% positif" value={`${stats.positivePct}%`} tone="violet" />
            </div>
            <Panel>
              <h2>Thematiques populaires</h2>
              <HBarChartSVG data={stats.catStats} />
            </Panel>
          </>
        )}

        {tab === 'config' && (
          <>
            <div className="admin-heading">
              <span className="status-pill"><Settings size={15} />Parametrage</span>
              <h1>Configuration</h1>
            </div>
            <div className="admin-grid two">
              <Panel>
                <h2>Experience mur</h2>
                <label>Nom evenement
                  <input value={config.eventName || ''} onChange={(event) => saveConfig({ eventName: event.target.value })} />
                </label>
                <label>Layout
                  <div className="segmented">
                    {['mosaic', 'spotlight', 'stream'].map((layout) => (
                      <button key={layout} className={config.layout === layout ? 'is-active' : ''} onClick={() => saveConfig({ layout })}>{layout}</button>
                    ))}
                  </div>
                </label>
                <label>Rotation {config.rotationSpeed || 8}s
                  <input type="range" min="3" max="24" value={config.rotationSpeed || 8} onChange={(event) => saveConfig({ rotationSpeed: Number(event.target.value) })} />
                </label>
                <label className="check-line">
                  <input type="checkbox" checked={Boolean(config.showBanner)} onChange={(event) => saveConfig({ showBanner: event.target.checked })} />
                  Bandeau live
                </label>
              </Panel>

              <Panel>
                <h2>Theme digital</h2>
                <label>Mode
                  <div className="segmented">
                    <button className={config.colorMode === 'dark' ? 'is-active' : ''} onClick={() => saveConfig({ colorMode: 'dark' })}><Moon size={15} />Dark</button>
                    <button className={config.colorMode === 'light' ? 'is-active' : ''} onClick={() => saveConfig({ colorMode: 'light' })}><Sun size={15} />Light</button>
                  </div>
                </label>
                <label>Couleur primaire
                  <span className="color-row">
                    <input type="color" value={config.primaryColor || '#2dd4bf'} onChange={(event) => saveConfig({ primaryColor: event.target.value })} />
                    <code>{config.primaryColor}</code>
                  </span>
                </label>
                <label>Accent
                  <span className="color-row">
                    <input type="color" value={config.accentColor || '#7c3aed'} onChange={(event) => saveConfig({ accentColor: event.target.value })} />
                    <code>{config.accentColor}</code>
                  </span>
                </label>
              </Panel>

              <Panel>
                <h2>Activation tactile</h2>
                <label className="check-line">
                  <input type="checkbox" checked={config.requireActivation !== false} onChange={(event) => saveConfig({ requireActivation: event.target.checked })} />
                  Exiger un code numerique
                </label>
                <label>Code d'activation
                  <input inputMode="numeric" value={config.activationCode || '2030'} onChange={(event) => saveConfig({ activationCode: event.target.value.replace(/\D/g, '').slice(0, 8) })} />
                </label>
              </Panel>

              <Panel>
                <h2>Connecteur IA</h2>
                <label>Mode
                  <select value={provider.mode || 'proxy'} onChange={(event) => saveConfig({ aiProvider: { mode: event.target.value } })}>
                    <option value="proxy">Proxy Vercel /api/analyze</option>
                    <option value="direct">Direct OpenAI-compatible</option>
                    <option value="local">Analyse locale seulement</option>
                  </select>
                </label>
                <label>Endpoint API
                  <input value={provider.apiBaseUrl || ''} onChange={(event) => saveConfig({ aiProvider: { apiBaseUrl: event.target.value } })} placeholder="https://api.openai.com/v1" />
                </label>
                <label>Modele
                  <input value={provider.model || ''} onChange={(event) => saveConfig({ aiProvider: { model: event.target.value } })} placeholder="gpt-4o-mini" />
                </label>
                <label>Modele image
                  <input value={provider.imageModel || ''} onChange={(event) => saveConfig({ aiProvider: { imageModel: event.target.value } })} placeholder="gpt-image-1-mini" />
                </label>
                <label>Cle API locale
                  <input type="password" value={provider.apiKey || ''} onChange={(event) => saveConfig({ aiProvider: { apiKey: event.target.value } })} placeholder="A utiliser seulement en demo locale" />
                </label>
                <label className="check-line">
                  <input type="checkbox" checked={provider.generateImages !== false} onChange={(event) => saveConfig({ aiProvider: { generateImages: event.target.checked } })} />
                  Demander une image IA via le proxy
                </label>
                <label className="check-line">
                  <input type="checkbox" checked={config.autoModeration !== false} onChange={(event) => saveConfig({ autoModeration: event.target.checked })} />
                  Affichage automatique apres analyse
                </label>
              </Panel>
            </div>
            <Panel>
              <h2>Donnees</h2>
              <div className="button-row">
                <ActionButton icon={RefreshCw} onClick={resetDemo}>Recharger demo</ActionButton>
                <ActionButton icon={Trash2} onClick={clearContributions}>Vider contributions</ActionButton>
                <ActionButton icon={Download} onClick={exportJSON}>Exporter JSON</ActionButton>
                <ActionButton icon={Palette} onClick={() => saveConfig({ primaryColor: '#2dd4bf', accentColor: '#7c3aed', colorMode: 'dark' })}>Theme par defaut</ActionButton>
              </div>
            </Panel>
          </>
        )}
      </div>
    </section>
  )
}

function ContributionRow({ contribution, actions, compact = false }) {
  const cat = CATS[contribution.category] || CATS.innovation
  return (
    <article className={`contribution-row ${compact ? 'compact' : ''}`} style={{ '--cat': cat.color }}>
      <img src={contribution.imageUrl || buildIllustration(contribution)} alt="" />
      <div>
        <div className="row-meta">
          <span style={{ color: cat.color }}>{cat.label}</span>
          <span style={{ color: SENT_COLOR[contribution.sentiment] }}>{contribution.sentiment}</span>
          <span>{contribution.relevanceScore}/100</span>
          <span>{contribution.status}</span>
        </div>
        <p>{contribution.text}</p>
        <small>@{contribution.pseudonym} - {timeAgo(contribution.createdAt)} - {contribution.aiTheme}</small>
        {contribution.aiError && <small className="warning-line">Fallback: {contribution.aiError}</small>}
      </div>
      {actions && <div className="row-actions">{actions}</div>}
    </article>
  )
}
