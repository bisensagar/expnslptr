import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { calculateSettlement } from '../lib/settlement'

export default function UserTripDetail() {
  const { tripId } = useParams()
  const { profile } = useAuth()
  const navigate    = useNavigate()

  const [trip,       setTrip]       = useState(null)
  const [members,    setMembers]    = useState([])
  const [expenses,   setExpenses]   = useState([])
  const [settlement, setSettlement] = useState([])
  const [tab,        setTab]        = useState('expenses')
  const [loading,    setLoading]    = useState(true)

  useEffect(() => { fetchAll() }, [tripId])

  async function fetchAll() {
    setLoading(true)
    const [
      { data: tripData },
      { data: membersData },
      { data: expensesData },
    ] = await Promise.all([
      supabase.from('trips').select('*').eq('id', tripId).single(),
      supabase.from('trip_members').select('*, profiles(id, name, email)').eq('trip_id', tripId),
      supabase.from('expenses')
        .select('*, profiles(id, name), expense_splits(*, profiles(id, name))')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false }),
    ])
    const m = membersData  || []
    const e = expensesData || []
    setTrip(tripData)
    setMembers(m)
    setExpenses(e)
    setSettlement(calculateSettlement(m, e))
    setLoading(false)
  }

  if (loading) return <div className="loading"><div className="spinner" /></div>
  if (!trip)   return <p style={{ padding: 32, color: 'var(--text3)' }}>Trip not found.</p>

  const total   = expenses.reduce((s, e) => s + parseFloat(e.amount), 0)
  const myId    = profile?.id
  const myName  = profile?.name

  const myPaid  = expenses
    .filter(e => e.paid_by === myId)
    .reduce((s, e) => s + parseFloat(e.amount), 0)
  const myOwed  = expenses
    .flatMap(e => e.expense_splits || [])
    .filter(s => s.user_id === myId)
    .reduce((s, sp) => s + parseFloat(sp.amount), 0)
  const myBal   = myPaid - myOwed

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '16px 32px', display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/my-trips')}>← Back</button>
        <h1 style={{ fontSize: 22, color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>
          expnspltr
        </h1>
      </header>

      <div style={{ padding: '32px', maxWidth: 1000, margin: '0 auto' }}>
        <div className="page-header">
          <div>
            <h2 className="page-title">{trip.name}</h2>
            {trip.description && <p className="page-subtitle">{trip.description}</p>}
          </div>
          {trip.settled && <span className="badge badge-green">✅ Settled</span>}
        </div>

        {/* My stats */}
        <div className="grid-3" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-label">Trip Total</div>
            <div className="stat-value" style={{ fontSize: 22 }}>
              ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">You Paid</div>
            <div className="stat-value" style={{ fontSize: 22 }}>
              ₹{myPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Your Balance</div>
            <div className="stat-value" style={{
              fontSize: 22,
              color: myBal >= 0 ? 'var(--success)' : 'var(--danger)',
            }}>
              {myBal >= 0 ? '+' : ''}₹{myBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="stat-sub">
              {myBal >  0.01 ? 'you get back'
              : myBal < -0.01 ? 'you owe'
              : '✓ you\'re settled'}
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'flex', gap: 4, marginBottom: 20,
          background: 'var(--surface)', padding: 4,
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)', width: 'fit-content',
        }}>
          {[
            { key: 'expenses', label: '💳 Expenses' },
            { key: 'members',  label: '👥 Members'  },
            { key: 'settle',   label: '⚡ Settlement' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="btn btn-sm"
              style={tab === t.key
                ? { background: 'var(--accent)', color: '#0a0a0f' }
                : { background: 'transparent', color: 'var(--text3)', border: 'none' }
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Expenses ── */}
        {tab === 'expenses' && (
          <div className="card">
            <div className="card-header"><h2 className="card-title">Expenses</h2></div>
            {expenses.length === 0 ? (
              <div className="empty-state"><div className="icon">💸</div><p>No expenses yet.</p></div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Description</th><th>Paid By</th><th>Amount</th><th>Your Share</th></tr>
                  </thead>
                  <tbody>
                    {expenses.map(exp => {
                      const myShare = (exp.expense_splits || []).find(s => s.user_id === myId)
                      return (
                        <tr key={exp.id}>
                          <td><strong>{exp.description}</strong></td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div className="avatar" style={{ width: 24, height: 24, fontSize: 11 }}>
                                {exp.profiles?.name?.[0]}
                              </div>
                              {exp.profiles?.name}
                              {exp.paid_by === myId && (
                                <span className="badge badge-yellow" style={{ fontSize: 11 }}>you</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <strong style={{ color: 'var(--accent)' }}>
                              ₹{parseFloat(exp.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </strong>
                          </td>
                          <td>
                            {myShare
                              ? <span>₹{parseFloat(myShare.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                              : <span style={{ color: 'var(--text3)' }}>—</span>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Members ── */}
        {tab === 'members' && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Members ({members.length})</h2>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {members.map(m => (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px',
                  background: 'var(--surface2)',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${m.user_id === myId ? 'var(--accent)' : 'var(--border)'}`,
                }}>
                  <div className="avatar">{m.profiles?.name?.[0]}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {m.profiles?.name}{m.user_id === myId ? ' (you)' : ''}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>{m.profiles?.email}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Settlement ── */}
        {tab === 'settle' && (
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header"><h2 className="card-title">Who Owes Whom</h2></div>
              {settlement.length === 0 ? (
                <div className="empty-state">
                  <div className="icon">🎉</div>
                  <p>All settled! No payments needed.</p>
                </div>
              ) : (
                settlement.map((s, i) => {
                  const isMe = s.from === myName || s.to === myName
                  return (
                    <div
                      key={i}
                      className="settle-row"
                      style={isMe ? {
                        background: 'rgba(240,192,64,0.04)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '14px 10px',
                      } : {}}
                    >
                      <div className="avatar">{s.from[0]}</div>
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {s.from === myName
                            ? <span style={{ color: 'var(--danger)' }}>You</span>
                            : s.from}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text3)' }}>pays</div>
                      </div>
                      <div style={{ color: 'var(--text3)', fontSize: 20 }}>→</div>
                      <div className="avatar">{s.to[0]}</div>
                      <div style={{ fontWeight: 600 }}>
                        {s.to === myName
                          ? <span style={{ color: 'var(--success)' }}>You</span>
                          : s.to}
                      </div>
                      <div className="settle-amount">
                        ₹{s.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
