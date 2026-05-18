// index.js — landing page background animation

const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

// Falling block particles
const BLOCK_SIZE = 20;
const COLORS = ['#4a7c3f', '#8B5E3C', '#7a7a7a', '#6B4423', '#2D5A1B', '#5a9e4f'];

const blocks = Array.from({ length: 40 }, () => ({
  x: Math.random() * window.innerWidth,
  y: Math.random() * window.innerHeight,
  size: BLOCK_SIZE + Math.random() * 20,
  speed: 0.3 + Math.random() * 0.8,
  color: COLORS[Math.floor(Math.random() * COLORS.length)],
  rotation: Math.random() * Math.PI * 2,
  rotSpeed: (Math.random() - 0.5) * 0.02,
}));

function drawBlock(x, y, size, color, rotation) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.fillStyle = color;
  ctx.fillRect(-size / 2, -size / 2, size, size);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(-size / 2, -size / 2, size, size);
  ctx.restore();
}

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  blocks.forEach(b => {
    b.y += b.speed;
    b.rotation += b.rotSpeed;
    if (b.y > canvas.height + 40) {
      b.y = -40;
      b.x = Math.random() * canvas.width;
    }
    drawBlock(b.x, b.y, b.size, b.color, b.rotation);
  });

  requestAnimationFrame(animate);
}

animate();