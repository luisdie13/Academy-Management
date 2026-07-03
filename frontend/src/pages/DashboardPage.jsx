import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useSettingsStore } from '../stores/settingsStore'
import { formatCurrency } from '../utils/currency'
import api from '../services/api'
import AcademySettingsCard from '../components/AcademySettingsCard'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

function DashboardPage() {
  const { user, logout } = useAuthStore()
  const { currency, fetchCurrency } = useSettingsStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [metrics, setMetrics] = useState({
    activeStudents: 0,
    monthlyClasses: 0,
    pendingBilling: 0,
  })
  const [attendanceData, setAttendanceData] = useState([])
  const [incomeData, setIncomeData] = useState([])

  // Role guard: ProtectedRoute already enforces this, but keep as a safety net
  useEffect(() => {
    if (user && user.role?.toLowerCase() !== 'admin') {
      navigate('/student-dashboard', { replace: true })
    }
  }, [user, navigate])

  useEffect(() => {
    fetchCurrency()
  }, [fetchCurrency])

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true)
      setError(null)

      try {
        let activeStudentsCount = 0
        try {
          const studentsRes = await api.get('/users/students?status=active')
          activeStudentsCount = studentsRes.data.data?.length || 0
        } catch (err) {
          console.error('Error fetching active students:', err)
        }

        let monthlyClassesCount = 0
        try {
          const now = new Date()
          const startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
          const formatDate = (d) => d.toISOString().split('T')[0]
          const classesRes = await api.get(`/classes?start=${formatDate(startDate)}&end=${formatDate(endDate)}`)
          monthlyClassesCount = classesRes.data.data?.length || 0
        } catch (err) {
          console.error('Error fetching monthly classes:', err)
        }

        let pendingBillingAmount = 0
        try {
          const invoicesRes = await api.get('/invoices?status=pending')
          pendingBillingAmount = invoicesRes.data.data?.reduce(
            (sum, inv) => sum + (inv.totalAmount || 0),
            0
          ) || 0
        } catch (err) {
          console.error('Error fetching pending invoices:', err)
        }

        setMetrics({
          activeStudents: activeStudentsCount,
          monthlyClasses: monthlyClassesCount,
          pendingBilling: pendingBillingAmount,
        })

        try {
          const trendRes = await api.get('/stats/attendance-trend')
          setAttendanceData(trendRes.data?.data || [])
        } catch (err) {
          console.error('Error fetching attendance trend:', err)
        }

        try {
          const incomeRes = await api.get('/stats/monthly-income')
          setIncomeData(incomeRes.data?.data || [])
        } catch (err) {
          console.error('Error fetching monthly income:', err)
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err)
        setError('Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Welcome, {user?.fullName || user?.firstName || 'Admin'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-600 dark:text-red-400 text-sm">⚠️ {error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-8 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                Active Students
              </h3>
              <span className="text-3xl">👥</span>
            </div>
            <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">
              {metrics.activeStudents}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Registered students
            </p>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-8 border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                This Month's Classes
              </h3>
              <span className="text-3xl">📚</span>
            </div>
            <p className="text-4xl font-bold text-green-600 dark:text-green-400">
              {metrics.monthlyClasses}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Scheduled classes
            </p>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl p-8 border border-orange-200 dark:border-orange-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                Pending Billing
              </h3>
              <span className="text-3xl">💰</span>
            </div>
            <p className="text-4xl font-bold text-orange-600 dark:text-orange-400">
              {formatCurrency(metrics.pendingBilling, currency)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              To collect
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
              Attendance Trend
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '14px' }} />
                <YAxis stroke="#6b7280" style={{ fontSize: '14px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="attendance"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', r: 5 }}
                  activeDot={{ r: 7 }}
                  name="Attendance %"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
              Monthly Income
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={incomeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '14px' }} />
                <YAxis stroke="#6b7280" style={{ fontSize: '14px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '14px' }} />
                <Bar dataKey="income" fill="#10b981" name="Actual Revenue" />
                <Bar dataKey="billed" fill="#3b82f6" name="Billed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-12 mb-12">
          <AcademySettingsCard />
        </div>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to="/students"
            className="block p-6 bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 rounded-xl border-2 border-primary-200 dark:border-primary-800 hover:shadow-lg transition-all"
          >
            <h3 className="text-lg font-semibold text-primary-600 dark:text-primary-400 mb-2">
              Manage Students
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              View, edit or register students
            </p>
          </Link>

          <Link
            to="/classes"
            className="block p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl border-2 border-green-200 dark:border-green-800 hover:shadow-lg transition-all"
          >
            <h3 className="text-lg font-semibold text-green-600 dark:text-green-400 mb-2">
              Classes & Attendance
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Manage classes and track attendance
            </p>
          </Link>

          <Link
            to="/invoices"
            className="block p-6 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl border-2 border-orange-200 dark:border-orange-800 hover:shadow-lg transition-all"
          >
            <h3 className="text-lg font-semibold text-orange-600 dark:text-orange-400 mb-2">
              Invoices & Payments
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Manage invoices and payments
            </p>
          </Link>

          <Link
            to="/payment-info"
            className="block p-6 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl border-2 border-purple-200 dark:border-purple-800 hover:shadow-lg transition-all"
          >
            <h3 className="text-lg font-semibold text-purple-600 dark:text-purple-400 mb-2">
              Métodos de Pago
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Contacto y cuentas para cobros
            </p>
          </Link>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={handleLogout}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
          >
            🚪 Log Out
          </button>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
