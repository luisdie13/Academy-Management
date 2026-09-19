import axios from 'axios'

// In dev: VITE_API_URL=/api  → goes through Vite proxy → localhost:3000
// In prod: VITE_API_URL=https://your-backend.vercel.app/api → direct request
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true, // sends the HttpOnly cookie on every request automatically
  headers: {
    'Content-Type': 'application/json',
  },
})

// On session expiry (401), redirect to login — but skip auth endpoints
// so login/register/profile failures are handled by their own callers.
// Callers can also pass { skipAuthRedirect: true } to opt out (e.g. public
// endpoints used in the registration flow before the user is authenticated).
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      !error.config?.url?.includes('/auth/') &&
      !error.config?.skipAuthRedirect
    ) {
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
