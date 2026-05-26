// server.js — CraftWorld Backend
// Handles user registration, login, profile updates, mobs, and worlds
// Run with: node server.js

const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Serve all HTML/CSS/JS files

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

// ── Routes ──────────────────────────────────────────────────────────────────--

// ===== USER ROUTES =====
// GET /api/users — Fetch a single user's data (by userId)
app.get('/api/users', (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ success: false, message: 'userId is required.' });
  }

  const users = readUsers();
  const user = users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  // Return user without password
  const { password, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

// GET /api/users/all — Admin only, returns all users (no passwords)
app.get('/api/users/all', (req, res) => {
  const users = readUsers();
  const safe = users.map(({ password, ...rest }) => rest);
  res.json({ success: true, users: safe });
});

// POST /api/register — Register a new user
app.post('/api/register', (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  if (username.length < 3) {
    return res.status(400).json({ success: false, message: 'Username must be at least 3 characters.' });
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return res.status(400).json({ success: false, message: 'Username can only contain letters, numbers, and underscores.' });
  }

  if (password.length < 4) {
    return res.status(400).json({ success: false, message: 'Password must be at least 4 characters.' });
  }

  const users = readUsers();

  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(400).json({ success: false, message: 'That username is already taken.' });
  }

  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ success: false, message: 'An account with that email already exists.' });
  }

  const newUser = {
    id: 'user_' + Date.now(),
    username,
    email,
    password,
    role: 'player',
    createdAt: new Date().toISOString().split('T')[0],
    profile: {
      avatar: '🧑',
      bio: '',
      playtime: 0,
      blocksMined: 0,
      zombiesKilled: 0,
      customMobs: [],
      worlds: [],
      achievements: []
    }
  };

  users.push(newUser);
  const saved = writeUsers(users);

  if (!saved) {
    return res.status(500).json({ success: false, message: 'Server error: could not save user.' });
  }

  const { password: _pw, ...safeUser } = newUser;
  res.json({ success: true, user: safeUser });
});

// POST /api/login — Log in a user
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  const users = readUsers();
  const user = users.find(
    u => u.username.toLowerCase() === username.toLowerCase() && u.password === password
  );

  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid username or password.' });
  }

  const { password: _pw, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

// POST /api/update-profile — Update user profile
app.post('/api/update-profile', (req, res) => {
  const { id, profile } = req.body;

  if (!id) {
    return res.status(400).json({ success: false, message: 'User ID required.' });
  }

  const users = readUsers();
  const index = users.findIndex(u => u.id === id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  users[index].profile = { ...users[index].profile, ...profile };
  writeUsers(users);

  const { password: _pw, ...safeUser } = users[index];
  res.json({ success: true, user: safeUser });
});

// ===== MOB ROUTES =====
// POST /api/save-mob — Save a custom mob to a user's profile
app.post('/api/save-mob', (req, res) => {
  const { userId, mob } = req.body;

  if (!userId || !mob) {
    return res.status(400).json({ success: false, message: 'userId and mob are required.' });
  }

  const users = readUsers();
  const index = users.findIndex(u => u.id === userId);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  mob.id = 'mob_' + Date.now();
  mob.createdAt = new Date().toISOString().split('T')[0];
  users[index].profile.customMobs.push(mob);
  writeUsers(users);

  res.json({ success: true, mob });
});

// ===== WORLD ROUTES =====
// POST /api/save-world — Save a user's world
app.post('/api/save-world', (req, res) => {
  const { userId, world } = req.body;

  if (!userId || !world) {
    return res.status(400).json({ success: false, message: 'userId and world are required.' });
  }

  const users = readUsers();
  const index = users.findIndex(u => u.id === userId);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  // Initialize worlds array if it doesn't exist
  if (!users[index].profile.worlds) {
    users[index].profile.worlds = [];
  }

  // Add or update the world
  const worldIndex = users[index].profile.worlds.findIndex(w => w.id === world.id);
  if (worldIndex >= 0) {
    users[index].profile.worlds[worldIndex] = world; // Update existing
  } else {
    users[index].profile.worlds.push(world); // Add new
  }

  writeUsers(users);
  res.json({ success: true, world });
});

// GET /api/load-world — Load a user's world
app.get('/api/load-world', (req, res) => {
  const { userId, worldId } = req.query;

  if (!userId || !worldId) {
    return res.status(400).json({ success: false, message: 'userId and worldId are required.' });
  }

  const users = readUsers();
  const user = users.find(u => u.id === userId);

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  const world = user.profile.worlds?.find(w => w.id === worldId);
  if (!world) {
    return res.status(404).json({ success: false, message: 'World not found.' });
  }

  res.json({ success: true, world });
});

// ===== ADMIN ROUTES =====
// POST /api/admin/update-user — Admin updates a user's role or data
app.post('/api/admin/update-user', (req, res) => {
  const { adminId, targetId, updates } = req.body;

  const users = readUsers();
  const admin = users.find(u => u.id === adminId);

  if (!admin || admin.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Unauthorized.' });
  }

  const index = users.findIndex(u => u.id === targetId);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Target user not found.' });
  }

  users[index] = { ...users[index], ...updates };
  writeUsers(users);

  res.json({ success: true });
});

// ===== /game/* ROUTES (active — /api/ is proxied away by Replit) =====

app.get('/game/users', (req, res) => {
  const users = readUsers();
  const safe = users.map(({ password, ...rest }) => rest);
  res.json({ success: true, users: safe });
});

app.post('/game/register', (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  if (username.length < 3)
    return res.status(400).json({ success: false, message: 'Username must be at least 3 characters.' });
  if (!/^[a-zA-Z0-9_]+$/.test(username))
    return res.status(400).json({ success: false, message: 'Username can only contain letters, numbers, and underscores.' });
  if (password.length < 4)
    return res.status(400).json({ success: false, message: 'Password must be at least 4 characters.' });

  const users = readUsers();
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase()))
    return res.status(400).json({ success: false, message: 'That username is already taken.' });
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase()))
    return res.status(400).json({ success: false, message: 'An account with that email already exists.' });

  const newUser = {
    id: 'user_' + Date.now(), username, email, password, role: 'player',
    createdAt: new Date().toISOString().split('T')[0],
    profile: { avatar: '🧑', bio: '', playtime: 0, blocksMined: 0, zombiesKilled: 0, customMobs: [], worlds: [], achievements: [] }
  };
  users.push(newUser);
  if (!writeUsers(users))
    return res.status(500).json({ success: false, message: 'Server error: could not save user.' });
  const { password: _pw, ...safeUser } = newUser;
  res.json({ success: true, user: safeUser });
});

app.post('/game/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  const users = readUsers();
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
  if (!user)
    return res.status(401).json({ success: false, message: 'Invalid username or password.' });
  const { password: _pw, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

app.post('/game/update-profile', (req, res) => {
  const { id, profile } = req.body;
  if (!id)
    return res.status(400).json({ success: false, message: 'User ID required.' });
  const users = readUsers();
  const index = users.findIndex(u => u.id === id);
  if (index === -1)
    return res.status(404).json({ success: false, message: 'User not found.' });
  users[index].profile = { ...users[index].profile, ...profile };
  writeUsers(users);
  const { password: _pw, ...safeUser } = users[index];
  res.json({ success: true, user: safeUser });
});

app.post('/game/save-mob', (req, res) => {
  const { userId, mob } = req.body;
  if (!userId || !mob)
    return res.status(400).json({ success: false, message: 'userId and mob are required.' });
  const users = readUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index === -1)
    return res.status(404).json({ success: false, message: 'User not found.' });
  mob.id = 'mob_' + Date.now();
  mob.createdAt = new Date().toISOString().split('T')[0];
  users[index].profile.customMobs.push(mob);
  writeUsers(users);
  res.json({ success: true, mob });
});

app.post('/game/admin/update-user', (req, res) => {
  const { adminId, targetId, updates } = req.body;
  const users = readUsers();
  const admin = users.find(u => u.id === adminId);
  if (!admin || admin.role !== 'admin')
    return res.status(403).json({ success: false, message: 'Unauthorized.' });
  const index = users.findIndex(u => u.id === targetId);
  if (index === -1)
    return res.status(404).json({ success: false, message: 'Target user not found.' });
  users[index] = { ...users[index], ...updates };
  writeUsers(users);
  res.json({ success: true });
});

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`CraftWorld server running at http://localhost:${PORT}`);
});