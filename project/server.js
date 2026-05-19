// server.js — CraftWorld backend
// Handles user registration, login, and data saving to JSON files
// Run with: node server.js

const express = require('express');
const fs      = require('fs');
const path    = require('path');
const cors    = require('cors');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // serve all HTML/CSS/JS files

// ── File paths ────────────────────────────────────────────────────────────────
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

// ── Helpers ───────────────────────────────────────────────────────────────────
function readUsers() {
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf8');
    const data = JSON.parse(raw);
    return data.users || [];
  } catch (e) {
    console.error('Could not read users.json:', e.message);
    return [];
  }
}

function writeUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify({ users }, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Could not write users.json:', e.message);
    return false;
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/users — admin only, returns all users (no passwords)
app.get('/api/users', (req, res) => {
  const users = readUsers();
  const safe  = users.map(({ password, ...rest }) => rest);
  res.json({ success: true, users: safe });
});

// POST /api/register
app.post('/api/register', (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.json({ success: false, message: 'All fields are required.' });
  }

  if (username.length < 3) {
    return res.json({ success: false, message: 'Username must be at least 3 characters.' });
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return res.json({ success: false, message: 'Username can only contain letters, numbers, and underscores.' });
  }

  if (password.length < 4) {
    return res.json({ success: false, message: 'Password must be at least 4 characters.' });
  }

  const users = readUsers();

  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.json({ success: false, message: 'That username is already taken.' });
  }

  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.json({ success: false, message: 'An account with that email already exists.' });
  }

  const newUser = {
    id:        'user_' + Date.now(),
    username,
    email,
    password,
    role:      'player',
    createdAt: new Date().toISOString().split('T')[0],
    profile: {
      avatar:       '🧑',
      bio:          '',
      playtime:     0,
      blocksMined:  0,
      zombiesKilled:0,
      customMobs:   [],
      achievements: []
    }
  };

  users.push(newUser);
  const saved = writeUsers(users);

  if (!saved) {
    return res.json({ success: false, message: 'Server error: could not save user.' });
  }

  // Return user without password
  const { password: _pw, ...safeUser } = newUser;
  res.json({ success: true, user: safeUser });
});

// POST /api/login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.json({ success: false, message: 'All fields are required.' });
  }

  const users = readUsers();
  const user  = users.find(
    u => u.username.toLowerCase() === username.toLowerCase() && u.password === password
  );

  if (!user) {
    return res.json({ success: false, message: 'Invalid username or password.' });
  }

  const { password: _pw, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

// POST /api/update-profile — save profile changes
app.post('/api/update-profile', (req, res) => {
  const { id, profile } = req.body;

  if (!id) {
    return res.json({ success: false, message: 'User ID required.' });
  }

  const users = readUsers();
  const index = users.findIndex(u => u.id === id);

  if (index === -1) {
    return res.json({ success: false, message: 'User not found.' });
  }

  users[index].profile = { ...users[index].profile, ...profile };
  writeUsers(users);

  const { password: _pw, ...safeUser } = users[index];
  res.json({ success: true, user: safeUser });
});

// POST /api/save-mob — save a custom AI mob to a user's profile
app.post('/api/save-mob', (req, res) => {
  const { userId, mob } = req.body;

  if (!userId || !mob) {
    return res.json({ success: false, message: 'userId and mob are required.' });
  }

  const users = readUsers();
  const index = users.findIndex(u => u.id === userId);

  if (index === -1) {
    return res.json({ success: false, message: 'User not found.' });
  }

  mob.id        = 'mob_' + Date.now();
  mob.createdAt = new Date().toISOString().split('T')[0];
  users[index].profile.customMobs.push(mob);
  writeUsers(users);

  res.json({ success: true, mob });
});

// POST /api/admin/update-user — admin updates a user's role or data
app.post('/api/admin/update-user', (req, res) => {
  const { adminId, targetId, updates } = req.body;

  const users = readUsers();
  const admin = users.find(u => u.id === adminId);

  if (!admin || admin.role !== 'admin') {
    return res.json({ success: false, message: 'Unauthorized.' });
  }

  const index = users.findIndex(u => u.id === targetId);
  if (index === -1) {
    return res.json({ success: false, message: 'Target user not found.' });
  }

  users[index] = { ...users[index], ...updates };
  writeUsers(users);

  res.json({ success: true });
});

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`CraftWorld server running at http://localhost:${PORT}`);
});