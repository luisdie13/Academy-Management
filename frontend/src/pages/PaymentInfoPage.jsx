import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'

const EMPTY_METHOD = {
  methodName: '',
  accountHolder: '',
  accountNumber: '',
  bankName: '',
  additionalInfo: '',
}

function MethodModal({ method, onSave, onClose }) {
  const isEdit = !!method?.id
  const [form, setForm] = useState(
    method?.id
      ? {
          methodName: method.methodName || '',
          accountHolder: method.accountHolder || '',
          accountNumber: method.accountNumber || '',
          bankName: method.bankName || '',
          additionalInfo: method.additionalInfo || '',
        }
      : { ...EMPTY_METHOD }
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }))

  const handleSave = async () => {
    if (!form.methodName.trim()) { setError('El nombre del método es obligatorio'); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        methodName: form.methodName.trim(),
        accountHolder: form.accountHolder.trim() || null,
        accountNumber: form.accountNumber.trim() || null,
        bankName: form.bankName.trim() || null,
        additionalInfo: form.additionalInfo.trim() || null,
      }
      if (isEdit) {
        const res = await api.put(`/settings/payment-methods/${method.id}`, payload)
        onSave(res.data.data)
      } else {
        const res = await api.post('/settings/payment-methods', payload)
        onSave(res.data.data)
      }
      onClose()
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {isEdit ? 'Editar método de pago' : 'Nuevo método de pago'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl">✕</button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
            ⚠️ {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              Nombre del método <span className="text-red-500">*</span>
            </label>
            <input name="methodName" value={form.methodName} onChange={handleChange}
              placeholder='Ej: Banco Industrial, PayPal, Frii...'
              className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              Beneficiario / Titular de la cuenta
            </label>
            <input name="accountHolder" value={form.accountHolder} onChange={handleChange}
              placeholder='Nombre del titular'
              className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              Número de cuenta / Usuario / Correo
            </label>
            <input name="accountNumber" value={form.accountNumber} onChange={handleChange}
              placeholder='Ej: 123-456789-0 o usuario@paypal.com'
              className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              Banco / Plataforma
            </label>
            <input name="bankName" value={form.bankName} onChange={handleChange}
              placeholder='Ej: Banco Industrial, PayPal...'
              className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              Instrucciones adicionales
            </label>
            <textarea name="additionalInfo" value={form.additionalInfo} onChange={handleChange}
              placeholder='Ej: Al depositar, enviar comprobante por WhatsApp...'
              rows={3}
              className={`${inputCls} resize-none`} />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50">
            {saving ? 'Guardando…' : (isEdit ? 'Actualizar' : 'Agregar')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PaymentInfoPage() {
  const [methods, setMethods] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | { id?, methodName?, ... }

  // Contact info state
  const [contact, setContact] = useState({ contactPhone: '', contactEmail: '' })
  const [contactSaving, setContactSaving] = useState(false)
  const [contactMsg, setContactMsg] = useState('')

  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [pmRes, profileRes] = await Promise.all([
          api.get('/settings/payment-methods'),
          api.get('/academy/profile'),
        ])
        setMethods(pmRes.data.data || [])
        const p = profileRes.data.data || {}
        setContact({
          contactPhone: p.contact_phone || '',
          contactEmail: p.contact_email || '',
        })
      } catch (err) {
        setError('Error al cargar la información')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSaveMethod = (saved) => {
    setMethods(prev => {
      const idx = prev.findIndex(m => m.id === saved.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next }
      return [...prev, saved]
    })
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este método de pago?')) return
    setDeletingId(id)
    try {
      await api.delete(`/settings/payment-methods/${id}`)
      setMethods(prev => prev.filter(m => m.id !== id))
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Error al eliminar')
    } finally {
      setDeletingId(null)
    }
  }

  const handleToggleActive = async (method) => {
    try {
      const res = await api.put(`/settings/payment-methods/${method.id}`, { isActive: !method.isActive })
      handleSaveMethod(res.data.data)
    } catch {
      setError('Error al cambiar estado')
    }
  }

  const handleSaveContact = async () => {
    setContactSaving(true)
    setContactMsg('')
    try {
      await api.put('/academy/profile', {
        contact_phone: contact.contactPhone || null,
        contact_email: contact.contactEmail || null,
      })
      setContactMsg('Guardado correctamente')
      setTimeout(() => setContactMsg(''), 3000)
    } catch {
      setContactMsg('Error al guardar')
    } finally {
      setContactSaving(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm'

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-10">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-1">Métodos de Pago</h1>
            <p className="text-gray-500 dark:text-gray-400">Gestiona cómo los alumnos pueden contactarte y realizarte sus pagos</p>
          </div>
          <Link to="/dashboard"
            className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            ← Dashboard
          </Link>
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600" />
          </div>
        ) : (
          <>
            {/* ── SECCIÓN 1: INFORMACIÓN DE CONTACTO ── */}
            <section className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Información de Contacto</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Los alumnos verán estos datos para poder comunicarse contigo.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                    📞 Teléfono / WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={contact.contactPhone}
                    onChange={e => setContact(p => ({ ...p, contactPhone: e.target.value }))}
                    placeholder='+502 1234 5678'
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                    ✉️ Correo electrónico
                  </label>
                  <input
                    type="email"
                    value={contact.contactEmail}
                    onChange={e => setContact(p => ({ ...p, contactEmail: e.target.value }))}
                    placeholder='academia@correo.com'
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 mt-5">
                <button
                  onClick={handleSaveContact}
                  disabled={contactSaving}
                  className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 text-sm"
                >
                  {contactSaving ? 'Guardando…' : 'Guardar contacto'}
                </button>
                {contactMsg && (
                  <span className={`text-sm font-medium ${contactMsg.startsWith('Error') ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                    {contactMsg.startsWith('Error') ? '⚠️' : '✓'} {contactMsg}
                  </span>
                )}
              </div>
            </section>

            {/* ── SECCIÓN 2: MÉTODOS DE PAGO ── */}
            <section>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Métodos de Pago</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    Agrega tus cuentas bancarias, PayPal, Frii u otras opciones.
                  </p>
                </div>
                <button
                  onClick={() => setModal({})}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors text-sm"
                >
                  + Agregar método
                </button>
              </div>

              {methods.length === 0 ? (
                <div className="text-center py-14 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                  <p className="text-3xl mb-3">💳</p>
                  <p className="text-gray-600 dark:text-gray-400 font-medium mb-1">Sin métodos de pago</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">Agrega tu primera cuenta para que los alumnos puedan pagarte.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {methods.map(m => (
                    <div key={m.id}
                      className={`bg-white dark:bg-gray-800 rounded-xl border-2 p-5 transition-all ${
                        m.isActive
                          ? 'border-gray-200 dark:border-gray-700'
                          : 'border-gray-100 dark:border-gray-700/50 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-gray-900 dark:text-white text-base">{m.methodName}</h3>
                            {!m.isActive && (
                              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs rounded-full font-medium">
                                Inactivo
                              </span>
                            )}
                          </div>

                          <div className="mt-2 space-y-1">
                            {m.accountHolder && (
                              <p className="text-sm text-gray-700 dark:text-gray-300">
                                <span className="font-medium text-gray-500 dark:text-gray-400">Titular: </span>
                                {m.accountHolder}
                              </p>
                            )}
                            {m.accountNumber && (
                              <p className="text-sm text-gray-700 dark:text-gray-300 font-mono">
                                <span className="font-medium text-gray-500 dark:text-gray-400 font-sans">Cuenta/Usuario: </span>
                                {m.accountNumber}
                              </p>
                            )}
                            {m.bankName && (
                              <p className="text-sm text-gray-500 dark:text-gray-400">{m.bankName}</p>
                            )}
                            {m.additionalInfo && (
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 bg-gray-50 dark:bg-gray-700/50 px-3 py-2 rounded-lg">
                                {m.additionalInfo}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          {/* Active toggle */}
                          <button
                            onClick={() => handleToggleActive(m)}
                            title={m.isActive ? 'Desactivar' : 'Activar'}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                              m.isActive ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                            }`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
                              m.isActive ? 'translate-x-4.5' : 'translate-x-0.5'
                            }`} />
                          </button>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => setModal(m)}
                              className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded-lg text-xs font-semibold transition-colors"
                            >
                              ✏️ Editar
                            </button>
                            <button
                              onClick={() => handleDelete(m.id)}
                              disabled={deletingId === m.id}
                              className="px-2.5 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              {deletingId === m.id ? '…' : '🗑️'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {modal !== null && (
        <MethodModal
          method={modal?.id ? modal : null}
          onSave={handleSaveMethod}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
