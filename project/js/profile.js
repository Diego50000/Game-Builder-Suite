// profile.js — Load and manage user profile data
let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
  // Use the shared auth system (sessionStorage via auth.js)
  currentUser = requireAuth(); // redirects to login.html if not logged in
  if (!currentUser) return;

  renderProfile(currentUser);

  document.getElementById('edit-bio-btn').addEventListener('click', () => {
    document.getElementById('bio-textarea').style.display = 'block';
    document.getElementById('save-bio-btn').style.display = 'block';
    document.getElementById('edit-bio-btn').style.display = 'none';
    document.getElementById('bio-textarea').value =
      document.getElementById('profile-bio').textContent;
  });

  document.getElementById('save-bio-btn').addEventListener('click', async () => {
    const newBio = document.getElementById('bio-textarea').value;
    const result = await updateProfile(currentUser.id, { bio: newBio });
    if (result.success) {
      currentUser = result.user || currentUser;
      renderProfile(currentUser);
      document.getElementById('bio-textarea').style.display = 'none';
      document.getElementById('save-bio-btn').style.display = 'none';
      document.getElementById('edit-bio-btn').style.display = 'block';
    } else {
      alert('Failed to save bio: ' + result.message);
    }
  });
});

function renderProfile(user) {
  document.getElementById('profile-username').textContent = user.username;
  document.getElementById('profile-email').textContent = user.email || '';
  document.getElementById('profile-avatar').textContent =
    (user.profile && user.profile.avatar) ? user.profile.avatar : '🧑';
  document.getElementById('profile-bio').textContent =
    (user.profile && user.profile.bio) ? user.profile.bio : "This user hasn't written a bio yet.";

  document.getElementById('stat-playtime').textContent =
    (user.profile && user.profile.playtime) ? user.profile.playtime : 0;
  document.getElementById('stat-blocks-mined').textContent =
    (user.profile && user.profile.blocksMined) ? user.profile.blocksMined : 0;
  document.getElementById('stat-zombies-killed').textContent =
    (user.profile && user.profile.zombiesKilled) ? user.profile.zombiesKilled : 0;
  document.getElementById('stat-worlds').textContent =
    (user.profile && user.profile.worlds) ? user.profile.worlds.length : 0;

  const worldsContainer = document.getElementById('worlds-container');
  if (user.profile && user.profile.worlds && user.profile.worlds.length > 0) {
    worldsContainer.innerHTML = '';
    user.profile.worlds.forEach(world => {
      const item = document.createElement('div');
      item.className = 'world-item';
      item.innerHTML = `<span>${world.name || 'Unnamed World'}</span>
        <a href="game.html?worldId=${world.id}">Play</a>`;
      worldsContainer.appendChild(item);
    });
  } else {
    worldsContainer.innerHTML = '<p>No worlds yet. <a href="game.html">Create one!</a></p>';
  }

  const mobsContainer = document.getElementById('mobs-container');
  if (user.profile && user.profile.customMobs && user.profile.customMobs.length > 0) {
    mobsContainer.innerHTML = '';
    user.profile.customMobs.forEach(mob => {
      const item = document.createElement('div');
      item.className = 'mob-item';
      item.innerHTML = `<span>${mob.name || 'Unnamed Mob'}</span>
        <span>${mob.health || 'N/A'} HP</span>`;
      mobsContainer.appendChild(item);
    });
  } else {
    mobsContainer.innerHTML = '<p>No custom mobs yet.</p>';
  }
}
