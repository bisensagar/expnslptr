/**
 * Calculates minimum transactions to settle all debts.
 * Uses a greedy algorithm on net balances.
 *
 * @param {Array} members  - trip_members rows with .user_id and .profiles.name
 * @param {Array} expenses - expenses rows with .paid_by and .expense_splits[]
 * @returns {Array}        - [{ from: string, to: string, amount: number }]
 */
export function calculateSettlement(members, expenses) {
  if (!members.length || !expenses.length) return []

  const balances = {}
  const nameMap = {}

  // Initialize all members at 0
  members.forEach(m => {
    balances[m.user_id] = 0
    nameMap[m.user_id] = m.profiles?.name || 'Unknown'
  })

  // For each expense: payer gets credit, each split person gets debited
  expenses.forEach(expense => {
    const paidBy = expense.paid_by
    const splits = expense.expense_splits || []

    splits.forEach(split => {
      if (split.user_id !== paidBy) {
        // payer is owed this amount by split.user_id
        balances[paidBy] = (balances[paidBy] || 0) + parseFloat(split.amount)
        balances[split.user_id] = (balances[split.user_id] || 0) - parseFloat(split.amount)
      }
      // If paidBy === split.user_id, their own share nets to zero — skip
    })
  })

  // Split into creditors (get money) and debtors (owe money)
  const creditors = []
  const debtors = []

  Object.entries(balances).forEach(([userId, bal]) => {
    const rounded = Math.round(bal * 100) / 100
    if (rounded > 0.009) {
      creditors.push({ id: userId, name: nameMap[userId], amount: rounded })
    } else if (rounded < -0.009) {
      debtors.push({ id: userId, name: nameMap[userId], amount: Math.abs(rounded) })
    }
  })

  // Sort descending so we match the largest amounts first
  creditors.sort((a, b) => b.amount - a.amount)
  debtors.sort((a, b) => b.amount - a.amount)

  const transactions = []
  let ci = 0
  let di = 0

  while (ci < creditors.length && di < debtors.length) {
    const credit = creditors[ci]
    const debit = debtors[di]
    const amount = Math.round(Math.min(credit.amount, debit.amount) * 100) / 100

    if (amount > 0.009) {
      transactions.push({ from: debit.name, to: credit.name, amount })
    }

    credit.amount = Math.round((credit.amount - amount) * 100) / 100
    debit.amount = Math.round((debit.amount - amount) * 100) / 100

    if (credit.amount < 0.01) ci++
    if (debit.amount < 0.01) di++
  }

  return transactions
}
