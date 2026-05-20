import axios from 'axios';

const API_BASE_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? '/api'
  : '/api/proxy/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Interceptor to add JWT token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor to handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const formatImageUrl = (url?: string | null) => {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  let cleanUrl = url;
  if (cleanUrl.startsWith('./')) {
    cleanUrl = cleanUrl.substring(1);
  }
  if (!cleanUrl.startsWith('/')) {
    cleanUrl = '/' + cleanUrl;
  }
  return cleanUrl;
};

export default api;
