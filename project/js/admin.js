// admin.js — Admin dashboard

document.addEventListener('DOMContentLoaded', async () => {
  const admin = requireAdmin();
  if (!admin) return;

  try {
    const res    = await fetch('/game/users');
    const result = await res.json();
    if (!result.success) throw new Error(result.message);
    renderDashboard(result.users);
  } catch (err) {
    console.error('Network error:', err);
    document.getElementById('users-table-body').innerHTML =
      '<tr><td colspan="12" style="text-align:center;color:#ef4444;">Failed to load data. Please refresh.</td></tr>';
  }
});

function renderDashboard(users) {
  // ── Totals ──
  let totalBlocks = 0, totalPlaytime = 0, totalZombies = 0, totalWorlds = 0, totalMobs = 0;
  users.forEach(u => {
    const p = u.profile || {};
    totalBlocks   += p.blocksMined   || 0;
    totalPlaytime += p.playtime      || 0;
    totalZombies  += p.zombiesKilled || 0;
    totalWorlds   += p.worlds?.length        || 0;
    totalMobs     += p.customMobs?.length    || 0;
  });

  document.getElementById('total-users').textContent    = users.length;
  document.getElementById('total-worlds').textContent   = totalWorlds;
  document.getElementById('total-mobs').textContent     = totalMobs;
  document.getElementById('total-blocks').textContent   = totalBlocks.toLocaleString();
  document.getElementById('total-playtime').textContent = formatPlaytime(totalPlaytime);
  document.getElementById('total-zombies').textContent  = totalZombies.toLocaleString();

  // ── Users table ──
  const tbody = document.getElementById('users-table-body');
  tbody.innerHTML = '';

  users.forEach(user => {
    const p   = user.profile || {};
    const row = document.createElement('tr');
    row.innerHTML = `
      <td title="${user.id}">${user.id.substring(0,8)}…</td>
      <td>${esc(user.username)}</td>
      <td>${esc(user.email)}</td>
      <td>${user.role}</td>
      <td>${user.createdAt || '—'}</td>
      <td>—</td>
      <td>${formatPlaytime(p.playtime || 0)}</td>
      <td>${(p.blocksMined   || 0).toLocaleString()}</td>
      <td>${(p.zombiesKilled || 0).toLocaleString()}</td>
      <td>${p.worlds?.length     || 0}</td>
      <td>${p.customMobs?.length || 0}</td>
      <td>
        <button class="action-btn view"   onclick="viewUserDetails('${user.id}')">View</button>
        <button class="action-btn delete" onclick="deleteUser('${user.id}')">Delete</button>
      </td>`;
    tbody.appendChild(row);
  });
}

// ── View details ──────────────────────────────────────────────────────────────
async function viewUserDetails(userId) {
  try {
    const res    = await fetch(`/game/user?userId=${userId}`);
    const result = await res.json();
    if (!result.success) { alert('Could not load user: ' + result.message); return; }

    const user = result.user;
    const p    = user.profile || {};
    const container = document.getElementById('user-details-container');

    container.innerHTML = `
      <div class="user-details show" style="margin-top:16px;padding:16px;
        background:rgba(255,255,255,.05);border:1px solid #333;border-radius:6px;">
        <h3 style="margin-bottom:10px;">👤 ${esc(user.username)}</h3>
        <p><strong>Email:</strong> ${esc(user.email)}</p>
        <p><strong>Role:</strong> ${user.role}</p>
        <p><strong>Created:</strong> ${user.createdAt || '—'}</p>
        <p><strong>Bio:</strong> ${esc(p.bio || '—')}</p>
        <hr style="margin:10px 0;border-color:#333;"/>
        <p><strong>Playtime:</strong> ${formatPlaytime(p.playtime || 0)}</p>
        <p><strong>Blocks Mined:</strong> ${(p.blocksMined   || 0).toLocaleString()}</p>
        <p><strong>Zombies Killed:</strong> ${(p.zombiesKilled || 0).toLocaleString()}</p>
        <hr style="margin:10px 0;border-color:#333;"/>
        <p><strong>Worlds (${p.worlds?.length || 0}):</strong></p>
        ${p.worlds?.length
          ? p.worlds.map(w => `<div style="margin-left:16px;padding:3px 0;">🌍 ${esc(w.name||'Unnamed')} (${w.id})</div>`).join('')
          : '<p style="margin-left:16px;opacity:.6;">None</p>'}
        <p style="margin-top:8px;"><strong>Custom Mobs (${p.customMobs?.length || 0}):</strong></p>
        ${p.customMobs?.length
          ? p.customMobs.map(m => `<div style="margin-left:16px;padding:3px 0;">🧟 ${esc(m.name||'Unnamed')} — ${m.health||'?'} HP</div>`).join('')
          : '<p style="margin-left:16px;opacity:.6;">None</p>'}
        <button class="action-btn" style="margin-top:12px;"
          onclick="document.getElementById('user-details-container').innerHTML=''">✕ Close</button>
      </div>`;
  } catch (err) {
    console.error(err);
    alert('Network error loading user details.');
  }
}

// ── Delete user ───────────────────────────────────────────────────────────────
async function deleteUser(userId) {
  if (!confirm('Delete this user? This cannot be undone.')) return;
  try {
    const admin = getCurrentUser();
    const res   = await fetch('/game/admin/delete-user', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ adminId: admin.id, targetId: userId }),
    });
    const result = await res.json();
    if (result.success) { alert('User deleted.'); window.location.reload(); }
    else alert('Failed: ' + result.message);
  } catch (err) {
    alert('Network error.');
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatPlaytime(s) {
  if (!s || s < 60)   return `${Math.floor(s||0)}s`;
  if (s < 3600)       return `${Math.floor(s/60)}m`;
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

function esc(str) {
  return String(str||'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
