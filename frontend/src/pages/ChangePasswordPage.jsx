import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import api from '../services/api'

function ChangePasswordPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, checkAuth } = useAuthStore()

  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  })

  // Allow access when arriving from login with mustChangePassword; redirect home otherwise
  useEffect(() => {
    const fromLogin = location.state?.fromLogin
    if (!fromLogin && !user?.mustChangePassword) {
      const home = user?.role?.toLowerCase() === 'admin' ? '/dashboard' : '/student-dashboard'
      navigate(home)
    }
  }, [user, navigate, location.state])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (error) setError('')
  }

  const togglePasswordVisibility = (field) => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }))
  }

  const validatePasswords = () => {
    if (!formData.currentPassword) {
      setError('Please enter your current password')
      return false
    }
    if (!formData.newPassword || formData.newPassword.length < 8) {
      setError('New password must be at least 8 characters')
      return false
    }
    if (!formData.confirmPassword) {
      setError('Please confirm your new password')
      return false
    }
    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match')
      return false
    }
    if (formData.currentPassword === formData.newPassword) {
      setError('New password must be different from the current one')
      return false
    }
    const passwordRegex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/
    if (!passwordRegex.test(formData.newPassword)) {
      setError('Password must contain uppercase, lowercase, numbers and special characters')
      return false
    }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!validatePasswords()) return

    setLoading(true)
    try {
      await api.put('/users/profile', { password: formData.newPassword })

      setSuccess('Password changed successfully!')
      setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' })

      await checkAuth()

      const home = user?.role?.toLowerCase() === 'admin' ? '/dashboard' : '/student-dashboard'
      setTimeout(() => navigate(home), 2000)
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Failed to change password'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const EyeOffIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 1-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  )

  const EyeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  )

  const PasswordField = ({ id, field, label }) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={showPasswords[field] ? 'text' : 'password'}
          name={id}
          value={formData[id]}
          onChange={handleChange}
          placeholder="••••••••"
          className="w-full px-4 py-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400 transition-all"
          disabled={loading}
        />
        <button
          type="button"
          onClick={() => togglePasswordVisibility(field)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          disabled={loading}
          aria-label={`Toggle ${label} visibility`}
        >
          {showPasswords[field] ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg dark:shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-amber-500 to-amber-600 dark:from-amber-600 dark:to-amber-700 px-6 py-8">
            <h1 className="text-3xl font-bold text-white text-center">Change Password</h1>
            <p className="text-amber-100 text-center mt-2">
              You must change your password to continue
            </p>
          </div>

          <div className="px-6 py-8">
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-600 dark:text-red-400 text-sm font-medium">⚠️ {error}</p>
              </div>
            )}

            {success && (
              <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-green-600 dark:text-green-400 text-sm font-medium">✓ {success}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <PasswordField id="currentPassword" field="current" label="Current Password" />
              <PasswordField id="newPassword" field="new" label="New Password" />
              <PasswordField id="confirmPassword" field="confirm" label="Confirm New Password" />

              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2">
                  Password requirements:
                </p>
                <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                  <li>✓ At least 8 characters</li>
                  <li>✓ At least one uppercase letter</li>
                  <li>✓ At least one lowercase letter</li>
                  <li>✓ At least one number</li>
                  <li>✓ At least one special character (!@#$%^&*)</li>
                </ul>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? 'Changing password...' : 'Change Password'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleLogout}
                className="w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
              >
                ← Back to login
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChangePasswordPage
