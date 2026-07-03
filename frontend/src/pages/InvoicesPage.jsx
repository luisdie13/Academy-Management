import { useEffect, useState } from 'react'
import { CheckCircle, Clock, AlertCircle } from 'lucide-react'
import api from '../services/api'

function InvoicesPage() {
  const [invoices, setInvoices] = useState([])
  const [studentsMap, setStudentsMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('all')
  const [payingId, setPayingId] = useState(null)
  const [payForm, setPayForm] = useState({ paymentMethod: '', referenceNumber: '' })
  const [paySubmitting, setPaySubmitting] = useState(false)
  const [payError, setPayError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generateModal, setGenerateModal] = useState(false)
  const [generateMonth, setGenerateMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    fetchAll()
  }, [activeTab])

  const fetchAll = async () => {
    setLoading(true)
    setError(null)

    try {
      const [invoicesRes, studentsRes] = await Promise.all([
        api.get(activeTab === 'all' ? '/invoices' : `/invoices?status=${activeTab}`),
        api.get('/users/students'),
      ])

      const invoiceList = invoicesRes.data.data || invoicesRes.data || []
      setInvoices(Array.isArray(invoiceList) ? invoiceList : [])

      const students = studentsRes.data.data || []
      const map = {}
      students.forEach((s) => {
        map[s.id] = `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.email
      })
      setStudentsMap(map)
    } catch (err) {
      console.error('Error fetching invoices:', err)
      setError('Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenPayForm = (invoiceId) => {
    setPayingId(invoiceId)
    setPayForm({ paymentMethod: '', referenceNumber: '' })
    setPayError('')
  }

  const handleCancelPay = () => {
    setPayingId(null)
    setPayError('')
  }

  const handleSubmitPayment = async (invoiceId) => {
    setPaySubmitting(true)
    setPayError('')
    try {
      await api.post(`/invoices/${invoiceId}/pay`, {
        paymentMethod: payForm.paymentMethod || undefined,
        referenceNumber: payForm.referenceNumber || undefined,
      })
      setPayingId(null)
      await fetchAll()
    } catch (err) {
      console.error('Error paying invoice:', err)
      setPayError(err.response?.data?.error?.message || 'Failed to process payment')
    } finally {
      setPaySubmitting(false)
    }
  }

  const handleGenerateInvoices = async () => {
    setGenerating(true)
    try {
      const res = await api.post('/invoices/generate', { invoiceMonth: generateMonth })
      const count = res.data?.data?.length ?? 0
      setGenerateModal(false)
      await fetchAll()
      alert(`✅ ${count} factura(s) generada(s) para ${generateMonth}`)
    } catch (err) {
      console.error('Error generating invoices:', err)
      alert(err.response?.data?.error?.message || 'Error al generar facturas')
    } finally {
      setGenerating(false)
    }
  }

  const handleDownloadPdf = async (invoiceId, invoiceMonth) => {
    try {
      const response = await api.get(`/invoices/${invoiceId}/pdf`, { responseType: 'blob' })
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `invoice-${invoiceMonth || invoiceId}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error downloading PDF:', err)
      alert('Failed to download PDF. Please try again.')
    }
  }

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(amount || 0)

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'paid':
        return (
          <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded-full">
            <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
            <span className="text-xs font-semibold text-green-700 dark:text-green-400">Paid</span>
          </div>
        )
      case 'pending':
        return (
          <div className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
            <Clock className="w-3 h-3 text-yellow-600 dark:text-yellow-400" />
            <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-400">Pending</span>
          </div>
        )
      case 'overdue':
        return (
          <div className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 rounded-full">
            <AlertCircle className="w-3 h-3 text-red-600 dark:text-red-400" />
            <span className="text-xs font-semibold text-red-700 dark:text-red-400">Overdue</span>
          </div>
        )
      default:
        return <span className="text-xs text-gray-500">{status}</span>
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              Facturas & Pagos
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Gestiona facturas de alumnos y registra pagos
            </p>
          </div>
          <button
            onClick={() => setGenerateModal(true)}
            className="flex-shrink-0 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors text-sm"
          >
            ⚡ Generar Facturas
          </button>
        </div>

        {/* Generate Invoices Modal */}
        {generateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-sm w-full p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Generar Facturas Mensuales</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Genera o actualiza las facturas de todos los alumnos activos para el mes indicado.
              </p>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Mes a facturar</label>
              <input
                type="month"
                value={generateMonth}
                onChange={(e) => setGenerateMonth(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 mb-6"
              />
              <div className="flex gap-3">
                <button onClick={() => setGenerateModal(false)} className="flex-1 px-4 py-2 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" disabled={generating}>
                  Cancelar
                </button>
                <button onClick={handleGenerateInvoices} disabled={generating || !generateMonth} className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50">
                  {generating ? 'Generando…' : 'Generar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-600 dark:text-red-400 text-sm">⚠️ {error}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
          {[
            { key: 'all', label: 'All Invoices' },
            { key: 'pending', label: '⏳ Pending' },
            { key: 'paid', label: '✅ Paid' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-6 py-3 font-semibold border-b-2 transition-colors ${
                activeTab === key
                  ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading invoices...</p>
            </div>
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <p className="text-gray-600 dark:text-gray-400">
              No {activeTab !== 'all' ? activeTab : ''} invoices found
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Student</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Month</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Subtotal</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Credit</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Total</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Due Date</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <>
                    <tr
                      key={invoice.id}
                      className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                        {studentsMap[invoice.studentId] || `Student #${invoice.studentId}`}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {invoice.invoiceMonth || '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {formatCurrency(invoice.subtotal)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {formatCurrency(invoice.creditApplied)}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(invoice.totalAmount)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {getStatusBadge(invoice.status)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(invoice.dueDate)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex gap-2">
                          {invoice.status === 'pending' && payingId !== invoice.id && (
                            <button
                              onClick={() => handleOpenPayForm(invoice.id)}
                              className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors text-xs font-semibold"
                            >
                              💳 Mark as Paid
                            </button>
                          )}
                          <button
                            onClick={() => handleDownloadPdf(invoice.id, invoice.invoiceMonth)}
                            className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors text-xs font-semibold"
                          >
                            📄 PDF
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Inline Pay Form Row */}
                    {payingId === invoice.id && (
                      <tr key={`pay-${invoice.id}`} className="bg-green-50 dark:bg-green-900/10 border-b border-gray-200 dark:border-gray-700">
                        <td colSpan={8} className="px-6 py-4">
                          <div className="flex flex-wrap items-end gap-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Payment Method
                              </label>
                              <input
                                type="text"
                                value={payForm.paymentMethod}
                                onChange={(e) => setPayForm((p) => ({ ...p, paymentMethod: e.target.value }))}
                                placeholder="e.g. Cash, Bank Transfer"
                                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm w-52 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                disabled={paySubmitting}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Reference # (Optional)
                              </label>
                              <input
                                type="text"
                                value={payForm.referenceNumber}
                                onChange={(e) => setPayForm((p) => ({ ...p, referenceNumber: e.target.value }))}
                                placeholder="Transaction or receipt number"
                                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm w-60 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                disabled={paySubmitting}
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSubmitPayment(invoice.id)}
                                disabled={paySubmitting}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
                              >
                                {paySubmitting ? 'Processing...' : 'Confirm Payment'}
                              </button>
                              <button
                                onClick={handleCancelPay}
                                disabled={paySubmitting}
                                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-lg text-sm transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                            {payError && (
                              <p className="text-red-600 dark:text-red-400 text-xs">⚠️ {payError}</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary Footer */}
        {!loading && invoices.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Total Invoices</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{invoices.length}</p>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Pending Amount</p>
              <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                {formatCurrency(
                  invoices.filter((i) => i.status === 'pending').reduce((s, i) => s + (i.totalAmount || 0), 0)
                )}
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Collected</p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                {formatCurrency(
                  invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + (i.totalAmount || 0), 0)
                )}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default InvoicesPage
