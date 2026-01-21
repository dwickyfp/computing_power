import axios from 'axios'

// API URL configuration:
// 1. If VITE_API_URL is set explicitly, use it
// 2. In development mode (npm run dev), use localhost:8000/api/v1
// 3. In production mode, use current origin + /api (ensures same host:port)
const getBaseUrl = (): string => {
    // Explicit env var takes priority
    if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL
    }
    // Development uses localhost
    if (import.meta.env.DEV) {
        return 'http://localhost:8000/api/v1'
    }
    // Production: use same origin as current page + /api
    // This ensures API calls go to the same host:port as the web app
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `${origin}/api`
}

const baseURL = getBaseUrl()
console.log('[API Client] Base URL:', baseURL, '| Origin:', window.location.origin)

export const api = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json',
    },
})

// Add response interceptor for error handling if needed
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // You can handle global errors here, e.g., 401 Unauthorized
        return Promise.reject(error)
    }
)
