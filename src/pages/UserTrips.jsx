import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function UserTrips() {
  const { profile, signOut } = useAuth()
  const [trips,   setTrips]   = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    if (profile?.id) fetchTrips()
  }, [profile?.id])

  async function fetchTrips() {
    const { data } = await supabase
      .from('trip_members')
      .select('trips(*)')
      .eq('user_id', profile.id)
      .order('joined_at', { ascending: false })
    setTrips((data || []).map(row => row.trips).filter(Boolean))
    setLoading(false)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '16px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <h1 style={{ fontSize: 22, color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>
          expnspltr
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{profile?.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{profile?.email}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>Sign out</button>
        </div>
      </header>

      <div style={{ padding: '32px', maxWidth: 900, margin: '0 auto' }}>
        <div className="page-header">
          <div>
            <h2 className="page-title">My Trips</h2>
            <p className="page-subtitle">Trips you've been added to</p>
          </div>
        </div>

        {loading ? (
          <div className="loading" style={{ minHeight: 'auto', paddingTop: 60 }}>
            <div className="spinner" />
          </div>
        ) : trips.length === 0 ? (
          <div className="empty-state" style={{ paddingTop: 80 }}>
            <div className="icon">✈️</div>
            <p style={{ fontSize: 16, marginBottom: 8 }}>No trips yet</p>
            <p>Ask your admin to add you to a trip.</p>
          </div>
        ) : (
          <div className="grid-2">
            {trips.map(trip => (
              <div
                key={trip.id}
                className="trip-card"
                onClick={() => navigate(`/my-trips/${trip.id}`)}
              >
                <div className="trip-card-name">{trip.name}</div>
                {trip.description && (
                  <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 8 }}>
                    {trip.description}
                  </div>
                )}
                <div className="trip-card-meta">
                  <span>{trip.settled ? '✅ Settled' : '🟡 Active'}</span>
                  <span>{new Date(trip.created_at).toLocaleDateString('en-IN')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
