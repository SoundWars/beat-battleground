/**
 * API Configuration
 * 
 * Blueprint Project System - Environment Configuration
 * Switch between development and production Flask API endpoints
 */

// Environment detection
const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

// API Base URLs - Update these when deploying
const API_URLS = {
  development: "http://localhost:5000/api",
  production: import.meta.env.VITE_API_BASE_URL || "https://your-production-api.com/api",
};

// Current API Base URL
export const API_BASE_URL = isDevelopment 
  ? API_URLS.development 
  : API_URLS.production;

// API Endpoints
export const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    REGISTER: `${API_BASE_URL}/auth/register`,
    LOGIN: `${API_BASE_URL}/auth/login`,
    LOGOUT: `${API_BASE_URL}/auth/logout`,
    ME: `${API_BASE_URL}/auth/me`,
    REFRESH: `${API_BASE_URL}/auth/refresh`,
  },
  
  // Users
  USERS: {
    BASE: `${API_BASE_URL}/users`,
    PROFILE: (id: string) => `${API_BASE_URL}/users/${id}`,
    UPDATE: (id: string) => `${API_BASE_URL}/users/${id}`,
  },
  
  // Artists
  ARTISTS: {
    BASE: `${API_BASE_URL}/artists`,
    DETAIL: (id: string) => `${API_BASE_URL}/artists/${id}`,
    SONGS: (id: string) => `${API_BASE_URL}/artists/${id}/songs`,
  },
  
  // Songs
  SONGS: {
    BASE: `${API_BASE_URL}/songs`,
    DETAIL: (id: string) => `${API_BASE_URL}/songs/${id}`,
    UPLOAD: `${API_BASE_URL}/songs/upload`,
    APPROVE: (id: string) => `${API_BASE_URL}/songs/${id}/approve`,
    REJECT: (id: string) => `${API_BASE_URL}/songs/${id}/reject`,
  },
  
  // Votes
  VOTES: {
    BASE: `${API_BASE_URL}/votes`,
    CAST: `${API_BASE_URL}/votes`,
    CHECK: (songId: string) => `${API_BASE_URL}/votes/check/${songId}`,
    MY_VOTE: `${API_BASE_URL}/votes/my-vote`,
  },
  
  // Leaderboard
  LEADERBOARD: {
    BASE: `${API_BASE_URL}/leaderboard`,
    TOP: (limit: number) => `${API_BASE_URL}/leaderboard?limit=${limit}`,
  },
  
  // Contest
  CONTEST: {
    BASE: `${API_BASE_URL}/contest`,
    CURRENT: `${API_BASE_URL}/contest/current`,
    PHASES: `${API_BASE_URL}/contest/phases`,
  },
  
  // Payments
  PAYMENTS: {
    CREATE_CHECKOUT: `${API_BASE_URL}/payments/create-checkout`,
    VERIFY: `${API_BASE_URL}/payments/verify`,
    WEBHOOK: `${API_BASE_URL}/payments/webhook`,
    STATUS: (sessionId: string) => `${API_BASE_URL}/payments/status/${sessionId}`,
  },
  
  // Admin
  ADMIN: {
    DASHBOARD: `${API_BASE_URL}/admin/dashboard`,
    USERS: `${API_BASE_URL}/admin/users`,
    PENDING_SONGS: `${API_BASE_URL}/admin/songs/pending`,
    CONTESTS: `${API_BASE_URL}/admin/contests`,
    PAYMENTS: `${API_BASE_URL}/admin/payments`,
  },
};

// App Configuration
export const APP_CONFIG = {
  // Artist Registration Fee (in cents for Stripe, or your currency's smallest unit)
  ARTIST_REGISTRATION_FEE: 2500, // $25.00
  ARTIST_REGISTRATION_FEE_DISPLAY: "$25.00",
  CURRENCY: "USD",
  
  // Contest Settings
  CONTEST_DURATION_MONTHS: 3,
  REGISTRATION_PERIOD_MONTHS: 2,
  VOTING_PERIOD_MONTHS: 1,
  
  // File Upload Limits
  MAX_SONG_SIZE_MB: 15,
  ALLOWED_AUDIO_TYPES: ["audio/mpeg", "audio/mp3"],
  
  // Pagination
  DEFAULT_PAGE_SIZE: 10,
  LEADERBOARD_DEFAULT_LIMIT: 50,
};

// Helper function for API calls with auth token
export const getAuthHeaders = (token?: string): HeadersInit => {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  return headers;
};

// Helper for multipart form data (file uploads)
export const getMultipartHeaders = (token?: string): HeadersInit => {
  const headers: HeadersInit = {};
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  return headers;
};

export default {
  API_BASE_URL,
  API_ENDPOINTS,
  APP_CONFIG,
  getAuthHeaders,
  getMultipartHeaders,
};
