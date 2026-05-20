// game/main.js — entry point for the game canvas
// This file is intentionally minimal until the game is built out.

const canvas = document.getElementById('game-canvas');
if (canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#4ade80';
    ctx.font = '20px VT323, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Game coming soon...', canvas.width / 2, canvas.height / 2);
    requestAnimationFrame(draw);
  }
  draw();
}
