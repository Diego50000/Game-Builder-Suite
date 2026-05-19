// auth.js — talks to server.js API to login, register, and manage users
// All user data is saved to data/users.json on the server

const API = ''; // empty = same origin, works on Replit automatically

// ── Current user (sessionStorage clears on browser close) ────────────────────
function getCurrentUser() {
  const raw = sessionStorage.getItem('craftworld_user');
  return raw ? JSON.parse(raw) : null;
}

function setCurrentUser(user) {
  sessionStorage.setItem('craftworld_user', JSON.stringify(user));
}

function logout() {
  sessionStorage.removeItem('craftworld_user');
  window.location.href = 'login.html';
}

// ── Register ──────────────────────────────────────────────────────────────────
async function registerUser(username, email, password) {
  try {
    const res = await fetch(API + '/api/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, email, password })
    });
    const data = await res.json();
    if (data.success) setCurrentUser(data.user);
    return data;
  } catch (e) {
    return { success: false, message: 'Could not connect to server. Is server.js running?' };
  }
}

// ── Login ─────────────────────────────────────────────────────────────────────
async function loginUser(username, password) {
  try {
    const res = await fetch(API + '/api/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) setCurrentUser(data.user);
    return data;
  } catch (e) {
    return { success: false, message: 'Could not connect to server. Is server.js running?' };
  }
}

// ── Update profile ────────────────────────────────────────────────────────────
async function updateProfile(userId, profileData) {
  try {
    const res = await fetch(API + '/api/update-profile', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id: userId, profile: profileData })
    });
    const data = await res.json();
    if (data.success) setCurrentUser(data.user);
    return data;
  } catch (e) {
    return { success: false, message: 'Could not connect to server.' };
  }
}

// ── Save mob ──────────────────────────────────────────────────────────────────
async function saveMob(userId, mob) {
  try {
    const res = await fetch(API + '/api/save-mob', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ userId, mob })
    });
    return await res.json();
  } catch (e) {
    return { success: false, message: 'Could not connect to server.' };
  }
}

// ── Guards ────────────────────────────────────────────────────────────────────
function requireAuth() {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = 'login.html';
    return null;
  }
  return user;
}

function requireAdmin() {
  const user = getCurrentUser();
  if (!user || user.role !== 'admin') {
    window.location.href = 'index.html';
    return null;
  }
  return user;
}

function redirectIfLoggedIn(dest = 'game.html') {
  const user = getCurrentUser();
  if (user) window.location.href = dest;
}