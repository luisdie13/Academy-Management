import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

const ROLE_HOME = {
  admin: '/dashboard',
  student: '/student-dashboard',
}

function ProtectedRoute({
  children,
  allowTemporaryPassword = false,
  requiredRole = null,
}) {
  const { isAuthenticated, loading, user } = useAuthStore()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Force password change before accessing any protected resource
  if (user?.mustChangePassword === true && !allowTemporaryPassword) {
    return <Navigate to="/edit-profile" replace />
  }

  // Role-based access: redirect to the user's own home if role doesn't match
  if (requiredRole) {
    const userRole = user?.role?.toLowerCase()
    if (userRole !== requiredRole) {
      const home = ROLE_HOME[userRole] || '/login'
      return <Navigate to={home} replace />
    }
  }

  return children
}

export default ProtectedRoute
