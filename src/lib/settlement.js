/**
 * Minimum-transactions settlement algorithm.
 *
 * @param {Array} members  – trip_members rows (each has .user_id and .profiles.name)
 * @param {Array} expenses – expenses rows (each has .paid_by and .expense_splits[])
 * @returns {Array} [{ from, to, amount }]
 */
export function calculateSettlement(members, expenses) {
  const balance = {}   // userId -> net amount (positive = owed, negative = owes)
  const nameOf  = {}

  members.forEach(m => {
    balance[m.user_id] = 0
    nameOf[m.user_id]  = m.profiles?.name || 'Unknown'
  })

  expenses.forEach(exp => {
    const payer  = exp.paid_by
    const splits = exp.expense_splits || []
    splits.forEach(s => {
      if (s.user_id === payer) return          // payer's own share cancels out
      balance[payer]    = (balance[payer]    || 0) + parseFloat(s.amount)
      balance[s.user_id] = (balance[s.user_id] || 0) - parseFloat(s.amount)
    })
  })

  // Split into creditors (positive) and debtors (negative)
  const creditors = []
  const debtors   = []

  Object.entries(balance).forEach(([id, amt]) => {
    if (amt >  0.009) creditors.push({ name: nameOf[id], amount: amt })
    if (amt < -0.009) debtors.push  ({ name: nameOf[id], amount: -amt })
  })

  creditors.sort((a, b) => b.amount - a.amount)
  debtors.sort  ((a, b) => b.amount - a.amount)

  const txns = []
  let ci = 0, di = 0

  while (ci < creditors.length && di < debtors.length) {
    const pay = Math.min(creditors[ci].amount, debtors[di].amount)

    txns.push({
      from:   debtors[di].name,
      to:     creditors[ci].name,
      amount: Math.round(pay * 100) / 100,
    })

    creditors[ci].amount -= pay
    debtors[di].amount   -= pay

    if (creditors[ci].amount < 0.009) ci++
    if (debtors[di].amount   < 0.009) di++
  }

  return txns
}
