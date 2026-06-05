import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowLeft, KeyRound, LogIn, ShieldCheck } from 'lucide-react'

export default function AdminLogin({ data, onLogin, onBack }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [tries, setTries] = useState(0)
  const [blocked, setBlocked] = useState(0)

  useEffect(() => {
    if (blocked <= 0) return undefined
    const timer = window.setTimeout(() => setBlocked((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [blocked])

  const login = () => {
    if (blocked > 0) return
    const adminUser = data?.adminUser || { username: 'admin', password: 'admin123' }
    if (username === adminUser.username && password === adminUser.password) {
      setError('')
      onLogin()
      return
    }

    const nextTries = tries + 1
    setTries(nextTries)
    setError(`Identifiants incorrects (${nextTries}/5)`)
    if (nextTries >= 5) {
      setBlocked(30)
      setTries(0)
      setError('Acces suspendu pendant 30 secondes.')
    }
  }

  return (
    <section className="login-screen">
      <div className="digital-background" />
      <div className="login-panel">
        <span className="status-pill">
          <ShieldCheck size={15} />
          Back-office securise
        </span>
        <h1>Administration</h1>
        <p>Gestion des contenus, de l'analyse IA et du mur live.</p>

        <label>
          Identifiant
          <span>
            <KeyRound size={16} />
            <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="admin" />
          </span>
        </label>
        <label>
          Mot de passe
          <span>
            <KeyRound size={16} />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && login()}
              placeholder="admin123"
            />
          </span>
        </label>

        {error && (
          <div className="inline-error">
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        <button className="primary-action" onClick={login} disabled={blocked > 0}>
          <LogIn size={19} />
          {blocked > 0 ? `Bloque ${blocked}s` : 'Se connecter'}
        </button>
        <button className="ghost-action" onClick={onBack}>
          <ArrowLeft size={18} />
          Retour au mur
        </button>
      </div>
    </section>
  )
}
