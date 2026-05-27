// profile.js — Fetches live data from the server on every load

document.addEventListener('DOMContentLoaded', async () => {
  const session = requireAuth();
  if (!session) return;

  // Show placeholder while loading
  document.getElementById('profile-username').textContent = session.username;

  try {
    // Fetch fresh user data + leaderboard in parallel
    const [userRes, lbRes] = await Promise.all([
      fetch(`/game/user?userId=${session.id}`),
      fetch('/game/leaderboard'),
    ]);
    const userResult = await userRes.json();
    const lbResult   = await lbRes.json();

    if (!userResult.success) {
      console.error('Could not load user:', userResult.message);
      renderProfile(session, lbResult.players || []);
      return;
    }

    // Update session so other pages stay fresh
    setCurrentUser(userResult.user);

    renderProfile(userResult.user, lbResult.players || []);
    setupBioEditor(userResult.user.id);

  } catch (err) {
    console.error('Network error:', err);
    // Fall back to session data so the page isn't blank
    renderProfile(session, []);
    setupBioEditor(session.id);
  }
});

// ── Render ────────────────────────────────────────────────────────────────────
function renderProfile(user, lbPlayers) {
  const p = user.profile || {};

  document.getElementById('profile-username').textContent = user.username;
  document.getElementById('profile-email').textContent    = user.email || '';
  document.getElementById('profile-avatar').textContent   = p.avatar || '🧑';
  document.getElementById('profile-bio').textContent      = p.bio || "This user hasn't written a bio yet.";

  // ── Stats ──
  document.getElementById('stat-playtime').textContent      = formatPlaytime(p.playtime || 0);
  document.getElementById('stat-blocks-mined').textContent  = (p.blocksMined   || 0).toLocaleString();
  document.getElementById('stat-zombies-killed').textContent = (p.zombiesKilled || 0).toLocaleString();
  document.getElementById('stat-worlds').textContent        = (p.worlds?.length || 0);

  // ── Worlds ──
  const worldsEl = document.getElementById('worlds-container');
  if (p.worlds && p.worlds.length > 0) {
    worldsEl.innerHTML = '';
    p.worlds.forEach(w => {
      const div = document.createElement('div');
      div.className = 'world-item';
      div.innerHTML = `<span>${w.name || 'Unnamed World'}</span><a href="game.html?worldId=${w.id}">Play</a>`;
      worldsEl.appendChild(div);
    });
  } else {
    worldsEl.innerHTML = '<p>No worlds yet. <a href="game.html">Create one!</a></p>';
  }

  // ── Custom mobs ──
  const mobsEl = document.getElementById('mobs-container');
  if (p.customMobs && p.customMobs.length > 0) {
    mobsEl.innerHTML = '';
    p.customMobs.forEach(mob => {
      const div = document.createElement('div');
      div.className = 'mob-item';
      div.innerHTML = `<span>${mob.name || 'Unnamed Mob'}</span><span>${mob.health || 'N/A'} HP</span>`;
      mobsEl.appendChild(div);
    });
  } else {
    mobsEl.innerHTML = '<p>No custom mobs yet.</p>';
  }

  // ── Leaderboard ──
  renderLeaderboard(lbPlayers, user.username);
}

function renderLeaderboard(players, currentUsername) {
  // Remove old leaderboard if re-rendering
  const old = document.getElementById('leaderboard-section');
  if (old) old.remove();

  if (!players || players.length === 0) return;

  const container = document.querySelector('.profile-container');
  const section   = document.createElement('div');
  section.id        = 'leaderboard-section';
  section.className = 'worlds-list';
  section.style.marginTop = '20px';

  section.innerHTML = `
    <h3>🏆 Leaderboard</h3>
    <table style="width:100%;border-collapse:collapse;font-family:'VT323',monospace;font-size:1.1rem;">
      <thead>
        <tr style="color:#4ade80;text-align:left;border-bottom:1px solid rgba(255,255,255,0.15);">
          <th style="padding:6px 8px;">#</th>
          <th style="padding:6px 8px;">Player</th>
          <th style="padding:6px 8px;">⛏ Blocks</th>
          <th style="padding:6px 8px;">🧟 Kills</th>
          <th style="padding:6px 8px;">⏱ Playtime</th>
        </tr>
      </thead>
      <tbody id="lb-body"></tbody>
    </table>`;

  container.appendChild(section);

  const tbody = document.getElementById('lb-body');
  const medals = ['🥇','🥈','🥉'];

  players.forEach((p, i) => {
    const isMe = p.username === currentUsername;
    const tr   = document.createElement('tr');
    tr.style.cssText = `background:${isMe ? 'rgba(74,222,128,0.1)' : 'transparent'};
      border-bottom:1px solid rgba(255,255,255,0.06);`;
    tr.innerHTML = `
      <td style="padding:5px 8px;">${medals[i] || i+1}</td>
      <td style="padding:5px 8px;${isMe ? 'color:#4ade80;font-weight:bold;' : ''}">${p.username}</td>
      <td style="padding:5px 8px;">${(p.blocksMined || 0).toLocaleString()}</td>
      <td style="padding:5px 8px;">${(p.zombiesKilled || 0).toLocaleString()}</td>
      <td style="padding:5px 8px;">${formatPlaytime(p.playtime || 0)}</td>`;
    tbody.appendChild(tr);
  });
}

// ── Bio editor ────────────────────────────────────────────────────────────────
function setupBioEditor(userId) {
  const editBtn   = document.getElementById('edit-bio-btn');
  const saveBtn   = document.getElementById('save-bio-btn');
  const textarea  = document.getElementById('bio-textarea');
  const bioText   = document.getElementById('profile-bio');

  editBtn.addEventListener('click', () => {
    textarea.value        = bioText.textContent;
    textarea.style.display = 'block';
    saveBtn.style.display  = 'block';
    editBtn.style.display  = 'none';
  });

  saveBtn.addEventListener('click', async () => {
    saveBtn.textContent = 'Saving…';
    saveBtn.disabled    = true;
    const result = await updateProfile(userId, { bio: textarea.value });
    if (result.success) {
      bioText.textContent    = textarea.value;
      textarea.style.display = 'none';
      saveBtn.style.display  = 'none';
      editBtn.style.display  = 'block';
    } else {
      alert('Failed to save bio: ' + (result.message || 'Unknown error'));
    }
    saveBtn.textContent = 'Save Bio';
    saveBtn.disabled    = false;
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatPlaytime(seconds) {
  if (!seconds || seconds < 60) return `${Math.floor(seconds || 0)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
