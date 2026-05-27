// leaderboard.js — Fetches and renders the global leaderboard

let allPlayers  = [];
let currentSort = 'score';
const currentUser = getCurrentUser();

const medals = ['🥇', '🥈', '🥉'];

document.addEventListener('DOMContentLoaded', async () => {
  // Tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSort = btn.dataset.sort;
      renderTable();
    });
  });

  await loadLeaderboard();
});

async function loadLeaderboard() {
  try {
    const res  = await fetch('/game/leaderboard');
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    allPlayers = data.players || [];

    // Update footer
    if (data.lastUpdated) {
      const d = new Date(data.lastUpdated);
      document.getElementById('lb-footer').textContent =
        'Last updated: ' + d.toLocaleString();
    }

    renderTable();
  } catch (err) {
    document.getElementById('lb-status').innerHTML =
      '<p>⚠️ Could not load leaderboard. Please try again.</p>';
    console.error(err);
  }
}

function renderTable() {
  const status = document.getElementById('lb-status');
  const table  = document.getElementById('lb-table');
  const tbody  = document.getElementById('lb-body');

  if (allPlayers.length === 0) {
    status.innerHTML = '<p>No players yet — be the first to play!</p>';
    table.style.display = 'none';
    return;
  }

  // Sort
  const sorted = [...allPlayers].sort((a, b) => {
    if (currentSort === 'playtime') return (b.playtime || 0) - (a.playtime || 0);
    return (b[currentSort] || 0) - (a[currentSort] || 0);
  });

  // Highlight active sort column header
  document.getElementById('col-score').style.color    = currentSort === 'score'        ? 'var(--accent2)' : '';
  document.getElementById('col-blocks').style.color   = currentSort === 'blocksMined'  ? 'var(--accent2)' : '';
  document.getElementById('col-kills').style.color    = currentSort === 'zombiesKilled'? 'var(--accent2)' : '';
  document.getElementById('col-playtime').style.color = currentSort === 'playtime'     ? 'var(--accent2)' : '';

  tbody.innerHTML = '';
  sorted.forEach((p, i) => {
    const isMe = currentUser && p.username === currentUser.username;
    const tr   = document.createElement('tr');
    if (isMe) tr.classList.add('is-me');

    const rank = medals[i] || `#${i + 1}`;

    tr.innerHTML = `
      <td class="rank-cell">${rank}</td>
      <td class="player-name">${escHtml(p.username)}${isMe ? ' <span style="color:var(--accent2);font-size:.9rem;">(you)</span>' : ''}</td>
      <td class="stat-cell${currentSort === 'score'         ? ' highlight' : ''}">${(p.score         || 0).toLocaleString()}</td>
      <td class="stat-cell${currentSort === 'blocksMined'   ? ' highlight' : ''}">${(p.blocksMined   || 0).toLocaleString()}</td>
      <td class="stat-cell${currentSort === 'zombiesKilled' ? ' highlight' : ''}">${(p.zombiesKilled || 0).toLocaleString()}</td>
      <td class="stat-cell${currentSort === 'playtime'      ? ' highlight' : ''}">${formatPlaytime(p.playtime || 0)}</td>`;
    tbody.appendChild(tr);
  });

  status.style.display  = 'none';
  table.style.display   = 'table';
}

function formatPlaytime(seconds) {
  if (!seconds || seconds < 60) return `${Math.floor(seconds || 0)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
