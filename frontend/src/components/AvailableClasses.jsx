import { useEffect, useState } from 'react'
import api from '../services/api'

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
      <div className="flex justify-between mb-3">
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-12 ml-2" />
      </div>
      <div className="h-3 bg-gray-100 dark:bg-gray-600 rounded w-full mb-2" />
      <div className="h-3 bg-gray-100 dark:bg-gray-600 rounded w-2/3 mb-5" />
      <div className="h-4 bg-gray-100 dark:bg-gray-600 rounded w-1/2 mb-6" />
      <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-full" />
    </div>
  )
}

function AvailableClasses({ onEnrolled }) {
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notLinked, setNotLinked] = useState(false)
  const [enrollingId, setEnrollingId] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    fetchAvailable()
  }, [])

  const fetchAvailable = async () => {
    setLoading(true)
    setError(null)
    setNotLinked(false)
    try {
      const response = await api.get('/classes/available')
      if (response.data.meta?.notLinkedToAcademy) {
        setNotLinked(true)
        setClasses([])
      } else {
        setClasses(response.data.data || [])
      }
    } catch (err) {
      console.error('Error fetching available classes:', err)
      setError('Could not load available classes. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleEnroll = async (classId, classTitle) => {
    setEnrollingId(classId)
    setSuccessMessage('')
    setError(null)
    try {
      await api.post('/enroll', { classId })
      // Optimistic update: remove the class from the list
      setClasses((prev) => prev.filter((c) => c.id !== classId))
      setSuccessMessage(`You have been enrolled in "${classTitle}".`)
      if (onEnrolled) onEnrolled()
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ||
        'Failed to enroll. Please try again.'
      setError(msg)
    } finally {
      setEnrollingId(null)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Success banner */}
      {successMessage && (
        <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <span className="text-green-600 dark:text-green-400 text-lg leading-none">✓</span>
          <p className="text-green-700 dark:text-green-300 text-sm font-medium">{successMessage}</p>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-600 dark:text-red-400 text-sm">⚠️ {error}</p>
        </div>
      )}

      {notLinked ? (
        <div className="text-center py-16 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border-2 border-dashed border-yellow-300 dark:border-yellow-700">
          <p className="text-3xl mb-3">⚠️</p>
          <p className="text-gray-800 dark:text-gray-200 font-semibold mb-1">
            Account not linked to an academy
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
            Your account is not yet associated with an academy. Please contact your academy
            administrator so they can add you through the student management panel.
          </p>
        </div>
      ) : classes.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <p className="text-3xl mb-3">🎉</p>
          <p className="text-gray-800 dark:text-gray-200 font-semibold mb-1">
            {successMessage ? 'Enrollment complete!' : "You're all caught up!"}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            You are already enrolled in all available classes.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {classes.length} class{classes.length !== 1 ? 'es' : ''} available for enrollment
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {classes.map((cls) => (
              <div
                key={cls.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col"
              >
                {/* Card header */}
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-bold text-gray-900 dark:text-white text-base leading-snug">
                    {cls.title}
                  </h3>
                  <span className="ml-2 flex-shrink-0 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold rounded-full">
                    Active
                  </span>
                </div>

                {/* Description */}
                {cls.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3 flex-1">
                    {cls.description}
                  </p>
                )}

                {/* Instructor */}
                {cls.instructor && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 mb-5">
                    <span>👨‍🏫</span>
                    <span className="font-medium">{cls.instructor}</span>
                  </div>
                )}

                {/* Enroll button */}
                <button
                  onClick={() => handleEnroll(cls.id, cls.title)}
                  disabled={enrollingId === cls.id}
                  className="mt-auto w-full px-4 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                >
                  {enrollingId === cls.id ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Enrolling…
                    </span>
                  ) : (
                    '+ Enroll'
                  )}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default AvailableClasses
