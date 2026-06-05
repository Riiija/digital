import { useEffect, useMemo, useState } from 'react'
import AdminLogin from './components/AdminLogin.jsx'
import AdminView from './components/AdminView.jsx'
import InputView from './components/InputView.jsx'
import Nav from './components/Nav.jsx'
import WallView from './components/WallView.jsx'
import { getStorage, initData, setStorage } from './storage.js'

export default function App() {
  const [data, setData] = useState(() => initData())
  const [view, setView] = useState('wall')
  const [loggedIn, setLoggedIn] = useState(() => Boolean(getStorage()?.session?.isAdminLoggedIn))

  useEffect(() => {
    const sync = () => {
      const fresh = getStorage()
      if (fresh) setData(fresh)
    }
    window.addEventListener('mur-digital:storage', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('mur-digital:storage', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  useEffect(() => {
    const config = data.displayConfig || {}
    document.documentElement.dataset.theme = config.colorMode || 'dark'
    document.documentElement.style.setProperty('--brand', config.primaryColor || '#2dd4bf')
    document.documentElement.style.setProperty('--accent', config.accentColor || '#7c3aed')
  }, [data.displayConfig])

  const pendingCount = useMemo(
    () => data.contributions.filter((contribution) => contribution.status === 'pending').length,
    [data.contributions],
  )

  const persist = (nextData) => {
    setStorage(nextData)
    setData(nextData)
  }

  const handleSetView = (nextView) => {
    if (nextView === 'admin' && !loggedIn) {
      setView('login')
      return
    }
    setView(nextView)
  }

  const handleLogin = () => {
    const nextData = {
      ...data,
      session: { ...(data.session || {}), isAdminLoggedIn: true },
    }
    persist(nextData)
    setLoggedIn(true)
    setView('admin')
  }

  const handleLogout = () => {
    const nextData = {
      ...data,
      session: { ...(data.session || {}), isAdminLoggedIn: false },
    }
    persist(nextData)
    setLoggedIn(false)
    setView('wall')
  }

  const toggleTheme = () => {
    const nextMode = data.displayConfig?.colorMode === 'light' ? 'dark' : 'light'
    persist({
      ...data,
      displayConfig: {
        ...data.displayConfig,
        colorMode: nextMode,
      },
    })
  }

  return (
    <div className="app-shell">
      <Nav
        view={view === 'login' ? 'admin' : view}
        setView={handleSetView}
        pendingCount={pendingCount}
        colorMode={data.displayConfig?.colorMode || 'dark'}
        onToggleTheme={toggleTheme}
      />
      <main>
        {view === 'wall' && <WallView data={data} setData={setData} />}
        {view === 'input' && <InputView data={data} setData={setData} />}
        {view === 'login' && <AdminLogin data={data} onLogin={handleLogin} onBack={() => setView('wall')} />}
        {view === 'admin' && loggedIn && (
          <AdminView data={data} setData={setData} onLogout={handleLogout} />
        )}
      </main>
    </div>
  )
}
