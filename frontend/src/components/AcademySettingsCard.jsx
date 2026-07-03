import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import api from '../services/api'
import { useTheme } from '../context/ThemeContext'
import { applyPalette } from '../utils/colorPalette'

function AcademySettingsCard() {
  const { user } = useAuthStore()
  const { updateTheme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [settings, setSettings] = useState(null)
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    subdomain: '',
    primary_color: '#3B82F6',
    secondary_color: '#10B981'
  })
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    fetchAcademySettings()
  }, [])

  // Live preview: apply palette while editing so admin sees changes instantly
  useEffect(() => {
    if (!editing) return
    if (/^#[0-9a-fA-F]{6}$/.test(formData.primary_color)) {
      applyPalette(formData.primary_color)
    }
  }, [formData.primary_color, editing])

  useEffect(() => {
    if (!editing) return
    document.documentElement.style.setProperty('--secondary-color', formData.secondary_color)
  }, [formData.secondary_color, editing])

  const fetchAcademySettings = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.get('/academy/profile')

      if (response.data?.data) {
        setSettings(response.data.data)
        setFormData({
          name: response.data.data.name || '',
          subdomain: response.data.data.subdomain || '',
          primary_color: response.data.data.primary_color || '#3B82F6',
          secondary_color: response.data.data.secondary_color || '#10B981'
        })
      }
    } catch (err) {
      console.error('Error fetching academy settings:', err)
      setError(
        err.response?.data?.error?.message ||
        'Failed to load academy settings'
      )
      setSettings({
        name: null,
        subdomain: null,
        primary_color: '#3B82F6',
        secondary_color: '#10B981',
        logo_url: null,
        is_active: false
      })
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleUpdateProfile = async () => {
    if (!formData.name || formData.name.trim() === '') {
      setError('Academy name is required')
      return
    }

    try {
      setUpdating(true)
      setError(null)
      setSuccess(null)

      const updatePayload = {
        name: formData.name,
        primary_color: formData.primary_color,
        secondary_color: formData.secondary_color,
        ...(formData.subdomain.trim() && { subdomain: formData.subdomain.trim() })
      }

      const response = await api.put('/academy/profile', updatePayload)

      if (response.data?.data) {
        setSettings(response.data.data)
        updateTheme(formData.primary_color, formData.secondary_color)
        setSuccess('Academy settings updated successfully')
        setEditing(false)
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err) {
      console.error('Error updating academy profile:', err)
      setError(
        err.response?.data?.error?.message ||
        'Failed to update academy settings'
      )
    } finally {
      setUpdating(false)
    }
  }

  const handleCancel = () => {
    setEditing(false)
    if (settings) {
      const savedPrimary = settings.primary_color || '#0284c7'
      const savedSecondary = settings.secondary_color || '#10B981'
      updateTheme(savedPrimary, savedSecondary)
      setFormData({
        name: settings.name || '',
        subdomain: settings.subdomain || '',
        primary_color: savedPrimary,
        secondary_color: savedSecondary,
      })
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center h-40">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
            <p className="mt-3 text-gray-600 dark:text-gray-400">Loading settings...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-700">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <span className="text-3xl">⚙️</span>
          Academy Settings
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Manage your academy identity and settings
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-600 dark:text-red-400 text-sm">⚠️ {error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-green-600 dark:text-green-400 text-sm">✅ {success}</p>
        </div>
      )}

      <div className="mb-8 space-y-4">
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Academy Name
          </label>
          <p className="text-gray-900 dark:text-white text-lg font-medium">
            {settings?.name || '(Not configured)'}
          </p>
        </div>

        {settings?.subdomain && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Academy Code (Subdomain)
            </label>
            <p className="text-gray-900 dark:text-white font-mono text-lg">
              {settings.subdomain}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              Students use this code to register with your academy
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Primary Color
            </label>
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded border-2 border-gray-300"
                style={{ backgroundColor: settings?.primary_color || '#3B82F6' }}
              />
              <p className="text-gray-900 dark:text-white font-mono">
                {settings?.primary_color || '#3B82F6'}
              </p>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Secondary Color
            </label>
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded border-2 border-gray-300"
                style={{ backgroundColor: settings?.secondary_color || '#10B981' }}
              />
              <p className="text-gray-900 dark:text-white font-mono">
                {settings?.secondary_color || '#10B981'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg transition-all duration-300 flex items-center justify-center gap-2"
          >
            <span>✏️</span>
            Edit Settings
          </button>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Academy Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="e.g. XYZ Music Academy"
                className="w-full px-4 py-3 rounded-lg border-2 border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition-colors"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Your academy's display name
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Academy Code (Subdomain)
              </label>
              <input
                type="text"
                name="subdomain"
                value={formData.subdomain}
                onChange={handleInputChange}
                placeholder="e.g. my-music-academy"
                className="w-full px-4 py-3 rounded-lg border-2 border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition-colors"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Lowercase letters, numbers and hyphens only. Students use this code to find your academy during registration.
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Primary Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  name="primary_color"
                  value={formData.primary_color}
                  onChange={handleInputChange}
                  className="w-16 h-12 rounded cursor-pointer border border-gray-300"
                />
                <input
                  type="text"
                  value={formData.primary_color}
                  onChange={(e) => setFormData(prev => ({ ...prev, primary_color: e.target.value }))}
                  placeholder="#3B82F6"
                  className="flex-1 px-4 py-2 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Secondary Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  name="secondary_color"
                  value={formData.secondary_color}
                  onChange={handleInputChange}
                  className="w-16 h-12 rounded cursor-pointer border border-gray-300"
                />
                <input
                  type="text"
                  value={formData.secondary_color}
                  onChange={(e) => setFormData(prev => ({ ...prev, secondary_color: e.target.value }))}
                  placeholder="#10B981"
                  className="flex-1 px-4 py-2 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={handleUpdateProfile}
                disabled={!formData.name || formData.name.trim() === '' || updating}
                className={`flex-1 px-6 py-3 font-semibold rounded-lg transition-all duration-300 ${
                  !formData.name || formData.name.trim() === '' || updating
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {updating ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={handleCancel}
                disabled={updating}
                className="flex-1 px-6 py-3 font-semibold rounded-lg transition-colors bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
          ℹ️ About Academy Settings
        </h3>
        <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
          <li>✓ Your academy name appears in all documents and communications</li>
          <li>✓ The academy code must be unique — you'll get an error if it's already taken</li>
          <li>✓ Custom colors will be reflected in your academy interface</li>
          <li>✓ Changes apply immediately upon saving</li>
        </ul>
      </div>
    </div>
  )
}

export default AcademySettingsCard
