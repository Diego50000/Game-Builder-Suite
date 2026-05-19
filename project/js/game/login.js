// login.js — login page logic

redirectIfLoggedIn('game.html');

// Background canvas block rain
const canvas = document.getElementById('bg-canvas');
if (canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  window.addEventListener('resize', () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; });
  const COLORS = ['#4a7c3f','#8B5E3C','#7a7a7a','#6B4423','#2D5A1B'];
  const blocks = Array.from({ length: 30 }, () => ({
    x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
    size: 16 + Math.random() * 16, speed: 0.3 + Math.random() * 0.6,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rotation: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.02,
  }));
  (function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    blocks.forEach(b => {
      b.y += b.speed; b.rotation += b.rotSpeed;
      if (b.y > canvas.height + 40) { b.y = -40; b.x = Math.random() * canvas.width; }
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rotation);
      ctx.fillStyle = b.color; ctx.fillRect(-b.size/2,-b.size/2,b.size,b.size);
      ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.lineWidth=1; ctx.strokeRect(-b.size/2,-b.size/2,b.size,b.size);
      ctx.restore();
    });
    requestAnimationFrame(animate);
  })();
}

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = '⚠ ' + msg;
  el.style.display = 'block';
  document.getElementById('success-msg').style.display = 'none';
}

function showSuccess(msg) {
  const el = document.getElementById('success-msg');
  el.textContent = '✔ ' + msg;
  el.style.display = 'block';
  document.getElementById('error-msg').style.display = 'none';
}

async function handleLogin() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const btn      = document.getElementById('login-btn');

  if (!username || !password) {
    showError('Please fill in all fields.');
    return;
  }

  btn.textContent = 'Signing in...';
  btn.disabled = true;

  const result = await loginUser(username, password);

  if (result.success) {
    showSuccess('Welcome back, ' + result.user.username + '! Loading your world...');
    setTimeout(() => { window.location.href = 'game.html'; }, 1000);
  } else {
    showError(result.message);
    btn.textContent = '▶ Sign In';
    btn.disabled = false;
  }
}

document.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });