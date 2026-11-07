// Base URL of the FastAPI backend. Override with VITE_API_URL in frontend/.env.
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

async function apiRequest(path, options) {
  const res = await fetch(`${API_URL}${path}`, options)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const detail = typeof data.detail === 'string' ? data.detail : `HTTP ${res.status}`
    throw new Error(detail)
  }
  return res.json()
}

export async function getHealth() {
  return apiRequest('/health')
}

export const getProjects = () => apiRequest('/projects')
export const getClasses = () => apiRequest('/classes')
export const getPlan = () => apiRequest('/plan')
export const postPlan = (shifts) => apiRequest('/plan', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ shifts }),
})
export const postDashboard = (shifts) => apiRequest('/dashboard', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ shifts }),
})
export const recommend = (body) => apiRequest('/recommend', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})
