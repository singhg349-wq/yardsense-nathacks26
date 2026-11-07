// Base URL of the FastAPI backend. Override with VITE_API_URL in frontend/.env.
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export async function getHealth() {
  const res = await fetch(`${API_URL}/health`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
