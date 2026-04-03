import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: signInError } = await signIn(email.trim().toLowerCase(), password)
    setLoading(false)
    if (signInError) {
      setError('Invalid email or password. Please try again.')
      return
    }
    // Navigation handled by App.jsx via auth state change + profile.is_admin check
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
          marginTop: 24,
          padding: '14px 16px',
          background: 'var(--surface2)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 13,
          color: 'var(--text3)'
        }}>
          <strong style={{ color: 'var(--text2)' }}>New here?</strong> Your admin creates your account and shares your credentials.
        </div>
      </div>
    </div>
  )
}
