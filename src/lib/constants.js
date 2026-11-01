export const COLORS = {
  accent: '#22d3ee',
  violet: '#8b5cf6',
  green: '#34d399',
  red: '#f87171',
  amber: '#fbbf24',
  orange: '#fb923c',
  pink: '#f472b6',
  blue: '#60a5fa',
}
export const CHART_COLORS = [COLORS.accent, COLORS.violet, COLORS.orange, COLORS.green, COLORS.amber, COLORS.pink, COLORS.blue, COLORS.red]

export const DEFAULT_EXPENSE_CATS = ['Alimentation', 'Transport', 'Logement', 'Factures', 'Santé', 'Éducation', 'Loisirs', 'Shopping', 'Abonnements', 'Autre']
export const DEFAULT_INCOME_CATS = ['Salaire', 'Business', 'Freelance', 'Cadeau', 'Investissement', 'Autre']
export const DEFAULT_TASK_CATS = ['Personnel', 'Travail', 'Études', 'Maison', 'Santé', 'Autre']

export const PRIORITIES = [
  { id: 'low', label: 'Basse', color: COLORS.green },
  { id: 'medium', label: 'Moyenne', color: COLORS.amber },
  { id: 'high', label: 'Haute', color: COLORS.red },
]
export const STATUSES = [
  { id: 'todo', label: 'À faire' },
  { id: 'doing', label: 'En cours' },
  { id: 'done', label: 'Terminé' },
]
export const PAYMENT_METHODS = [
  { id: 'visa', label: 'Visa', color: '#60a5fa' },
  { id: 'mastercard', label: 'Mastercard', color: '#fb923c' },
  { id: 'cash', label: 'Cash', color: '#34d399' },
  { id: 'moncash', label: 'MonCash', color: '#f87171' },
  { id: 'natcash', label: 'NatCash', color: '#a78bfa' },
]
export const FREQUENCIES = [
  { id: 'weekly', label: 'Hebdomadaire' },
  { id: 'monthly', label: 'Mensuel' },
  { id: 'yearly', label: 'Annuel' },
]
export const CURRENCIES = ['HTG', 'USD', 'CAD', 'EUR', 'GBP', 'DOP', 'CNY', 'JPY', 'CHF', 'AUD', 'BRL', 'MXN', 'INR', 'ZAR', 'GHS', 'XOF', 'SAR', 'AED', 'TRY', 'KWD', 'JMD', 'COP', 'THB', 'NZD', 'SGD']
export const HTG_PER_CURRENCY = {
  HTG: 1,
  USD: 130.60,
  CAD: 93.41,
  EUR: 145.96,
  GBP: 174.63,
  DOP: 2.16,
  CNY: 19.62,
  JPY: 0.83,
  CHF: 158.38,
  AUD: 91.79,
  BRL: 24.05,
  MXN: 6.96,
  INR: 1.37,
  ZAR: 7.86,
  GHS: 11.25,
  XOF: 0.22,
  SAR: 34.95,
  AED: 35.56,
  TRY: 2.62,
  KWD: 420.51,
  JMD: 0.82,
  COP: 0.04,
  THB: 3.88,
  NZD: 73.58,
  SGD: 102.09,
}
export const methodOf = (id) => PAYMENT_METHODS.find((m) => m.id === id) || PAYMENT_METHODS[2]
export const priorityOf = (id) => PRIORITIES.find((p) => p.id === id) || PRIORITIES[1]
