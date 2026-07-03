export const CURRENCIES = [
  { code: 'GTQ', symbol: 'Q',  label: 'Quetzal guatemalteco (Q)' },
  { code: 'USD', symbol: '$',  label: 'Dólar estadounidense ($)' },
  { code: 'EUR', symbol: '€',  label: 'Euro (€)' },
  { code: 'MXN', symbol: 'MX$', label: 'Peso mexicano (MX$)' },
  { code: 'HNL', symbol: 'L',  label: 'Lempira hondureño (L)' },
  { code: 'CRC', symbol: '₡',  label: 'Colón costarricense (₡)' },
]

export function getCurrencySymbol(code = 'GTQ') {
  return CURRENCIES.find(c => c.code === code)?.symbol ?? code
}

export function formatCurrency(amount, currency = 'GTQ') {
  const num = parseFloat(amount) || 0
  const symbol = getCurrencySymbol(currency)
  return `${symbol}${num.toFixed(2)}`
}
