document.addEventListener('DOMContentLoaded', () => {
  redirectIfLoggedIn('game.html');

  const form        = document.getElementById('register-form');
  const errorMsg    = document.getElementById('error-msg');
  const successMsg  = document.getElementById('success-msg');
  const btn         = document.getElementById('register-btn');

  function showError(msg) {
    errorMsg.textContent  = msg;
    errorMsg.style.display = 'block';
    successMsg.style.display = 'none';
  }

  function showSuccess(msg) {
    successMsg.textContent  = msg;
    successMsg.style.display = 'block';
    errorMsg.style.display  = 'none';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirm  = document.getElementById('confirm-password').value;

    if (!username || !email || !password || !confirm) {
      return showError('All fields are required.');
    }

    if (password !== confirm) {
      return showError('Passwords do not match.');
    }

    btn.disabled    = true;
    btn.textContent = 'Creating account…';

    const result = await registerUser(username, email, password);

    if (result.success) {
      showSuccess('Account created! Redirecting…');
      setTimeout(() => { window.location.href = 'game.html'; }, 1200);
    } else {
      showError(result.message || 'Registration failed.');
      btn.disabled    = false;
      btn.textContent = '⛏ Create Account';
    }
  });
});
