import axios from 'axios'

// Relative URL — all requests go through the Vite dev-server proxy.
// In Docker: Vite proxies /api → http://backend:3000/api (service name, not localhost).
// In local dev: Vite proxies /api → http://localhost:3000/api.
// Never use an absolute URL here; that bypasses the proxy and breaks Docker networking.
const api = axios.create({
  baseURL: '/api',
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
