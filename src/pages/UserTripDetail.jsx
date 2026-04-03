import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { calculateSettlement } from '../lib/settlement'

export default function UserTripDetail() {
  const { tripId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [trip, setTrip] = useState(null)
  const [members, setMembers] = useState([])
  const [expenses, setExpenses] = useState([])
  const [tab, setTab] = useState('expenses')
  const [settlement, setSettlement] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [tripId])

  async function fetchAll() {
    setLoading(true)
    const [
      { data: tripData },
      { data: membersData },
      { data: expensesData }
    ] = await Promise.all([
      supabase.from('trips').select('*').eq('id', tripId).single(),
      supabase.from('trip_members').select('*, profiles(id, name, email)').eq('trip_id', tripId),
      supabase.from('expenses').select('*, profiles(name), expense_splits(*, profiles(name))').eq('trip_id', tripId).order('created_at', { ascending: false })
    ])
    setTrip(tripData)
    setMembers(membersData || [])
    setExpenses(expensesData || [])
    setSettlement(calculateSettlement(membersData || [], expensesData || []))
    setLoading(false)
  }

  if (loading) return <div className="loading"><div className="spinner" /></div>
  if (!trip) return <div>Trip not found</div>

  const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0)

  const myMember = members.find(m => m.user_id === profile?.id)
  const myPaid = expenses.filter(e => e.paid_by === profile?.id).reduce((s,e) => s + parseFloat(e.amount), 0)
  const myOwed = expenses.flatMap(e => e.expense_splits||[]).filter(s => s.user_id === profile?.id).reduce((s,sp) => s + parseFloat(sp.amount), 0)
  const myBalance = myPaid - myOwed

  return (
    <div style={{minHeight:'100vh', background:'var(--bg)'}}>
      <header style={{background:'var(--surface)', borderBottom:'1px solid var(--border)', padding:'16px 32px', display:'flex', alignItems:'center', gap:16}}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/my-trips')}>← Back</button>
        <h1 style={{fontSize:22, color:'var(--accent)', fontFamily:'var(--font-display)'}}>expnspltr</h1>
      </header>

      <div style={{padding:'32px', maxWidth:1000, margin:'0 auto'}}>
        <div className="page-header">
          <div>
            <h2 className="page-title">{trip.name}</h2>
            {trip.description && <p className="page-subtitle">{trip.description}</p>}
          </div>
          {trip.settled && <span className="badge badge-green">✅ Settled</span>}
        </div>

        {/* My summary */}
        <div className="grid-3" style={{marginBottom:24}}>
          <div className="stat-card">
            <div className="stat-label">Trip Total</div>
            <div className="stat-value" style={{fontSize:22}}>₹{totalExpenses.toLocaleString('en-IN',{minimumFractionDigits:2})}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">You Paid</div>
            <div className="stat-value" style={{fontSize:22}}>₹{myPaid.toLocaleString('en-IN',{minimumFractionDigits:2})}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Your Balance</div>
            <div className="stat-value" style={{fontSize:22, color: myBalance >= 0 ? 'var(--success)' : 'var(--danger)'}}>
              {myBalance >= 0 ? '+' : ''}₹{myBalance.toLocaleString('en-IN',{minimumFractionDigits:2})}
            </div>
            <div className="stat-sub">{myBalance > 0.01 ? 'you get back' : myBalance < -0.01 ? 'you owe' : '✓ settled'}</div>
          </div>
        </div>

        {/* TABS */}
        <div style={{display:'flex',gap:4,marginBottom:20,background:'var(--surface)',padding:4,borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',width:'fit-content'}}>
          {['expenses','members','settle'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="btn btn-sm"
              style={tab === t ? {background:'var(--accent)',color:'#0a0a0f'} : {background:'transparent',color:'var(--text3)',border:'none'}}
            >
              {t === 'expenses' ? '💳 Expenses' : t === 'members' ? '👥 Members' : '⚡ Settlement'}
            </button>
          ))}
        </div>

        {/* EXPENSES */}
        {tab === 'expenses' && (
          <div className="card">
            <div className="card-header"><h2 className="card-title">Expenses</h2></div>
            {expenses.length === 0 ? (
              <div className="empty-state"><div className="icon">💸</div><p>No expenses yet.</p></div>
            ) : (
              <table>
                <thead>
                  <tr><th>Description</th><th>Paid By</th><th>Amount</th><th>Your Share</th></tr>
                </thead>
                <tbody>
                  {expenses.map(exp => {
                    const myShare = exp.expense_splits?.find(s => s.user_id === profile?.id)
                    return (
                      <tr key={exp.id}>
                        <td><strong>{exp.description}</strong></td>
                        <td>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <div className="avatar" style={{width:24,height:24,fontSize:11}}>{exp.profiles?.name?.[0]}</div>
                            {exp.profiles?.name}
                            {exp.paid_by === profile?.id && <span className="badge badge-yellow" style={{fontSize:11}}>you</span>}
                          </div>
                        </td>
                        <td><strong style={{color:'var(--accent)'}}>₹{parseFloat(exp.amount).toLocaleString('en-IN',{minimumFractionDigits:2})}</strong></td>
                        <td>
                          {myShare
                            ? <span style={{color:'var(--text2)'}}>₹{parseFloat(myShare.amount).toLocaleString('en-IN',{minimumFractionDigits:2})}</span>
                            : <span style={{color:'var(--text3)'}}>—</span>
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* MEMBERS */}
        {tab === 'members' && (
          <div className="card">
            <div className="card-header"><h2 className="card-title">Members ({members.length})</h2></div>
            <div style={{display:'flex',flexWrap:'wrap',gap:12}}>
              {members.map(m => (
                <div key={m.id} style={{
                  display:'flex',alignItems:'center',gap:10,
                  padding:'10px 14px',
                  background:'var(--surface2)',
                  borderRadius:'var(--radius-sm)',
                  border:`1px solid ${m.user_id === profile?.id ? 'var(--accent)' : 'var(--border)'}`,
                }}>
                  <div className="avatar">{m.profiles?.name?.[0]}</div>
                  <div>
                    <div style={{fontWeight:600,fontSize:14}}>{m.profiles?.name} {m.user_id === profile?.id && '(you)'}</div>
                    <div style={{fontSize:12,color:'var(--text3)'}}>{m.profiles?.email}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SETTLEMENT */}
        {tab === 'settle' && (
          <div>
            <div className="card" style={{marginBottom:16}}>
              <div className="card-header"><h2 className="card-title">Who Owes Whom</h2></div>
              {settlement.length === 0 ? (
                <div className="empty-state"><div className="icon">🎉</div><p>All settled! No payments needed.</p></div>
              ) : (
                <>
                  {settlement.map((s, i) => (
                    <div key={i} className="settle-row" style={
                      (s.from === profile?.name || s.to === profile?.name)
                        ? {background:'rgba(240,192,64,0.04)', borderRadius:'var(--radius-sm)', padding:'14px 10px'}
                        : {}
                    }>
                      <div className="avatar">{s.from[0]}</div>
                      <div>
                        <div style={{fontWeight:600}}>
                          {s.from === profile?.name ? <span style={{color:'var(--danger)'}}>You</span> : s.from}
                        </div>
                        <div style={{fontSize:12,color:'var(--text3)'}}>pays</div>
                      </div>
                      <div style={{color:'var(--text3)',fontSize:20}}>→</div>
                      <div className="avatar">{s.to[0]}</div>
                      <div>
                        <div style={{fontWeight:600}}>
                          {s.to === profile?.name ? <span style={{color:'var(--success)'}}>You</span> : s.to}
                        </div>
                      </div>
                      <div className="settle-amount">₹{s.amount.toLocaleString('en-IN',{minimumFractionDigits:2})}</div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
