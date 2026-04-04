/**
 * Calculates minimum transactions to settle all debts.
 *
 * @param {Array} members  - [{user_id, name, ...}]
 * @param {Array} expenses - [{paid_by, amount, expense_splits: [{user_id, amount}]}]
 * @returns {Array}        - [{from: string, to: string, amount: number}]
 */
export function calculateSettlement(members, expenses) {
  if (!members.length || !expenses.length) return []

  const balances = {}
  const nameMap  = {}

  members.forEach(m => {
    balances[m.user_id] = 0
    nameMap[m.user_id]  = m.name || 'Unknown'
  })

  expenses.forEach(exp => {
    const splits = exp.expense_splits || []
    splits.forEach(split => {
      if (split.user_id !== exp.paid_by) {
        balances[exp.paid_by]  = (balances[exp.paid_by]  || 0) + parseFloat(split.amount)
        balances[split.user_id] = (balances[split.user_id] || 0) - parseFloat(split.amount)
      }
    })
  })

  const creditors = []
  const debtors   = []

  Object.entries(balances).forEach(([uid, bal]) => {
    const r = Math.round(bal * 100) / 100
    if (r >  0.009) creditors.push({ name: nameMap[uid], amount: r })
    if (r < -0.009) debtors.push({   name: nameMap[uid], amount: Math.abs(r) })
  })

  creditors.sort((a, b) => b.amount - a.amount)
  debtors.sort((a,   b) => b.amount - a.amount)

  const transactions = []
  let ci = 0, di = 0

  while (ci < creditors.length && di < debtors.length) {
    const amount = Math.round(Math.min(creditors[ci].amount, debtors[di].amount) * 100) / 100
    if (amount > 0.009) {
      transactions.push({ from: debtors[di].name, to: creditors[ci].name, amount })
    }
    creditors[ci].amount = Math.round((creditors[ci].amount - amount) * 100) / 100
    debtors[di].amount   = Math.round((debtors[di].amount   - amount) * 100) / 100
    if (creditors[ci].amount < 0.01) ci++
    if (debtors[di].amount   < 0.01) di++
  }

  return transactions
}
