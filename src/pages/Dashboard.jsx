import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const [trips,         setTrips]         = useState([])
  const [users,         setUsers]         = useState([])
  const [loading,       setLoading]       = useState(true)
  const [showTripModal, setShowTripModal] = useState(false)
  const [showUserModal, setShowUserModal] = useState(false)
  const navigate = useNavigate()

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const [{ data: tripsData }, { data: usersData }] = await Promise.all([
      supabase
        .from('trips')
        .select('*, trip_members(count)')
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('*')
        .eq('is_admin', false)
        .order('name'),
    ])
    setTrips(tripsData  || [])
    setUsers(usersData  || [])
    setLoading(false)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Manage trips and members</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost"   onClick={() => setShowUserModal(true)}>+ Add User</button>
          <button className="btn btn-primary" onClick={() => setShowTripModal(true)}>+ New Trip</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid-3" style={{ marginBottom: 28 }}>
        <div className="stat-card">
          <div className="stat-label">Total Trips</div>
          <div className="stat-value">{trips.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Users</div>
          <div className="stat-value">{users.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Trips</div>
          <div className="stat-value">{trips.filter(t => !t.settled).length}</div>
        </div>
      </div>

      {/* Trips */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h2 className="card-title">Trips / Projects</h2>
        </div>
        {loading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : trips.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🗺️</div>
            <p>No trips yet. Create your first one!</p>
          </div>
        ) : (
          <div className="grid-2">
            {trips.map(trip => (
              <div
                key={trip.id}
                className="trip-card"
                onClick={() => navigate(`/admin/trips/${trip.id}`)}
              >
                <div className="trip-card-name">{trip.name}</div>
                {trip.description && (
                  <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 8 }}>
                    {trip.description}
                  </div>
                )}
                <div className="trip-card-meta">
                  <span>👥 {trip.trip_members?.[0]?.count ?? 0} members</span>
                  <span>{trip.settled ? '✅ Settled' : '🟡 Active'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Users */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Users</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowUserModal(true)}>+ Add</button>
        </div>
        {loading ? null : users.length === 0 ? (
          <div className="empty-state">
            <div className="icon">👤</div>
            <p>No users yet. Add your first user!</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="avatar">{u.name?.[0]?.toUpperCase()}</div>
                        {u.name}
                      </div>
                    </td>
                    <td style={{ color: 'var(--text3)' }}>{u.email}</td>
                    <td style={{ color: 'var(--text3)', fontSize: 13 }}>
                      {new Date(u.created_at).toLocaleDateString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showTripModal && (
        <TripModal onClose={() => setShowTripModal(false)} onSaved={fetchData} />
      )}
      {showUserModal && (
        <UserModal onClose={() => setShowUserModal(false)} onSaved={fetchData} />
      )}
    </div>
  )
}

/* ─── CREATE TRIP MODAL ─────────────────────────────────────────────────── */
function TripModal({ onClose, onSaved }) {
  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  async function handleSave() {
    if (!name.trim()) { setError("Trip name is required"); return }
    setSaving(true)
    setError("")
    const { error: err } = await supabase
      .from("trips")
      .insert({ name: name.trim(), description: description.trim() })
      .select()
    setSaving(false)
    if (err) {
      console.error("Trip insert error:", err)
      setError(`Error: ${err.message} (code: ${err.code})`)
      return
    }
    onSaved()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2 className="modal-title">Create New Trip</h2>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-group">
          <label className="form-label">Trip / Project Name *</label>
          <input
            className="form-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Goa 2025, Office Lunch"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Description (optional)</label>
          <textarea
            className="form-input"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="A short description"
            rows={3}
          />
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost"   onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Creating…' : 'Create Trip'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── CREATE USER MODAL ─────────────────────────────────────────────────── */
/*
  Uses supabase.auth.signUp() — works from the browser with the anon key.
  IMPORTANT: In Supabase Dashboard → Authentication → Providers → Email,
  turn OFF "Confirm email" so users can log in immediately without
  verifying their inbox.
*/
function UserModal({ onClose, onSaved }) {
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')

  async function handleSave() {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('All fields are required'); return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters'); return
    }
    setSaving(true)
    setError('')

    const { data, error: signUpErr } = await supabase.auth.signUp({
      email:    email.trim().toLowerCase(),
      password: password.trim(),
      options:  { data: { name: name.trim(), is_admin: false } },
    })

    if (signUpErr) {
      setError(signUpErr.message)
      setSaving(false)
      return
    }

    // Upsert profile row in case the trigger fires before metadata is set
    if (data?.user?.id) {
      const { error: profileErr } = await supabase.from('profiles').upsert(
        { id: data.user.id, name: name.trim(), email: email.trim().toLowerCase(), is_admin: false },
        { onConflict: 'id' }
      )
      if (profileErr) console.warn('Profile upsert warning:', profileErr.message)
    }

    setSaving(false)
    setSuccess(`✅ User "${name}" created! Credentials — Email: ${email.trim().toLowerCase()}  Password: ${password.trim()}`)
    setTimeout(() => { onSaved(); onClose() }, 4000)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2 className="modal-title">Add New User</h2>
        {error   && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <div style={{
          padding: '10px 14px',
          background: 'rgba(64,144,240,0.08)',
          border: '1px solid rgba(64,144,240,0.2)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 13, color: '#80b0f0', marginBottom: 16
        }}>
          💡 User logs in with the email + password you set here. Share these credentials directly.
        </div>

        <div className="form-group">
          <label className="form-label">Full Name *</label>
          <input
            className="form-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Rahul Sharma"
            autoFocus
            disabled={!!success}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Email *</label>
          <input
            className="form-input"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="rahul@example.com"
            disabled={!!success}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Password * (min 6 chars)</label>
          <input
            className="form-input"
            type="text"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Share this with the user"
            disabled={!!success}
          />
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost"   onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !!success}
          >
            {saving ? 'Creating…' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  )
}
