import axios from 'axios';
import Constants from 'expo-constants';

/**
 * API Configuration
 * Replace the IP with your local machine's LAN IP when running on a real device.
 * For Android Emulator: 10.0.2.2
 * For iOS Simulator: 127.0.0.1
 */
const BASE_URL = 'http://192.168.1.73:8000'; // Change this to your local machine IP

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Structured Debugging Interceptors
apiClient.interceptors.request.use((config) => {
  console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
    params: config.params,
    baseURL: config.baseURL,
  });
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    console.log(`[API Response] ${response.status} ${response.config.url}`, {
      dataCount: Array.isArray(response.data) ? response.data.length : 'N/A',
    });
    return response;
  },
  (error) => {
    console.error(`[API Error] ${error.config?.url || 'Unknown URL'}`, {
      message: error.message,
      code: error.code,
      status: error.response?.status,
    });
    return Promise.reject(error);
  }
);

export default apiClient;
