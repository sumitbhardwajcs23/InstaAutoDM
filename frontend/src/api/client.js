// frontend/src/api/client.js

const customBase = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
export const API_BASE = customBase ? `${customBase}/api` : '/api';

export function getAuthToken() {
  return localStorage.getItem('token');
}

export const getToken = getAuthToken;

export function getCurrentUser() {
  const user = localStorage.getItem('user');
  try {
    return user ? JSON.parse(user) : null;
  } catch (e) {
    return null;
  }
}

export function setAuthSession(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

export function clearAuthSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export async function apiFetch(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Session expired or invalid
    clearAuthSession();
    window.dispatchEvent(new Event('auth:unauthorized'));
  }

  return response;
}
