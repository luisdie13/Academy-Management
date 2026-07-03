import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import api from '../services/api'

function EditProfilePage() {
  const navigate = useNavigate()
  const { user, logout, setUser } = useAuthStore()

  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    newPassword: '',
    confirmPassword: '',
    birthday: '',
    dpi: '',
    department: '',
    municipality: '',
    guardianName: '',
    guardianPhone: '',
    guardianEmail: '',
    guardianRelationship: '',
    classModality: '',
  })

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPasswords, setShowPasswords] = useState({ new: false, confirm: false })
  const [departments, setDepartments] = useState([])
  const [loadingDepartments, setLoadingDepartments] = useState(false)
  const [municipalities, setMunicipalities] = useState([])
  const [loadingMunicipalities, setLoadingMunicipalities] = useState(false)

  const isTemporaryPassword = user?.mustChangePassword === true

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.phone || '',
        newPassword: '',
        confirmPassword: '',
        birthday: user.birthday ? String(user.birthday).split('T')[0] : '',
        dpi: user.dpi || '',
        department: user.department || '',
        municipality: user.municipality || '',
        guardianName: user.guardianName || '',
        guardianPhone: user.guardianPhone || '',
        guardianEmail: user.guardianEmail || '',
        guardianRelationship: user.guardianRelationship || '',
        classModality: user.classModality || '',
      })
      setLoading(false)
    } else {
      navigate('/login')
    }
  }, [user, navigate])

  useEffect(() => {
    const loadDepartments = async () => {
      setLoadingDepartments(true)
      try {
        const response = await api.get('/geolocation/departments')
        setDepartments(response.data.data || [])
      } catch (err) {
        console.error('Error loading departments:', err)
        setDepartments([])
      } finally {
        setLoadingDepartments(false)
      }
    }
    loadDepartments()
  }, [])

  useEffect(() => {
    if (!formData.department) {
      setMunicipalities([])
      return
    }
    const loadMunicipalities = async () => {
      setLoadingMunicipalities(true)
      try {
        const response = await api.get(`/geolocation/municipalities/${formData.department}`)
        setMunicipalities(response.data.data || [])
      } catch (err) {
        console.error('Error loading municipalities:', err)
        setMunicipalities([])
      } finally {
        setLoadingMunicipalities(false)
      }
    }
    loadMunicipalities()
  }, [formData.department])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'department' ? { municipality: '' } : {}),
    }))
    if (error) setError('')
  }

  const togglePasswordVisibility = (field) => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }))
  }

  const validateForm = () => {
    if (!formData.email.trim()) { setError('Email is required'); return false }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) { setError('Please enter a valid email address'); return false }
    if (!formData.firstName.trim()) { setError('First name is required'); return false }
    if (!formData.lastName.trim()) { setError('Last name is required'); return false }

    if (formData.dpi && !/^\d{13}$/.test(formData.dpi)) {
      setError('DPI must be exactly 13 digits (numbers only)')
      return false
    }

    if (formData.newPassword || formData.confirmPassword) {
      if (!formData.newPassword) { setError('Please enter the new password'); return false }
      if (formData.newPassword.length < 8) { setError('New password must be at least 8 characters'); return false }
      if (!formData.confirmPassword) { setError('Please confirm your new password'); return false }
      if (formData.newPassword !== formData.confirmPassword) { setError('Passwords do not match'); return false }
      const passwordRegex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/
      if (!passwordRegex.test(formData.newPassword)) {
        setError('Password must contain uppercase, lowercase, numbers and special characters')
        return false
      }
    }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!validateForm()) return

    setSubmitting(true)
    try {
      const payload = {
        email: formData.email.trim(),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phone: formData.phone.trim() || null,
        birthday: formData.birthday || null,
        dpi: formData.dpi.trim() || null,
        department: formData.department || null,
        municipality: formData.municipality || null,
        guardianName: formData.guardianName.trim() || null,
        guardianPhone: formData.guardianPhone.trim() || null,
        guardianEmail: formData.guardianEmail.trim() || null,
        guardianRelationship: formData.guardianRelationship || null,
        classModality: formData.classModality || null,
      }

      if (formData.newPassword) {
        payload.password = formData.newPassword
      }

      const response = await api.put('/users/profile', payload)
      const updatedUserData = response.data.data

      if (updatedUserData) {
        const fullName = updatedUserData.firstName || updatedUserData.lastName
          ? `${updatedUserData.firstName || ''} ${updatedUserData.lastName || ''}`.trim()
          : updatedUserData.email

        setUser({
          ...updatedUserData,
          name: fullName,
          mustChangePassword: updatedUserData.mustChangePassword || false,
        })
      }

      setSuccess('Profile updated successfully!')
      setFormData((prev) => ({ ...prev, newPassword: '', confirmPassword: '' }))

      setTimeout(() => {
        navigate('/student-dashboard')
      }, 2000)
    } catch (err) {
      const errorMsg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Failed to update profile'
      console.error('Error updating profile:', errorMsg)
      setError(errorMsg)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading your profile...</p>
        </div>
      </div>
    )
  }

  const inputClass = 'w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 transition-all'

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 px-4 py-8">
      <div className="max-w-2xl mx-auto">

        {isTemporaryPassword && (
          <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-600 dark:border-red-500 rounded">
            <div className="flex gap-3">
              <span className="text-2xl">🔒</span>
              <div>
                <p className="font-bold text-red-900 dark:text-red-300 mb-1">
                  ⚠️ For security reasons, you must update your temporary password before accessing the academy.
                </p>
                <p className="text-sm text-red-800 dark:text-red-400">
                  This is a temporary password assigned by the administrator. Please create a permanent password now.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Edit Profile</h1>
          <p className="text-gray-600 dark:text-gray-400">Update your personal information</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg dark:shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
          {isTemporaryPassword && (
            <div className="p-6 bg-orange-50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-800">
              <p className="text-orange-600 dark:text-orange-400 text-sm font-bold flex items-center gap-2">
                🔒 <span>For security, you must set a permanent password before continuing.</span>
              </p>
            </div>
          )}

          {error && (
            <div className="p-6 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
              <p className="text-red-600 dark:text-red-400 text-sm font-medium">⚠️ {error}</p>
            </div>
          )}

          {success && (
            <div className="p-6 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800">
              <p className="text-green-600 dark:text-green-400 text-sm font-medium">✓ {success}</p>
            </div>
          )}

          <div className="px-6 py-8">
            <form onSubmit={handleSubmit} className="space-y-8">

              {/* ── Personal Information ──────────────────── */}
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                  Personal Information
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">First Name *</label>
                    <input id="firstName" type="text" name="firstName" value={formData.firstName}
                      onChange={handleChange} placeholder="Jane" className={inputClass} disabled={submitting} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Last Name *</label>
                    <input id="lastName" type="text" name="lastName" value={formData.lastName}
                      onChange={handleChange} placeholder="Doe" className={inputClass} disabled={submitting} />
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Phone (Optional)</label>
                  <input id="phone" type="tel" name="phone" value={formData.phone}
                    onChange={handleChange} placeholder="+502 7123 4567" className={inputClass} disabled={submitting} />
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date of Birth (Optional)</label>
                  <input type="date" name="birthday" value={formData.birthday}
                    onChange={handleChange} className={inputClass} disabled={submitting} />
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">DPI (Optional)</label>
                  <input type="text" name="dpi" value={formData.dpi}
                    onChange={handleChange} placeholder="e.g. 1234567890123"
                    className={inputClass} disabled={submitting} />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Guatemala DPI — must be exactly 13 digits</p>
                </div>

                {/* Department */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Department (Optional)</label>
                  <select name="department" value={formData.department} onChange={handleChange}
                    className={inputClass} disabled={submitting || loadingDepartments}>
                    <option value="">{loadingDepartments ? 'Loading departments...' : 'Select a department'}</option>
                    {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                {/* Municipality */}
                {formData.department && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Municipality (Optional)</label>
                    <select name="municipality" value={formData.municipality} onChange={handleChange}
                      className={inputClass} disabled={submitting || loadingMunicipalities || municipalities.length === 0}>
                      <option value="">{loadingMunicipalities ? 'Loading municipalities...' : 'Select a municipality'}</option>
                      {municipalities.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                )}

                {/* Class Modality */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Modalidad de clases (Opcional)</label>
                  <select name="classModality" value={formData.classModality} onChange={handleChange}
                    className={inputClass} disabled={submitting}>
                    <option value="">Seleccionar modalidad</option>
                    <option value="in_person">En la academia (presencial)</option>
                    <option value="virtual">Virtual (en línea)</option>
                    <option value="residential">Residencial (a domicilio)</option>
                  </select>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email *</label>
                  <input type="email" name="email" value={formData.email}
                    onChange={handleChange} placeholder="you@example.com"
                    className={inputClass} disabled={submitting} />
                </div>
              </div>

              {/* ── Guardian Information ──────────────────── */}
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                  Guardian Information (Optional)
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Guardian Name</label>
                    <input type="text" name="guardianName" value={formData.guardianName}
                      onChange={handleChange} placeholder="Guardian's full name" className={inputClass} disabled={submitting} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Guardian Phone</label>
                    <input type="tel" name="guardianPhone" value={formData.guardianPhone}
                      onChange={handleChange} placeholder="+1234567890" className={inputClass} disabled={submitting} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Guardian Email</label>
                    <input type="email" name="guardianEmail" value={formData.guardianEmail}
                      onChange={handleChange} placeholder="guardian@email.com" className={inputClass} disabled={submitting} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Relationship</label>
                    <select name="guardianRelationship" value={formData.guardianRelationship}
                      onChange={handleChange} className={inputClass} disabled={submitting}>
                      <option value="">Select a relationship</option>
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Legal Guardian">Legal Guardian</option>
                      <option value="Grandparent">Grandparent</option>
                      <option value="Uncle/Aunt">Uncle/Aunt</option>
                      <option value="Older Sibling">Older Sibling</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ── Change Password ───────────────────────── */}
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                  Change Password (Optional)
                </h2>

                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg mb-6">
                  <p className="text-sm text-blue-600 dark:text-blue-400">
                    💡 To change your password, fill in the fields below. Otherwise, leave them empty.
                  </p>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">New Password</label>
                  <div className="relative">
                    <input id="newPassword" type={showPasswords.new ? 'text' : 'password'}
                      name="newPassword" value={formData.newPassword} onChange={handleChange}
                      placeholder="••••••••"
                      className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                      disabled={submitting} />
                    <button type="button" onClick={() => togglePasswordVisibility('new')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                      disabled={submitting}>
                      {showPasswords.new
                        ? <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 1-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                        : <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>}
                    </button>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Confirm New Password</label>
                  <div className="relative">
                    <input id="confirmPassword" type={showPasswords.confirm ? 'text' : 'password'}
                      name="confirmPassword" value={formData.confirmPassword} onChange={handleChange}
                      placeholder="••••••••"
                      className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                      disabled={submitting} />
                    <button type="button" onClick={() => togglePasswordVisibility('confirm')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                      disabled={submitting}>
                      {showPasswords.confirm
                        ? <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 1-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                        : <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>}
                    </button>
                  </div>
                </div>

                {(formData.newPassword || formData.confirmPassword) && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2">Password requirements:</p>
                    <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                      <li>✓ At least 8 characters</li>
                      <li>✓ At least one uppercase letter</li>
                      <li>✓ At least one lowercase letter</li>
                      <li>✓ At least one number</li>
                      <li>✓ At least one special character (!@#$%^&*)</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* ── Actions ───────────────────────────────── */}
              <div className={`flex gap-4 pt-6 border-t border-gray-200 dark:border-gray-700 ${isTemporaryPassword ? 'flex-col' : ''}`}>
                <button type="submit" disabled={submitting}
                  className={`py-3 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${isTemporaryPassword ? 'w-full' : 'flex-1'}`}>
                  {submitting ? 'Saving...' : '💾 Save Changes'}
                </button>
                {!isTemporaryPassword && (
                  <button type="button" onClick={() => navigate('/student-dashboard')} disabled={submitting}
                    className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
                    Cancel
                  </button>
                )}
              </div>

            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EditProfilePage
