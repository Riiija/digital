import { Lightbulb, MonitorUp, Moon, ShieldCheck, Sun } from 'lucide-react'

const NAV_ITEMS = [
  { id: 'wall', label: 'Mur', icon: MonitorUp },
  { id: 'input', label: 'Saisie', icon: Lightbulb },
  { id: 'admin', label: 'Admin', icon: ShieldCheck },
]

export default function Nav({ view, setView, pendingCount, colorMode, onToggleTheme }) {
  return (
    <nav className="top-nav">
      <button className="brand-lockup" onClick={() => setView('wall')} title="Retour au mur">
        <span className="brand-mark">
          <MonitorUp size={18} strokeWidth={2.4} />
        </span>
        <span>
          <strong>Mur Digital</strong>
          <small>SOFTWELL AI Lab</small>
        </span>
      </button>

      <div className="nav-actions" aria-label="Navigation principale">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = view === id
          return (
            <button
              key={id}
              className={`nav-button ${active ? 'is-active' : ''}`}
              onClick={() => setView(id)}
              title={label}
              aria-label={label}
            >
              <Icon size={18} strokeWidth={2.2} />
              <span>{label}</span>
              {id === 'admin' && pendingCount > 0 && <b className="nav-badge">{pendingCount}</b>}
            </button>
          )
        })}

        <button className="icon-button theme-toggle" onClick={onToggleTheme} title="Changer le thème">
          {colorMode === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </div>
    </nav>
  )
}
