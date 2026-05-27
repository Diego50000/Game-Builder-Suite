// server.js — CraftWorld Backend
// Handles user registration, login, profile updates, mobs, worlds, stats, and admin features
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
const PROFILES_FILE = path.join(__dirname, 'data', 'profiles.json');
const LEADERBOARD_FILE = path.join(__dirname, 'data', 'leaderboard.json');

// ── Initialize data files ───────────────────────────────────────────────────
function initializeDataFiles() {
  if (!fs.existsSync(path.dirname(USERS_FILE))) {
    fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
  }
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2), 'utf8');
  }
  if (!fs.existsSync(PROFILES_FILE)) {
    fs.writeFileSync(PROFILES_FILE, JSON.stringify({ profiles: [] }, null, 2), 'utf8');
  }
  if (!fs.existsSync(LEADERBOARD_FILE)) {
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify({ blocksMined: [], zombiesKilled: [], playtime: [] }, null, 2), 'utf8');
  }
}
initializeDataFiles();

// ── Helpers for users.json ───────────────────────────────────────────────────
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
    rebuildLeaderboard(users); // Update leaderboard when users change
    return true;
  } catch (e) {
    console.error('Could not write users.json:', e.message);
    return false;
  }
}

// ── Helpers for profiles.json ─────────────────────────────────────────────────
function readProfiles() {
  try {
    const raw = fs.readFileSync(PROFILES_FILE, 'utf8');
    return JSON.parse(raw).profiles || [];
  } catch (e) {
    console.error('Could not read profiles.json:', e.message);
    return [];
  }
}

function writeProfiles(profiles) {
  try {
    fs.writeFileSync(PROFILES_FILE, JSON.stringify({ profiles }, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Could not write profiles.json:', e.message);
    return false;
  }
}

// ── Helpers for leaderboard.json ─────────────────────────────────────────────
function readLeaderboard() {
  try {
    const raw = fs.readFileSync(LEADERBOARD_FILE, 'utf8');
    return JSON.parse(raw) || { blocksMined: [], zombiesKilled: [], playtime: [] };
  } catch (e) {
    console.error('Could not read leaderboard.json:', e.message);
    return { blocksMined: [], zombiesKilled: [], playtime: [] };
  }
}

function writeLeaderboard(leaderboard) {
  try {
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(leaderboard, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Could not write leaderboard.json:', e.message);
    return false;
  }
}

// ── Rebuild leaderboard from users ────────────────────────────────────────────
function rebuildLeaderboard(users) {
  const leaderboard = {
    blocksMined: [],
    zombiesKilled: [],
    playtime: []
  };

  users.forEach(user => {
    if (user.profile) {
      // Blocks Mined Leaderboard
      if (user.profile.blocksMined > 0) {
        leaderboard.blocksMined.push({
          userId: user.id,
          username: user.username,
          value: user.profile.blocksMined,
          lastUpdated: new Date().toISOString()
        });
      }

      // Zombies Killed Leaderboard
      if (user.profile.zombiesKilled > 0) {
        leaderboard.zombiesKilled.push({
          userId: user.id,
          username: user.username,
          value: user.profile.zombiesKilled,
          lastUpdated: new Date().toISOString()
        });
      }

      // Playtime Leaderboard
      if (user.profile.playtime > 0) {
        leaderboard.playtime.push({
          userId: user.id,
          username: user.username,
          value: user.profile.playtime,
          lastUpdated: new Date().toISOString()
        });
      }
    }
  });

  // Sort each leaderboard (descending) and keep top 10
  for (const type in leaderboard) {
    leaderboard[type].sort((a, b) => b.value - a.value);
    if (leaderboard[type].length > 10) {
      leaderboard[type] = leaderboard[type].slice(0, 10);
    }
  }

  writeLeaderboard(leaderboard);
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

  if (!users[index].profile.worlds) {
    users[index].profile.worlds = [];
  }

  const worldIndex = users[index].profile.worlds.findIndex(w => w.id === world.id);
  if (worldIndex >= 0) {
    users[index].profile.worlds[worldIndex] = world;
  } else {
    users[index].profile.worlds.push(world);
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

// ===== STATS/LEADERBOARD ROUTES =====
// POST /api/update-stats — Update user stats (blocksMined, playtime, zombiesKilled)
app.post('/api/update-stats', (req, res) => {
  const { userId, blocksMined, playtime, zombiesKilled } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, message: 'userId is required.' });
  }

  const users = readUsers();
  const index = users.findIndex(u => u.id === userId);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  if (!users[index].profile) users[index].profile = {};
  if (blocksMined !== undefined) users[index].profile.blocksMined = (users[index].profile.blocksMined || 0) + blocksMined;
  if (playtime !== undefined) users[index].profile.playtime = (users[index].profile.playtime || 0) + playtime;
  if (zombiesKilled !== undefined) users[index].profile.zombiesKilled = (users[index].profile.zombiesKilled || 0) + zombiesKilled;

  writeUsers(users);
  res.json({ success: true, profile: users[index].profile });
});

// GET /api/profile — Get a user's profile stats
app.get('/api/profile', (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ success: false, message: 'userId is required.' });
  }

  const users = readUsers();
  const user = users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  res.json({ success: true, profile: user.profile || {} });
});

// GET /api/leaderboard — Get global leaderboard for a stat
app.get('/api/leaderboard', (req, res) => {
  const { type } = req.query;
  if (!type || !['blocksMined', 'zombiesKilled', 'playtime'].includes(type)) {
    return res.status(400).json({ success: false, message: 'Invalid leaderboard type. Use: blocksMined, zombiesKilled, playtime' });
  }

  const leaderboard = readLeaderboard();
  res.json({ success: true, leaderboard: leaderboard[type] || [] });
});

// ===== ADMIN ROUTES =====
// GET /api/admin/users — Admin only, returns all users (no passwords)
app.get('/api/admin/users', (req, res) => {
  const users = readUsers();
  const safe = users.map(({ password, ...rest }) => rest);
  res.json({ success: true, users: safe });
});

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

// POST /api/admin/delete-user — Admin deletes a user (soft delete)
app.post('/api/admin/delete-user', (req, res) => {
  const { adminId, userId } = req.body;

  if (!adminId || !userId) {
    return res.status(400).json({ success: false, message: 'adminId and userId are required.' });
  }

  const users = readUsers();
  const admin = users.find(u => u.id === adminId);

  if (!admin || admin.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Unauthorized.' });
  }

  const index = users.findIndex(u => u.id === userId);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  // Soft delete: mark user as deleted
  users[index].deleted = true;
  users[index].deletedAt = new Date().toISOString();
  writeUsers(users);
  res.json({ success: true });
});

// ===== BACKWARD COMPATIBILITY: /game/* ROUTES =====
// Alias all /api/* routes to /game/* for backward compatibility with your existing frontend

// GET /game/users — Admin only, returns all users (no passwords)
app.get('/game/users', (req, res) => {
  const users = readUsers();
  const safe = users.map(({ password, ...rest }) => rest);
  res.json({ success: true, users: safe });
});

// GET /game/user — Fetch a single user's data (by userId)
app.get('/game/user', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ success: false, message: 'userId required.' });
  const users = readUsers();
  const user = users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  const { password: _pw, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
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

app.post('/game/update-stats', (req, res) => {
  const { userId, blocksMined, zombiesKilled, playtime } = req.body;
  if (!userId)
    return res.status(400).json({ success: false, message: 'userId required.' });

  const users = readUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index === -1)
    return res.status(404).json({ success: false, message: 'User not found.' });

  if (!users[index].profile) users[index].profile = {};
  if (blocksMined)   users[index].profile.blocksMined   = (users[index].profile.blocksMined   || 0) + blocksMined;
  if (zombiesKilled) users[index].profile.zombiesKilled = (users[index].profile.zombiesKilled || 0) + zombiesKilled;
  if (playtime)      users[index].profile.playtime      = (users[index].profile.playtime      || 0) + playtime;

  writeUsers(users);
  const { password: _pw, ...safeUser } = users[index];
  res.json({ success: true, user: safeUser });
});

app.get('/game/leaderboard', (req, res) => {
  try {
    const raw = fs.readFileSync(LEADERBOARD_FILE, 'utf8');
    res.json({ success: true, ...JSON.parse(raw) });
  } catch {
    const users = readUsers();
    rebuildLeaderboard(users);
    const raw = fs.readFileSync(LEADERBOARD_FILE, 'utf8');
    res.json({ success: true, ...JSON.parse(raw) });
  }
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

app.post('/game/admin/delete-user', (req, res) => {
  const { adminId, targetId } = req.body;
  const users = readUsers();
  const admin = users.find(u => u.id === adminId);
  if (!admin || admin.role !== 'admin')
    return res.status(403).json({ success: false, message: 'Unauthorized.' });
  if (adminId === targetId)
    return res.status(400).json({ success: false, message: 'Cannot delete your own account.' });
  const filtered = users.filter(u => u.id !== targetId);
  if (filtered.length === users.length)
    return res.status(404).json({ success: false, message: 'User not found.' });
  writeUsers(filtered);
  rebuildLeaderboard(filtered);
  res.json({ success: true });
});


// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`CraftWorld server running at http://localhost:${PORT}`);
});
