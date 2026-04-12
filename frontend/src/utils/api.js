import axios from 'axios';

const API_URL = 'https://stockcentral-production.up.railway.app/api';

const api = axios.create({ baseURL: API_URL, withCredentials: true });

api.interceptors.request.use(config => {
    const token = localStorage.getItem('stockcentral_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

api.interceptors.response.use(
    res => res,
    err => {
          if (err.response?.status === 401) {
                  localStorage.removeItem('stockcentral_token');
                  window.location.href = '/login';
          }
          return Promise.reject(err);
    }
  );

// v2
export default api;
