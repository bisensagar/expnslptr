import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { calculateSettlement } from '../lib/settlement'

export default function TripDetail() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const [trip, setTrip] = useState(null)
  const [members, setMembers] = useState([])
  const [expenses, setExpenses] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('expenses') // expenses | members | settle
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [showMemberModal, setShowMemberModal] = useState(false)
  const [settlement, setSettlement] = useState([])

  useEffect(() => { fetchAll() }, [tripId])

  async function fetchAll() {
    setLoading(true)
    const [
      { data: tripData },
      { data: membersData },
      { data: expensesData },
      { data: usersData }
    ] = await Promise.all([
      supabase.from('trips').select('*').eq('id', tripId).single(),
      supabase.from('trip_members').select('*, profiles(id, name, email)').eq('trip_id', tripId),
      supabase.from('expenses').select('*, profiles(name), expense_splits(*, profiles(name))').eq('trip_id', tripId).order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('is_admin', false)
    ])
    setTrip(tripData)
    setMembers(membersData || [])
    setExpenses(expensesData || [])
    setAllUsers(usersData || [])
    setLoading(false)
  }

  async function settleTrip() {
    if (!confirm('Mark this trip as settled? This cannot be undone.')) return
    await supabase.from('trips').update({ settled: true }).eq('id', tripId)
    fetchAll()
  }

  function openSettle() {
    const result = calculateSettlement(members, expenses)
    setSettlement(result)
    setTab('settle')
  }

  async function removeMember(memberId, userId) {
    if (!confirm('Remove this member? Their splits will remain.')) return
    await supabase.from('trip_members').delete().eq('id', memberId)
    fetchAll()
  }

  async function deleteExpense(expenseId) {
    if (!confirm('Delete this expense?')) return
    await supabase.from('expenses').delete().eq('id', expenseId)
    fetchAll()
  }

  if (loading) return <div className="loading"><div className="spinner" /></div>
  if (!trip) return <div>Trip not found</div>

  const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0)
  const memberIds = members.map(m => m.user_id)

  return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin')} style={{marginBottom:10}}>← Back</button>
          <h1 className="page-title">{trip.name}</h1>
          {trip.description && <p className="page-subtitle">{trip.description}</p>}
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          {trip.settled
            ? <span className="badge badge-green">✅ Settled</span>
            : <button className="btn btn-success" onClick={openSettle}>⚡ Settle Up</button>
          }
        </div>
      </div>

      <div className="grid-3" style={{marginBottom:24}}>
        <div className="stat-card">
          <div className="stat-label">Total Spent</div>
          <div className="stat-value">₹{totalExpenses.toLocaleString('en-IN', {minimumFractionDigits:2})}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Expenses</div>
          <div className="stat-value">{expenses.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Members</div>
          <div className="stat-value">{members.length}</div>
        </div>
      </div>

      {/* TABS */}
      <div style={{display:'flex', gap:4, marginBottom:20, background:'var(--surface)', padding:4, borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', width:'fit-content'}}>
        {['expenses','members','settle'].map(t => (
          <button
            key={t}
            onClick={() => { if(t === 'settle') openSettle(); else setTab(t) }}
            className="btn btn-sm"
            style={tab === t ? {background:'var(--accent)',color:'#0a0a0f'} : {background:'transparent',color:'var(--text3)',border:'none'}}
          >
            {t === 'expenses' ? '💳 Expenses' : t === 'members' ? '👥 Members' : '⚡ Settle'}
          </button>
        ))}
      </div>

      {/* EXPENSES TAB */}
      {tab === 'expenses' && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Expenses</h2>
            <button className="btn btn-primary btn-sm" onClick={() => setShowExpenseModal(true)} disabled={members.length === 0}>+ Add Expense</button>
          </div>
          {members.length === 0 && (
            <div className="alert alert-error">Add members to this trip before adding expenses.</div>
          )}
          {expenses.length === 0 ? (
            <div className="empty-state"><div className="icon">💸</div><p>No expenses yet.</p></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Paid By</th>
                  <th>Amount</th>
                  <th>Split Among</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(exp => (
                  <tr key={exp.id}>
                    <td><strong>{exp.description}</strong></td>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <div className="avatar" style={{width:24,height:24,fontSize:11}}>{exp.profiles?.name?.[0]}</div>
                        {exp.profiles?.name}
                      </div>
                    </td>
                    <td><strong style={{color:'var(--accent)'}}>₹{parseFloat(exp.amount).toLocaleString('en-IN', {minimumFractionDigits:2})}</strong></td>
                    <td>
                      <div style={{fontSize:12,color:'var(--text3)'}}>
                        {exp.expense_splits?.map(s => s.profiles?.name).join(', ')}
                      </div>
                    </td>
                    <td>
                      {!trip.settled && (
                        <button className="btn btn-danger btn-sm" onClick={() => deleteExpense(exp.id)}>✕</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* MEMBERS TAB */}
      {tab === 'members' && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Members</h2>
            <button className="btn btn-primary btn-sm" onClick={() => setShowMemberModal(true)}>+ Add Member</button>
          </div>
          {members.length === 0 ? (
            <div className="empty-state"><div className="icon">👥</div><p>No members yet.</p></div>
          ) : (
            <table>
              <thead>
                <tr><th>Name</th><th>Email</th><th>Joined</th><th></th></tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id}>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <div className="avatar">{m.profiles?.name?.[0]}</div>
                        {m.profiles?.name}
                      </div>
                    </td>
                    <td style={{color:'var(--text3)'}}>{m.profiles?.email}</td>
                    <td style={{color:'var(--text3)',fontSize:13}}>{new Date(m.joined_at).toLocaleDateString()}</td>
                    <td>
                      {!trip.settled && (
                        <button className="btn btn-danger btn-sm" onClick={() => removeMember(m.id, m.user_id)}>Remove</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* SETTLE TAB */}
      {tab === 'settle' && (
        <div>
          <div className="card" style={{marginBottom:16}}>
            <div className="card-header">
              <h2 className="card-title">Settlement Summary</h2>
              {!trip.settled && (
                <button className="btn btn-success" onClick={settleTrip}>Mark as Settled</button>
              )}
            </div>
            {settlement.length === 0 ? (
              <div className="empty-state">
                <div className="icon">🎉</div>
                <p>Everyone is settled up! No payments needed.</p>
              </div>
            ) : (
              <div>
                <p style={{fontSize:14, color:'var(--text3)', marginBottom:16}}>
                  Minimum transactions to settle all debts:
                </p>
                {settlement.map((s, i) => (
                  <div key={i} className="settle-row">
                    <div className="avatar">{s.from[0]}</div>
                    <div>
                      <div style={{fontWeight:600}}>{s.from}</div>
                      <div style={{fontSize:12,color:'var(--text3)'}}>pays</div>
                    </div>
                    <div style={{color:'var(--text3)',fontSize:20}}>→</div>
                    <div className="avatar">{s.to[0]}</div>
                    <div>
                      <div style={{fontWeight:600}}>{s.to}</div>
                    </div>
                    <div className="settle-amount">₹{s.amount.toLocaleString('en-IN', {minimumFractionDigits:2})}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Per-person summary */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Per Person Breakdown</h2>
            </div>
            <table>
              <thead>
                <tr><th>Member</th><th>Total Paid</th><th>Total Owed</th><th>Balance</th></tr>
              </thead>
              <tbody>
                {members.map(m => {
                  const paid = expenses
                    .filter(e => e.paid_by === m.user_id)
                    .reduce((sum, e) => sum + parseFloat(e.amount), 0)
                  const owed = expenses
                    .flatMap(e => e.expense_splits || [])
                    .filter(s => s.user_id === m.user_id)
                    .reduce((sum, s) => sum + parseFloat(s.amount), 0)
                  const balance = paid - owed
                  return (
                    <tr key={m.id}>
                      <td>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div className="avatar">{m.profiles?.name?.[0]}</div>
                          {m.profiles?.name}
                        </div>
                      </td>
                      <td>₹{paid.toLocaleString('en-IN',{minimumFractionDigits:2})}</td>
                      <td>₹{owed.toLocaleString('en-IN',{minimumFractionDigits:2})}</td>
                      <td>
                        <span style={{color: balance >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight:600}}>
                          {balance >= 0 ? '+' : ''}₹{balance.toLocaleString('en-IN',{minimumFractionDigits:2})}
                        </span>
                        <div style={{fontSize:12,color:'var(--text3)'}}>
                          {balance > 0.01 ? 'gets back' : balance < -0.01 ? 'owes' : 'settled'}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showExpenseModal && (
        <ExpenseModal
          tripId={tripId}
          members={members}
          onClose={() => setShowExpenseModal(false)}
          onSaved={fetchAll}
        />
      )}
      {showMemberModal && (
        <MemberModal
          tripId={tripId}
          allUsers={allUsers}
          existingMemberIds={memberIds}
          onClose={() => setShowMemberModal(false)}
          onSaved={fetchAll}
        />
      )}
    </div>
  )
}

// ── ADD EXPENSE MODAL ──
function ExpenseModal({ tripId, members, onClose, onSaved }) {
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [paidBy, setPaidBy] = useState(members[0]?.user_id || '')
  const [splitAmong, setSplitAmong] = useState(members.map(m => m.user_id))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function toggleSplit(userId) {
    setSplitAmong(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  async function handleSave() {
    if (!description.trim()) { setError('Description required'); return }
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) { setError('Valid amount required'); return }
    if (!paidBy) { setError('Select who paid'); return }
    if (splitAmong.length === 0) { setError('Select at least one person to split with'); return }

    setSaving(true)
    const totalAmount = parseFloat(amount)
    const splitAmount = totalAmount / splitAmong.length

    const { data: expenseData, error: expErr } = await supabase
      .from('expenses')
      .insert({ trip_id: tripId, paid_by: paidBy, description: description.trim(), amount: totalAmount })
      .select()
      .single()

    if (expErr) { setError(expErr.message); setSaving(false); return }

    const splits = splitAmong.map(userId => ({
      expense_id: expenseData.id,
      user_id: userId,
      amount: parseFloat(splitAmount.toFixed(2))
    }))

    const { error: splitErr } = await supabase.from('expense_splits').insert(splits)
    setSaving(false)
    if (splitErr) { setError(splitErr.message); return }
    onSaved(); onClose()
  }

  const perPerson = splitAmong.length > 0 && amount
    ? (parseFloat(amount) / splitAmong.length).toFixed(2)
    : null

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2 className="modal-title">Add Expense</h2>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-group">
          <label className="form-label">Description *</label>
          <input className="form-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Hotel, Dinner, Cab fare" autoFocus />
        </div>

        <div className="form-group">
          <label className="form-label">Amount (₹) *</label>
          <input className="form-input" type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
        </div>

        <div className="form-group">
          <label className="form-label">Paid By *</label>
          <select className="form-input" value={paidBy} onChange={e => setPaidBy(e.target.value)}>
            {members.map(m => (
              <option key={m.user_id} value={m.user_id}>{m.profiles?.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Split Among</label>
          <div className="chip-list" style={{marginBottom:8}}>
            {members.map(m => (
              <label key={m.user_id} style={{cursor:'pointer'}}>
                <div
                  className="chip"
                  style={splitAmong.includes(m.user_id)
                    ? {background:'rgba(240,192,64,0.12)', borderColor:'var(--accent)', color:'var(--accent)'}
                    : {}
                  }
                  onClick={() => toggleSplit(m.user_id)}
                >
                  {splitAmong.includes(m.user_id) ? '✓ ' : ''}{m.profiles?.name}
                </div>
              </label>
            ))}
          </div>
          {perPerson && (
            <div style={{fontSize:13,color:'var(--text3)'}}>
              Each person pays: <strong style={{color:'var(--accent)'}}>₹{perPerson}</strong>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Adding…' : 'Add Expense'}</button>
        </div>
      </div>
    </div>
  )
}

// ── ADD MEMBER MODAL ──
function MemberModal({ tripId, allUsers, existingMemberIds, onClose, onSaved }) {
  const [selected, setSelected] = useState([])
  const [saving, setSaving] = useState(false)

  const available = allUsers.filter(u => !existingMemberIds.includes(u.id))

  function toggleUser(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleSave() {
    if (selected.length === 0) return
    setSaving(true)
    const rows = selected.map(userId => ({ trip_id: tripId, user_id: userId }))
    await supabase.from('trip_members').insert(rows)
    setSaving(false)
    onSaved(); onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2 className="modal-title">Add Members</h2>
        {available.length === 0 ? (
          <p style={{color:'var(--text3)',fontSize:14}}>All users are already in this trip, or no users created yet.</p>
        ) : (
          <>
            <p style={{fontSize:14,color:'var(--text3)',marginBottom:16}}>Select users to add to this trip:</p>
            {available.map(u => (
              <div
                key={u.id}
                onClick={() => toggleUser(u.id)}
                style={{
                  display:'flex', alignItems:'center', gap:12,
                  padding:'12px', borderRadius:'var(--radius-sm)',
                  border: `1px solid ${selected.includes(u.id) ? 'var(--accent)' : 'var(--border)'}`,
                  background: selected.includes(u.id) ? 'rgba(240,192,64,0.08)' : 'var(--surface2)',
                  cursor:'pointer', marginBottom:8, transition:'all 0.15s'
                }}
              >
                <div className="avatar">{u.name[0]}</div>
                <div>
                  <div style={{fontWeight:600,fontSize:14}}>{u.name}</div>
                  <div style={{fontSize:12,color:'var(--text3)'}}>{u.email}</div>
                </div>
                {selected.includes(u.id) && <span style={{marginLeft:'auto',color:'var(--accent)'}}>✓</span>}
              </div>
            ))}
          </>
        )}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || selected.length === 0}>
            {saving ? 'Adding…' : `Add ${selected.length > 0 ? selected.length : ''} Member${selected.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
