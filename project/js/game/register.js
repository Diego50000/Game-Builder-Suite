// register.js
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('register-form');
  const usernameInput = document.getElementById('username');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const confirmInput = document.getElementById('confirm-password');
  const registerBtn = document.getElementById('register-btn');
  const errorMsg = document.getElementById('error-msg');
  const successMsg = document.getElementById('success-msg');

  function showError(msg) {
    errorMsg.textContent = '⚠ ' + msg;
    errorMsg.style.display = 'block';
    successMsg.style.display = 'none';
    registerBtn.textContent = '⛏ Create Account';
    registerBtn.disabled = false;
  }

  function showSuccess(msg) {
    successMsg.textContent = '✔ ' + msg;
    successMsg.style.display = 'block';
    errorMsg.style.display = 'none';
  }

  async function handleRegister(e) {
    e.preventDefault();
    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirm = confirmInput.value;

    // Validate inputs
    if (!username || !email || !password || !confirm) {
      showError('All fields are required.');
      return;
    }
    if (password !== confirm) {
      showError('Passwords do not match.');
      return;
    }

    registerBtn.textContent = 'Creating Account...';
    registerBtn.disabled = true;

    try {
      const response = await fetch('https://your-repl-name.username.repl.co/api/register',{
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });

      const result = await response.json();
      if (result.success) {
        showSuccess('Account created! Redirecting to login...');
        setTimeout(() => {
          window.location.href = 'login.html';
        }, 1500);
      } else {
        showError(result.message || 'Registration failed.');
      }
    } catch (err) {
      showError('Network error. Please try again.');
    }
  }

  form.addEventListener('submit', handleRegister);
});