import axios from 'axios';
import Constants from 'expo-constants';

const BASE_URL = 'http://192.168.1.71:8000';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || 'Unknown URL';
    console.error(`[API Error] ${url}:`, error.message);
    return Promise.reject(error);
  }
);

export default apiClient;
