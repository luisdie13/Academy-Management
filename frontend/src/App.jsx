import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import StudentDashboardPage from './pages/StudentDashboardPage'
import StudentsPage from './pages/StudentsPage'
import ClassesPage from './pages/ClassesPage'
import ChangePasswordPage from './pages/ChangePasswordPage'
import EditProfilePage from './pages/EditProfilePage'
import ProtectedRoute from './components/ProtectedRoute'
import InvoicesPage from './pages/InvoicesPage'
import './styles/print.css'

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  )
}

function AppContent() {
  const { checkAuth } = useAuthStore()
  const location = useLocation()

  useEffect(() => {
    const isDarkMode = localStorage.getItem('theme') === 'dark'
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    }

    const publicRoutes = ['/login', '/register', '/']
    if (!publicRoutes.includes(location.pathname)) {
      checkAuth()
    }
  }, [location.pathname, checkAuth])

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 transition-colors duration-300">
      <main className="container-max py-8">
        <Routes>
          <Route
            path="/"
            element={
              <div className="text-center py-20">
                <h1 className="text-4xl font-bold mb-4">TheAcademy Management</h1>
                <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
                  Professional Attendance Tracking &amp; Billing System
                </p>
                <div className="flex gap-4 justify-center">
                  <Link
                    to="/login"
                    className="px-8 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="px-8 py-3 border-2 border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Register
                  </Link>
                </div>
              </div>
            }
          />

          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />

          {/* /edit-profile: accessible with a temporary password so the user can change it */}
          <Route
            path="/edit-profile"
            element={
              <ProtectedRoute allowTemporaryPassword={true}>
                <EditProfilePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute requiredRole="admin">
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/student-dashboard"
            element={
              <ProtectedRoute requiredRole="student">
                <StudentDashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/students"
            element={
              <ProtectedRoute requiredRole="admin">
                <StudentsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/classes"
            element={
              <ProtectedRoute requiredRole="admin">
                <ClassesPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/invoices"
            element={
              <ProtectedRoute requiredRole="admin">
                <InvoicesPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="*"
            element={
              <div className="text-center py-20">
                <h1 className="text-4xl font-bold mb-4">404</h1>
                <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
                  Page not found
                </p>
                <Link
                  to="/"
                  className="px-8 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Go Home
                </Link>
              </div>
            }
          />
        </Routes>
      </main>

      <footer className="border-t border-gray-200 dark:border-gray-800 mt-20 py-8">
        <div className="container-max text-center text-gray-600 dark:text-gray-400">
          <p>&copy; 2026 TheAcademy Management. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

export default App
