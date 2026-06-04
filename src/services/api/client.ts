import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getDevServerIp = () => {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip) return ip;
  }
  return Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
};

const DEV_SERVER_IP = getDevServerIp();

export const BASE_URL = `http://${DEV_SERVER_IP}:8000`;

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
