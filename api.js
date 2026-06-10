// api.js — All backend API calls
const BASE = '/api';

function getToken() { return localStorage.getItem('sb_token'); }

async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(BASE + path, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function apiUpload(path, formData) {
  const token = getToken();
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
  const res = await fetch(BASE + path, { method: 'POST', headers, body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data;
}

const API = {
  signup: d => apiFetch('/auth/signup', { method: 'POST', body: JSON.stringify(d) }),
  login:  d => apiFetch('/auth/login',  { method: 'POST', body: JSON.stringify(d) }),

  // Files
  uploadFiles: fd => apiUpload('/files/upload', fd),
  getFiles:    ()  => apiFetch('/files'),
  deleteFile:  id  => apiFetch(`/files/${id}`, { method: 'DELETE' }),
  getContext:  ()  => apiFetch('/files/context'),

  // AI Chat — sends its own history so each session is isolated
  chat: (message, history = [], sessionId = '') =>
    apiFetch('/ai/chat', { method: 'POST', body: JSON.stringify({ message, history, session_id: sessionId }) }),
  getChatHistory:  () => apiFetch('/ai/chat/history'),
  clearChat:       () => apiFetch('/ai/chat/history', { method: 'DELETE' }),

  // One-shot AI — no history, used for answer checking & model answers
  askOnce: prompt => apiFetch('/ai/ask', { method: 'POST', body: JSON.stringify({ prompt }) }),

  // Quiz
  generateQuiz:    (t, n)  => apiFetch('/ai/quiz',        { method: 'POST', body: JSON.stringify({ topic: t, count: n }) }),
  saveQuiz:        (t,s,n) => apiFetch('/ai/quiz/save',   { method: 'POST', body: JSON.stringify({ topic: t, score: s, total: n }) }),
  getQuizResults:  ()      => apiFetch('/ai/quiz/results'),

  // Notes
  generateNotes:   t  => apiFetch('/ai/notes',       { method: 'POST', body: JSON.stringify({ topic: t }) }),
  getNotes:        ()  => apiFetch('/ai/notes'),
  deleteNote:      id  => apiFetch(`/ai/notes/${id}`, { method: 'DELETE' }),

  // Questions
  generateQs: t  => apiFetch('/ai/questions', { method: 'POST', body: JSON.stringify({ topic: t }) }),
  getQs:      ()  => apiFetch('/ai/questions'),

  // Summarize
  summarize: () => apiFetch('/ai/summarize', { method: 'POST' }),

  // Users
  getMe:       () => apiFetch('/users/me'),
  getOrgUsers: () => apiFetch('/users/org'),
  getProgress: () => apiFetch('/users/progress'),
  getRoutine:  () => apiFetch('/users/routine'),
  saveRoutine: (day, slot, subject) => apiFetch('/users/routine', { method: 'POST', body: JSON.stringify({ day, slot, subject }) }),
  delRoutine:  (day, slot)          => apiFetch('/users/routine', { method: 'DELETE', body: JSON.stringify({ day, slot }) }),
};