import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import api from '../services/api'
import StudentCalendar from '../components/StudentCalendar'
import StudentBilling, { PaymentInfoPanel } from '../components/StudentBilling'
import AvailableClasses from '../components/AvailableClasses'

function StudentDashboardPage() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [myClasses, setMyClasses] = useState([])
  const [classesLoading, setClassesLoading] = useState(true)
  const [classesError, setClassesError] = useState(null)
  const [enrollCount, setEnrollCount] = useState(0)
  const [attendanceData, setAttendanceData] = useState([])
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [invoices, setInvoices] = useState([])
  const [invoicesLoading, setInvoicesLoading] = useState(false)
  const [paymentMethods, setPaymentMethods] = useState([])
  const [academyInfo, setAcademyInfo] = useState(null)

  // Role guard: only students may access this page
  useEffect(() => {
    const userRole = user?.role?.toLowerCase()
    if (user && userRole !== 'student') {
      navigate('/dashboard', { replace: true })
      return
    }
    setLoading(false)
  }, [user, navigate])

  useEffect(() => {
    const fetchMyClasses = async () => {
      try {
        setClassesLoading(true)
        setClassesError(null)
        const response = await api.get('/classes')
        const data = response.data
        if (data && Array.isArray(data.data)) {
          setMyClasses(data.data)
        } else if (Array.isArray(data)) {
          setMyClasses(data)
        } else {
          setMyClasses([])
        }
      } catch (error) {
        console.error('Error fetching student classes:', error)
        setClassesError(error.message)
        setMyClasses([])
      } finally {
        setClassesLoading(false)
      }
    }

    if (user?.id) {
      fetchMyClasses()
    }
  }, [user, enrollCount])

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const handleEditProfile = () => {
    navigate('/edit-profile')
  }

  useEffect(() => {
    if (!user?.id) return

    const fetchAttendance = async () => {
      setAttendanceLoading(true)
      try {
        const now = new Date()
        const start = `${now.getFullYear()}-01-01`
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
        const response = await api.get(`/attendance/student/${user.id}?start=${start}&end=${end}`)
        const raw = response.data?.data?.records || response.data?.records || []
        const mapped = raw.map((r) => ({
          date: r.date || r.class_date || r.marked_at?.split('T')[0],
          status: r.status,
        })).filter((r) => r.date)
        setAttendanceData(mapped)
      } catch (err) {
        console.error('Error fetching attendance:', err)
        setAttendanceData([])
      } finally {
        setAttendanceLoading(false)
      }
    }

    const fetchInvoices = async () => {
      setInvoicesLoading(true)
      try {
        const response = await api.get(`/invoices/student/${user.id}`)
        const data = response.data?.data || []
        setInvoices(data.sort((a, b) => (b.invoiceMonth || '').localeCompare(a.invoiceMonth || '')))
      } catch (err) {
        console.error('Error fetching invoices:', err)
        setInvoices([])
      } finally {
        setInvoicesLoading(false)
      }
    }

    const fetchPaymentInfo = async () => {
      try {
        const res = await api.get('/settings/payment-methods')
        setPaymentMethods(res.data?.data || [])
        setAcademyInfo(res.data?.academyInfo || null)
      } catch {
        // Non-critical — silently ignore
      }
    }

    fetchAttendance()
    fetchInvoices()
    fetchPaymentInfo()
  }, [user])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  const firstName = user?.firstName || 'Student'

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 print:hidden">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            My Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Welcome, {firstName}!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 print:hidden">
          <div
            onClick={() => setActiveTab('attendance')}
            className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-8 border border-blue-200 dark:border-blue-800 cursor-pointer hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                My Attendance
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              View attendance calendar
            </p>
          </div>

          <div
            onClick={() => setActiveTab('billing')}
            className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-8 border border-green-200 dark:border-green-800 cursor-pointer hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                Billing & Payments
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              View billing status
            </p>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl p-8 border border-orange-200 dark:border-orange-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                My Classes
              </h3>
            </div>
            <p className="text-4xl font-bold text-orange-600 dark:text-orange-400">
              {classesLoading ? '...' : myClasses?.length || 0}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Active classes
            </p>
          </div>
        </div>

        <div className="mb-8 flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 print:hidden">
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'attendance', label: 'My Attendance' },
            { key: 'billing', label: 'Billing & Payments' },
            { key: 'enroll', label: 'Available Classes' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-6 py-3 font-semibold border-b-2 transition-colors ${
                activeTab === key
                  ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-8">
            <PaymentInfoPanel paymentMethods={paymentMethods} academyInfo={academyInfo} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                  Classes
                </h2>
                <div className="space-y-4">
                  {classesLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600 mx-auto"></div>
                      <p className="mt-2 text-gray-600 dark:text-gray-400">Loading classes...</p>
                    </div>
                  ) : classesError ? (
                    <div className="text-center py-12 px-6 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl border border-orange-200 dark:border-orange-800">
                      <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-300 mb-2">
                        Unable to load your classes
                      </h3>
                      <p className="text-sm text-orange-800 dark:text-orange-200 mb-6 max-w-md">
                        We are experiencing a temporary issue. Please try reloading the page.
                      </p>
                      <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-colors"
                      >
                        Reload page
                      </button>
                    </div>
                  ) : myClasses?.length > 0 ? (
                    myClasses.slice(0, 3).map((cls, idx) => (
                      <div key={cls.id || idx} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{cls.title}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {cls.description && cls.description}
                            {cls.instructor && ` • Instructor: ${cls.instructor}`}
                          </p>
                        </div>
                        <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-semibold">
                          Enrolled
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-600 dark:text-gray-400">You are not enrolled in any classes</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                  My Profile
                </h2>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Name</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {user?.firstName} {user?.lastName}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {user?.email}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Phone</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {user?.phone || 'Not specified'}
                    </p>
                  </div>
                  {user?.age != null && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Age</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {user.age} years old
                      </p>
                    </div>
                  )}
                  {user?.paymentMode && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Payment Mode</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
                        {user.paymentMode}
                      </p>
                    </div>
                  )}
                  <button
                    onClick={handleEditProfile}
                    className="w-full mt-4 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    Edit Profile
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'attendance' && (
          <div className="space-y-8">
            {attendanceLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600 dark:text-gray-400">Loading attendance...</p>
                </div>
              </div>
            ) : (() => {
                // Derive scheduled days from inscriptions (admin-configured) +
                // from attendance history (inferred from past records).
                const DOW_NAMES = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
                const scheduledSet = new Set(myClasses.flatMap(c => c.daysOfWeek || []))
                attendanceData.forEach(({ date }) => {
                  if (!date) return
                  const ds = String(date).split(/[T ]/)[0]
                  const jsDay = new Date(ds + 'T12:00:00').getDay()
                  if (jsDay >= 0 && jsDay <= 6) scheduledSet.add(DOW_NAMES[jsDay])
                })
                return (
                  <StudentCalendar
                    attendanceData={attendanceData}
                    scheduledDaysOfWeek={[...scheduledSet]}
                    onDateClick={() => {}}
                  />
                )
              })()}
          </div>
        )}

        {activeTab === 'billing' && (
          <div className="space-y-8">
            {invoicesLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando facturas…</p>
                </div>
              </div>
            ) : (
              <StudentBilling
                billingMode={user?.paymentMode || 'postpaid'}
                invoices={invoices}
                creditBalance={user?.creditBalance || 0}
                classPrice={user?.classPrice || 0}
                onDownloadInvoice={(id) => window.open(`/api/invoices/${id}/pdf`, '_blank')}
                paymentMethods={paymentMethods}
                academyInfo={academyInfo}
              />
            )}
          </div>
        )}

        {activeTab === 'enroll' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Available Classes</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Classes your academy has opened for enrollment.
              </p>
            </div>
            <AvailableClasses onEnrolled={() => setEnrollCount((c) => c + 1)} />
          </div>
        )}

        <div className="mt-12 flex justify-end print:hidden">
          <button
            onClick={handleLogout}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  )
}

export default StudentDashboardPage
