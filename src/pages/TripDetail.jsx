import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { calculateSettlement } from '../lib/settlement'

export default function TripDetail() {
  const { tripId } = useParams()
  const navigate   = useNavigate()

  const [trip,       setTrip]       = useState(null)
  const [members,    setMembers]    = useState([])   // [{id, user_id, joined_at, name, email}]
  const [expenses,   setExpenses]   = useState([])
  const [allUsers,   setAllUsers]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [tab,        setTab]        = useState('expenses')
  const [settlement, setSettlement] = useState([])
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [showMemberModal,  setShowMemberModal]  = useState(false)

  useEffect(() => { fetchAll() }, [tripId])

  async function fetchAll() {
    setLoading(true)
    try {
      // ── 1. Trip ──────────────────────────────────────────────────────────
      const { data: tripData, error: tripErr } = await supabase
        .from('trips').select('*').eq('id', tripId).single()
      if (tripErr) { console.error('trip fetch:', tripErr); setLoading(false); return }

      // ── 2. Trip member rows (just IDs + metadata, no join) ───────────────
      const { data: tmRows, error: tmErr } = await supabase
        .from('trip_members')
        .select('id, trip_id, user_id, joined_at')
        .eq('trip_id', tripId)
      if (tmErr) console.error('trip_members fetch:', tmErr)
      const tmList = tmRows || []

      // ── 3. All non-admin profiles (one query, admin can read all) ────────
      const { data: profilesData, error: profErr } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('is_admin', false)
        .order('name')
      if (profErr) console.error('profiles fetch:', profErr)
      const profileMap = {}
      ;(profilesData || []).forEach(p => { profileMap[p.id] = p })

      // ── 4. Merge members with their profile data ──────────────────────────
      const members = tmList.map(tm => ({
        id:        tm.id,
        trip_id:   tm.trip_id,
        user_id:   tm.user_id,
        joined_at: tm.joined_at,
        name:      profileMap[tm.user_id]?.name  || 'Unknown',
        email:     profileMap[tm.user_id]?.email || '',
      }))

      // ── 5. Expenses (no nested join — fetch splits separately) ────────────
      const { data: expData, error: expErr } = await supabase
        .from('expenses')
        .select('id, trip_id, paid_by, description, amount, created_at')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false })
      if (expErr) console.error('expenses fetch:', expErr)
      const expList = expData || []

      // ── 6. Splits for all expenses in this trip ───────────────────────────
      let splits = []
      if (expList.length > 0) {
        const expIds = expList.map(e => e.id)
        const { data: splitsData, error: splitErr } = await supabase
          .from('expense_splits')
          .select('id, expense_id, user_id, amount')
          .in('expense_id', expIds)
        if (splitErr) console.error('splits fetch:', splitErr)
        splits = splitsData || []
      }

      // ── 7. Merge expenses with splits + payer name ────────────────────────
      const expenses = expList.map(exp => ({
        ...exp,
        payer_name:     profileMap[exp.paid_by]?.name || 'Unknown',
        expense_splits: splits
          .filter(s => s.expense_id === exp.id)
          .map(s => ({ ...s, name: profileMap[s.user_id]?.name || 'Unknown' })),
      }))

      // ── 8. All users available to add as members ──────────────────────────
      const allUsers = (profilesData || [])

      setTrip(tripData)
      setMembers(members)
      setExpenses(expenses)
      setAllUsers(allUsers)
      setSettlement(calculateSettlement(members, expenses))
    } catch (err) {
      console.error('fetchAll unexpected error:', err)
    }
    setLoading(false)
  }

  async function deleteTrip() {
    if (!window.confirm('Delete this entire trip and all its expenses? Cannot be undone.')) return
    const { error } = await supabase.from('trips').delete().eq('id', tripId)
    if (error) { alert('Delete failed: ' + error.message); return }
    navigate('/admin')
  }

  async function settleTrip() {
    if (!window.confirm('Mark this trip as settled? Cannot be undone.')) return
    const { error } = await supabase.from('trips').update({ settled: true }).eq('id', tripId)
    if (error) { alert('Failed: ' + error.message); return }
    fetchAll()
  }

  async function deleteExpense(expenseId) {
    if (!window.confirm('Delete this expense?')) return
    const { error } = await supabase.from('expenses').delete().eq('id', expenseId)
    if (error) { alert('Delete failed: ' + error.message); return }
    fetchAll()
  }

  async function removeMember(memberId) {
    if (!window.confirm('Remove this member from the trip?')) return
    const { error } = await supabase.from('trip_members').delete().eq('id', memberId)
    if (error) { alert('Remove failed: ' + error.message); return }
    fetchAll()
  }

  if (loading) return <div className="loading"><div className="spinner" /></div>
  if (!trip)   return <p style={{ padding: 32, color: 'var(--text3)' }}>Trip not found.</p>

  const total     = expenses.reduce((s, e) => s + parseFloat(e.amount), 0)
  const memberIds = members.map(m => m.user_id)

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin')} style={{ marginBottom: 10 }}>
            ← Back
          </button>
          <h1 className="page-title">{trip.name}</h1>
          {trip.description && <p className="page-subtitle">{trip.description}</p>}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {trip.settled ? (
            <span className="badge badge-green">✅ Settled</span>
          ) : (
            <>
              <button className="btn btn-success" onClick={() => { setSettlement(calculateSettlement(members, expenses)); setTab('settle') }}>
                ⚡ Settle Up
              </button>
              <button className="btn btn-danger btn-sm" onClick={deleteTrip}>🗑 Delete</button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Total Spent</div>
          <div className="stat-value">₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
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

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--surface)', padding: 4, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', width: 'fit-content' }}>
        {[
          { key: 'expenses', label: '💳 Expenses' },
          { key: 'members',  label: '👥 Members'  },
          { key: 'settle',   label: '⚡ Settle'   },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => {
              if (t.key === 'settle') { setSettlement(calculateSettlement(members, expenses)) }
              setTab(t.key)
            }}
            className="btn btn-sm"
            style={tab === t.key
              ? { background: 'var(--accent)', color: '#0a0a0f' }
              : { background: 'transparent', color: 'var(--text3)', border: 'none' }
            }
          >{t.label}</button>
        ))}
      </div>

      {/* ── EXPENSES TAB ── */}
      {tab === 'expenses' && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Expenses</h2>
            {!trip.settled && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowExpenseModal(true)} disabled={members.length === 0}>
                + Add Expense
              </button>
            )}
          </div>
          {members.length === 0 && (
            <div className="alert alert-error" style={{ marginBottom: 16 }}>
              ⚠️ Add members first before adding expenses.
            </div>
          )}
          {expenses.length === 0 ? (
            <div className="empty-state"><div className="icon">💸</div><p>No expenses yet.</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Description</th><th>Paid By</th><th>Amount</th><th>Split Among</th><th></th></tr>
                </thead>
                <tbody>
                  {expenses.map(exp => (
                    <tr key={exp.id}>
                      <td><strong>{exp.description}</strong></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="avatar" style={{ width: 24, height: 24, fontSize: 11 }}>
                            {exp.payer_name?.[0]}
                          </div>
                          {exp.payer_name}
                        </div>
                      </td>
                      <td><strong style={{ color: 'var(--accent)' }}>₹{parseFloat(exp.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
                      <td style={{ fontSize: 12, color: 'var(--text3)' }}>
                        {exp.expense_splits.map(s => s.name).filter(Boolean).join(', ')}
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
            </div>
          )}
        </div>
      )}

      {/* ── MEMBERS TAB ── */}
      {tab === 'members' && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Members ({members.length})</h2>
            {!trip.settled && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowMemberModal(true)}>
                + Add Member
              </button>
            )}
          </div>
          {members.length === 0 ? (
            <div className="empty-state"><div className="icon">👥</div><p>No members yet.</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Joined</th><th></th></tr>
                </thead>
                <tbody>
                  {members.map(m => (
                    <tr key={m.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="avatar">{m.name?.[0]?.toUpperCase()}</div>
                          {m.name}
                        </div>
                      </td>
                      <td style={{ color: 'var(--text3)' }}>{m.email}</td>
                      <td style={{ color: 'var(--text3)', fontSize: 13 }}>{new Date(m.joined_at).toLocaleDateString('en-IN')}</td>
                      <td>
                        {!trip.settled && (
                          <button className="btn btn-danger btn-sm" onClick={() => removeMember(m.id)}>Remove</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── SETTLE TAB ── */}
      {tab === 'settle' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <h2 className="card-title">Settlement Summary</h2>
              {!trip.settled && (
                <button className="btn btn-success" onClick={settleTrip}>✅ Mark as Settled</button>
              )}
            </div>
            {settlement.length === 0 ? (
              <div className="empty-state"><div className="icon">🎉</div><p>Everyone is square! No payments needed.</p></div>
            ) : (
              <>
                <p style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 16 }}>Minimum transactions to settle all debts:</p>
                {settlement.map((s, i) => (
                  <div key={i} className="settle-row">
                    <div className="avatar">{s.from[0]}</div>
                    <div><div style={{ fontWeight: 600 }}>{s.from}</div><div style={{ fontSize: 12, color: 'var(--text3)' }}>pays</div></div>
                    <div style={{ color: 'var(--text3)', fontSize: 20 }}>→</div>
                    <div className="avatar">{s.to[0]}</div>
                    <div style={{ fontWeight: 600 }}>{s.to}</div>
                    <div className="settle-amount">₹{s.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Per-person breakdown */}
          <div className="card">
            <div className="card-header"><h2 className="card-title">Per-Person Breakdown</h2></div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Member</th><th>Total Paid</th><th>Share Owed</th><th>Balance</th></tr>
                </thead>
                <tbody>
                  {members.map(m => {
                    const paid = expenses.filter(e => e.paid_by === m.user_id).reduce((s, e) => s + parseFloat(e.amount), 0)
                    const owed = expenses.flatMap(e => e.expense_splits).filter(s => s.user_id === m.user_id).reduce((s, sp) => s + parseFloat(sp.amount), 0)
                    const bal  = paid - owed
                    return (
                      <tr key={m.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="avatar">{m.name?.[0]}</div>{m.name}
                          </div>
                        </td>
                        <td>₹{paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td>₹{owed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td>
                          <span style={{ color: bal >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                            {bal >= 0 ? '+' : ''}₹{bal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                            {bal > 0.01 ? 'gets back' : bal < -0.01 ? 'owes' : '✓ even'}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showExpenseModal && (
        <ExpenseModal tripId={tripId} members={members} onClose={() => setShowExpenseModal(false)} onSaved={fetchAll} />
      )}
      {showMemberModal && (
        <MemberModal tripId={tripId} allUsers={allUsers} existingMemberIds={memberIds} onClose={() => setShowMemberModal(false)} onSaved={fetchAll} />
      )}
    </div>
  )
}

/* ─── ADD EXPENSE MODAL ─────────────────────────────────────────────────── */
function ExpenseModal({ tripId, members, onClose, onSaved }) {
  const [description, setDescription] = useState('')
  const [amount,      setAmount]      = useState('')
  const [paidBy,      setPaidBy]      = useState(members[0]?.user_id || '')
  const [splitAmong,  setSplitAmong]  = useState(members.map(m => m.user_id))
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  const toggle = id => setSplitAmong(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  async function handleSave() {
    if (!description.trim())               { setError('Description is required'); return }
    const amt = parseFloat(amount)
    if (!amount || isNaN(amt) || amt <= 0) { setError('Enter a valid amount'); return }
    if (splitAmong.length === 0)           { setError('Select at least one person to split with'); return }

    setSaving(true)
    setError('')
    const splitAmt = parseFloat((amt / splitAmong.length).toFixed(2))

    const { data: expRow, error: expErr } = await supabase
      .from('expenses')
      .insert({ trip_id: tripId, paid_by: paidBy, description: description.trim(), amount: amt })
      .select('id').single()

    if (expErr) { setError('Failed to add expense: ' + expErr.message); setSaving(false); return }

    const { error: splitErr } = await supabase.from('expense_splits').insert(
      splitAmong.map(uid => ({ expense_id: expRow.id, user_id: uid, amount: splitAmt }))
    )

    setSaving(false)
    if (splitErr) { setError('Failed to save splits: ' + splitErr.message); return }
    onSaved(); onClose()
  }

  const perPerson = splitAmong.length > 0 && amount
    ? (parseFloat(amount) / splitAmong.length).toFixed(2) : null

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2 className="modal-title">Add Expense</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-group">
          <label className="form-label">Description *</label>
          <input className="form-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Hotel, Dinner, Cab" autoFocus />
        </div>
        <div className="form-group">
          <label className="form-label">Amount (₹) *</label>
          <input className="form-input" type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
        </div>
        <div className="form-group">
          <label className="form-label">Paid By *</label>
          <select className="form-input" value={paidBy} onChange={e => setPaidBy(e.target.value)}>
            {members.map(m => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Split Among</label>
          <div className="chip-list" style={{ marginBottom: 8 }}>
            {members.map(m => (
              <div key={m.user_id} className="chip"
                style={splitAmong.includes(m.user_id)
                  ? { background: 'rgba(240,192,64,0.12)', borderColor: 'var(--accent)', color: 'var(--accent)', cursor: 'pointer' }
                  : { cursor: 'pointer' }}
                onClick={() => toggle(m.user_id)}>
                {splitAmong.includes(m.user_id) ? '✓ ' : ''}{m.name}
              </div>
            ))}
          </div>
          {perPerson && <div style={{ fontSize: 13, color: 'var(--text3)' }}>Each person: <strong style={{ color: 'var(--accent)' }}>₹{perPerson}</strong></div>}
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Adding…' : 'Add Expense'}</button>
        </div>
      </div>
    </div>
  )
}

/* ─── ADD MEMBER MODAL ──────────────────────────────────────────────────── */
function MemberModal({ tripId, allUsers, existingMemberIds, onClose, onSaved }) {
  const [selected, setSelected] = useState([])
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  const available = allUsers.filter(u => !existingMemberIds.includes(u.id))
  const toggle    = id => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  async function handleSave() {
    if (selected.length === 0) return
    setSaving(true)
    setError('')
    const { error: err } = await supabase
      .from('trip_members')
      .insert(selected.map(uid => ({ trip_id: tripId, user_id: uid })))
    setSaving(false)
    if (err) { setError('Failed: ' + err.message); return }
    onSaved(); onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2 className="modal-title">Add Members</h2>
        {error && <div className="alert alert-error">{error}</div>}
        {available.length === 0 ? (
          <div className="empty-state" style={{ paddingTop: 20 }}>
            <div className="icon">👥</div>
            <p>All users are already in this trip.</p>
            <p style={{ marginTop: 8, fontSize: 13 }}>Go to Dashboard → Add User to create new users first.</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 16 }}>Select users to add:</p>
            {available.map(u => (
              <div key={u.id} onClick={() => toggle(u.id)} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: 12,
                borderRadius: 'var(--radius-sm)', marginBottom: 8, cursor: 'pointer', transition: 'all 0.15s',
                border: `1px solid ${selected.includes(u.id) ? 'var(--accent)' : 'var(--border)'}`,
                background: selected.includes(u.id) ? 'rgba(240,192,64,0.08)' : 'var(--surface2)',
              }}>
                <div className="avatar">{u.name?.[0]?.toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{u.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{u.email}</div>
                </div>
                {selected.includes(u.id) && <span style={{ color: 'var(--accent)', fontSize: 18 }}>✓</span>}
              </div>
            ))}
          </>
        )}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || selected.length === 0}>
            {saving ? 'Adding…' : selected.length > 0 ? `Add ${selected.length} Member${selected.length !== 1 ? 's' : ''}` : 'Select Members'}
          </button>
        </div>
      </div>
    </div>
  )
}
