// profile.js — Load and display user profile, stats, and leaderboards
// Uses auth.js for session management

document.addEventListener('DOMContentLoaded', async () => {
  const user = requireAuth();
  if (!user) return;

  try {
    // Fetch profile stats and leaderboards in parallel
    const [profileResponse, blocksMinedLb, zombiesKilledLb, playtimeLb] = await Promise.all([
      fetch(`/game/profile?userId=${user.id}`),
      fetch('/game/leaderboard?type=blocksMined'),
      fetch('/game/leaderboard?type=zombiesKilled'),
      fetch('/game/leaderboard?type=playtime')
    ]);

    const profileResult = await profileResponse.json();
    const blocksMinedLbData = await blocksMinedLb.json();
    const zombiesKilledLbData = await zombiesKilledLb.json();
    const playtimeLbData = await playtimeLb.json();

    if (!profileResult.success) {
      console.error('Failed to load profile:', profileResult.message);
      return;
    }

    const profile = profileResult.profile || {
      playtime: 0,
      blocksMined: 0,
      zombiesKilled: 0,
      lastActive: 'Never'
    };

    renderProfile(user, profile, {
      blocksMined: blocksMinedLbData.leaderboard || [],
      zombiesKilled: zombiesKilledLbData.leaderboard || [],
      playtime: playtimeLbData.leaderboard || []
    });

    setupEventListeners(user.id, profile);
  } catch (err) {
    console.error('Network error:', err);
    alert('Failed to load profile. Please try again.');
  }
});

function renderProfile(user, profile, leaderboards) {
  // Basic info
  document.getElementById('profile-username').textContent = user.username;
  document.getElementById('profile-email').textContent = user.email;
  document.getElementById('profile-avatar').textContent = user.profile?.avatar || '🧑';

  // Bio
  const bio = user.profile?.bio || 'This user hasn\'t written a bio yet.';
  document.getElementById('profile-bio').textContent = bio;

  // Stats
  document.getElementById('stat-playtime').textContent = formatPlaytime(profile.playtime || 0);
  document.getElementById('stat-blocks-mined').textContent = profile.blocksMined || 0;
  document.getElementById('stat-zombies-killed').textContent = profile.zombiesKilled || 0;
  document.getElementById('stat-worlds').textContent = user.profile?.worlds?.length || 0;

  // Worlds list
  const worldsContainer = document.getElementById('worlds-container');
  if (user.profile?.worlds && user.profile.worlds.length > 0) {
    worldsContainer.innerHTML = '';
    user.profile.worlds.forEach(world => {
      const worldItem = document.createElement('div');
      worldItem.className = 'world-item';
      worldItem.innerHTML = `
        <span>${world.name || 'Unnamed World'}</span>
        <a href="game.html?worldId=${world.id}">Play</a>
      `;
      worldsContainer.appendChild(worldItem);
    });
  }

  // Mobs list
  const mobsContainer = document.getElementById('mobs-container');
  if (user.profile?.customMobs && user.profile.customMobs.length > 0) {
    mobsContainer.innerHTML = '';
    user.profile.customMobs.forEach(mob => {
      const mobItem = document.createElement('div');
      mobItem.className = 'mob-item';
      mobItem.innerHTML = `
        <span>${mob.name || 'Unnamed Mob'}</span>
        <span>${mob.health || 'N/A'} HP</span>
      `;
      mobsContainer.appendChild(mobItem);
    });
  }

  // Leaderboards
  const lbContainer = document.createElement('div');
  lbContainer.className = 'leaderboard-container';
  lbContainer.innerHTML = '<h3>🏆 Global Leaderboards</h3>';

  for (const [type, lb] of Object.entries(leaderboards)) {
    if (lb.length > 0) {
      const lbSection = document.createElement('div');
      lbSection.className = 'leaderboard-section';
      lbSection.innerHTML = `<h4>${type.replace(/([A-Z])/g, ' $1')}</h4>`;
      const lbList = document.createElement('ol');
      lb.forEach((entry, index) => {
        const li = document.createElement('li');
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
        li.innerHTML = `${medal} <strong>${entry.username}</strong>: ${entry.value}`;
        lbList.appendChild(li);
      });
      lbSection.appendChild(lbList);
      lbContainer.appendChild(lbSection);
    }
  }

  document.querySelector('.profile-container').appendChild(lbContainer);
}

// Helper: Format playtime in seconds to a readable string
function formatPlaytime(seconds) {
  if (seconds < 60) return `${seconds} sec`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  return `${Math.floor(seconds / 3600)} hours`;
}

function setupEventListeners(userId, profile) {
  const editBioBtn = document.getElementById('edit-bio-btn');
  const saveBioBtn = document.getElementById('save-bio-btn');
  const bioTextarea = document.getElementById('bio-textarea');
  const profileBio = document.getElementById('profile-bio');

  editBioBtn.addEventListener('click', () => {
    bioTextarea.style.display = 'block';
    saveBioBtn.style.display = 'block';
    editBioBtn.style.display = 'none';
    bioTextarea.value = profileBio.textContent;
  });

  saveBioBtn.addEventListener('click', async () => {
    const newBio = bioTextarea.value;
    const result = await updateProfile(userId, { bio: newBio });
    if (result.success) {
      profileBio.textContent = newBio;
      bioTextarea.style.display = 'none';
      saveBioBtn.style.display = 'none';
      editBioBtn.style.display = 'block';
    } else {
      alert('Failed to update bio: ' + result.message);
    }
  });
}