document.addEventListener('DOMContentLoaded', () => {
  const errorMsg   = document.getElementById('error-msg');
  const successMsg = document.getElementById('success-msg');
  const btn        = document.getElementById('login-btn');

  function showError(msg) {
    errorMsg.textContent     = msg;
    errorMsg.style.display   = 'block';
    successMsg.style.display = 'none';
  }

  function showSuccess(msg) {
    successMsg.textContent   = msg;
    successMsg.style.display = 'block';
    errorMsg.style.display   = 'none';
  }

  async function handleLogin() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
      return showError('Please enter your username and password.');
    }

    btn.disabled    = true;
    btn.textContent = 'Signing in…';

    const result = await loginUser(username, password);

    if (result.success) {
      showSuccess('Welcome back! Redirecting…');
      setTimeout(() => { window.location.href = 'game.html'; }, 1000);
    } else {
      showError(result.message || 'Login failed.');
      btn.disabled    = false;
      btn.textContent = '▶ Sign In';
    }
  }

  // Support both button click and Enter key
  btn.addEventListener('click', handleLogin);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });

  // Make available for the inline onclick in HTML too
  window.handleLogin = handleLogin;
});
