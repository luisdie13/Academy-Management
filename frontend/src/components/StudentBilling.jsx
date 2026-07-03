import { CheckCircle, Clock, AlertCircle } from 'lucide-react'

const formatCurrency = (amount) =>
  new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(amount || 0)

const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d)) return '—'
  return d.toLocaleDateString('es-GT', { year: 'numeric', month: 'long', day: 'numeric' })
}

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

function StatusBadge({ status }) {
  if (status === 'paid') return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 dark:bg-green-900/30 rounded-full">
      <CheckCircle className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
      <span className="text-xs font-semibold text-green-700 dark:text-green-400">Pagado</span>
    </span>
  )
  if (status === 'overdue') return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 dark:bg-red-900/30 rounded-full">
      <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
      <span className="text-xs font-semibold text-red-700 dark:text-red-400">Vencido</span>
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
      <Clock className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />
      <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-400">Pendiente</span>
    </span>
  )
}

function monthLabel(invoiceMonth) {
  if (!invoiceMonth) return '—'
  const [y, m] = invoiceMonth.split('-').map(Number)
  return `${MONTH_NAMES_ES[m - 1]} ${y}`
}

/**
 * StudentBilling
 * Props:
 *   billingMode: 'prepaid' | 'postpaid'
 *   invoices: array of invoice objects from GET /api/invoices/student/:id
 *   creditBalance: number (prepaid student's accumulated credit)
 *   classPrice: number (postpaid: price per class)
 *   onDownloadInvoice: fn(invoiceId) — opens PDF endpoint
 */
function StudentBilling({ billingMode = 'postpaid', invoices = [], creditBalance = 0, classPrice = 0, onDownloadInvoice }) {
  if (!invoices || invoices.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-700 text-center">
        <p className="text-4xl mb-3">📋</p>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">Sin facturas aún</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Las facturas se generan mensualmente por la academia. Vuelve aquí a fin de mes para ver tu estado de cuenta.
        </p>
      </div>
    )
  }

  const pendingTotal = invoices
    .filter(i => i.status !== 'paid')
    .reduce((sum, i) => sum + (i.totalAmount || 0), 0)

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total facturas</p>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{invoices.length}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-200 dark:border-green-800">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Pagadas</p>
          <p className="text-2xl font-bold text-green-700 dark:text-green-400">
            {invoices.filter(i => i.status === 'paid').length}
          </p>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl border border-yellow-200 dark:border-yellow-800">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Por pagar</p>
          <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
            {invoices.filter(i => i.status !== 'paid').length}
          </p>
        </div>
        {billingMode === 'prepaid' && creditBalance > 0 ? (
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl border border-purple-200 dark:border-purple-800">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Crédito acumulado</p>
            <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">
              {formatCurrency(creditBalance)}
            </p>
          </div>
        ) : (
          <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl border border-orange-200 dark:border-orange-800">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Saldo pendiente</p>
            <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">
              {formatCurrency(pendingTotal)}
            </p>
          </div>
        )}
      </div>

      {/* Prepaid credit note */}
      {billingMode === 'prepaid' && creditBalance > 0 && (
        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl">
          <p className="text-sm text-purple-800 dark:text-purple-200">
            <strong>💡 Crédito por ausencias:</strong> Tienes {formatCurrency(creditBalance)} acumulado de clases que no asististe.
            Este monto se descuenta automáticamente en tu próxima factura.
          </p>
        </div>
      )}

      {/* Invoice list */}
      <div className="space-y-4">
        {invoices.map((inv) => {
          const [y, m] = (inv.invoiceMonth || '').split('-').map(Number)
          const startDate = inv.invoiceMonth ? `${y}-${String(m).padStart(2, '0')}-01` : null
          const endDate = inv.invoiceMonth ? new Date(y, m, 0).toISOString().split('T')[0] : null

          const attendedDays = billingMode === 'postpaid' && classPrice > 0
            ? Math.round((inv.subtotal || 0) / classPrice)
            : null

          return (
            <div
              key={inv.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <div className="flex items-start justify-between p-5 border-b border-gray-100 dark:border-gray-700">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {monthLabel(inv.invoiceMonth)}
                  </h3>
                  {startDate && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {formatDate(startDate)} — {formatDate(endDate)}
                    </p>
                  )}
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <StatusBadge status={inv.status} />
                  <p className="text-xs text-gray-400 dark:text-gray-500">#{inv.id}</p>
                </div>
              </div>

              <div className="p-5 space-y-2">
                {billingMode === 'postpaid' && attendedDays !== null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Clases asistidas</span>
                    <span className="font-medium text-gray-900 dark:text-white">{attendedDays} × {formatCurrency(classPrice)}</span>
                  </div>
                )}

                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                  <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(inv.subtotal)}</span>
                </div>

                {inv.creditApplied > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-600 dark:text-purple-400">Crédito aplicado</span>
                    <span className="font-medium text-purple-700 dark:text-purple-300">−{formatCurrency(inv.creditApplied)}</span>
                  </div>
                )}

                <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-gray-900 dark:text-white">Total a pagar</span>
                  <span className="text-primary-600 dark:text-primary-400 text-base">{formatCurrency(inv.totalAmount)}</span>
                </div>

                {inv.status === 'paid' && inv.paidAt && (
                  <p className="text-xs text-green-600 dark:text-green-400 pt-1">✓ Pagado el {formatDate(inv.paidAt)}</p>
                )}

                {inv.status !== 'paid' && inv.dueDate && (
                  <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-xs text-yellow-800 dark:text-yellow-200">
                    ⏳ Vence el {formatDate(inv.dueDate)}. Contacta a la academia para realizar el pago.
                  </div>
                )}

                {onDownloadInvoice && (
                  <button
                    onClick={() => onDownloadInvoice(inv.id)}
                    className="w-full mt-3 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-colors text-sm"
                  >
                    📄 Descargar PDF
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>ℹ️ Facturación {billingMode === 'prepaid' ? 'prepago' : 'postpago'}:</strong>{' '}
          {billingMode === 'prepaid'
            ? 'Pagas una cuota mensual fija. Los días que no asistes generan crédito que se descuenta automáticamente el siguiente mes.'
            : 'Solo pagas las clases a las que asististe. El monto se calcula al finalizar cada mes.'}
        </p>
      </div>
    </div>
  )
}

export default StudentBilling
