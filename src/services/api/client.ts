import axios from 'axios';

/**
 * DEPRECATED & PURGED: AuraMusic is a 100% on-device architecture.
 * No FastAPI or remote backend server (10.0.2.2:8000) is used.
 * All media streaming and discovery calls communicate directly from Android
 * to YouTube Music, Googlevideo CDN, and LRCLIB.
 * 
 * Any accidental invocations fail immediately without network hang.
 */
export const BASE_URL = 'http://127.0.0.1:0';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 50,
});

apiClient.interceptors.request.use(() => {
  return Promise.reject(new Error('[FastAPI Purged] AuraMusic is 100% on-device. Backend servers are disabled.'));
});

export default apiClient;
