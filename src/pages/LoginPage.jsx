import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const { signIn, user, profile } = useAuth()
  const navigate = useNavigate()

  // Redirect if already logged in
  useEffect(() => {
    if (!user) return
    if (profile?.is_admin) navigate('/admin',    { replace: true })
    else                   navigate('/my-trips', { replace: true })
  }, [user, profile])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await signIn(email.trim().toLowerCase(), password)
    setLoading(false)
    if (err) setError(err.message)
    // navigation is handled by the useEffect above once profile loads
  }

  return (
    <div className="login-page">
      <div className="login-bg" />
      <div className="login-card">
        <div className="login-logo">
          <h1>expnspltr</h1>
          <p>Split expenses. No drama.</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email address</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>
          <button
            className="btn btn-primary btn-lg"
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            type="submit"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign in →'}
          </button>
        </form>

        <div style={{
          marginTop: 24, padding: 14,
          background: 'var(--surface2)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 13, color: 'var(--text3)'
        }}>
          <strong style={{ color: 'var(--text2)' }}>First time?</strong>
          {' '}Your admin sets up your account and shares your login details.
        </div>
      </div>
    </div>
  )
}
