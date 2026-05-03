import axios from 'axios'
import { Toast } from 'vant'

const BASE_URL = import.meta.env.VITE_API_BASE || '/api'

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

apiClient.interceptors.request.use(
  config => {
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

apiClient.interceptors.response.use(
  response => {
    return response.data
  },
  error => {
    const message = error.response?.data?.error || error.message || 'Network error'
    Toast(message)
    return Promise.reject(error)
  }
)

export const getLatestReport = () => {
  return apiClient.get('/report/latest')
}

export const getReportByDate = (date) => {
  return apiClient.get(`/report/${date}`)
}

export const getTopics = (date) => {
  return apiClient.get('/topics', { params: { date } })
}

export const getStats = () => {
  return apiClient.get('/stats')
}

export const getLogs = (limit = 50) => {
  return apiClient.get('/logs', { params: { limit } })
}

export const getHealth = () => {
  return apiClient.get('/health')
}

export default apiClient
