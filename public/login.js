// ─── API base ─────────────────────────────────────────────────────────────────
// Empty string => relative URLs => fetch hits whatever origin served this page.
// Locally that's http://localhost:3000; in production it's https://dresstheday.style.
const API_BASE = '';

// ─── Tab switching ────────────────────────────────────────────────────────────
const tabs   = document.querySelectorAll('.login-tab');
const panels = document.querySelectorAll('.login-panel');

function switchTab(targetId) {
  tabs.forEach(tab => {
    const isActive = tab.id === `tab-${targetId}`;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive);
  });
  panels.forEach(panel => {
    panel.classList.toggle('hidden', panel.id !== `panel-${targetId}`);
  });
}

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.id.replace('tab-', '');
    switchTab(target);
  });
});

document.querySelectorAll('.switch-tab-link').forEach(link => {
  link.addEventListener('click', () => switchTab(link.dataset.target));
});

// ─── Password show / hide ─────────────────────────────────────────────────────
document.querySelectorAll('.pw-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    btn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
  });
});

// ─── Shared: save user to localStorage after auth ─────────────────────────────
// localStorage is for display only (name in header, etc.)
// Real auth state lives in the backend session cookie.
function saveUserSession(user) {
  localStorage.setItem('dtd_user', JSON.stringify({
    firstName: user.firstName || '',
    lastName:  user.lastName  || '',
    email:     user.email     || '',
    userId:    user.userId    || '',
  }));
}

// ─── Shared: redirect after login ────────────────────────────────────────────
function redirectAfterLogin() {
  const returnTo = sessionStorage.getItem('dtd_login_return');
  sessionStorage.removeItem('dtd_login_return');
  window.location.href = returnTo || 'account-information.html';
}

// ─── On page load: if already logged in, skip login page ─────────────────────
// Checks the backend session so we don't show login to someone who's already in.
(async () => {
  try {
    const res = await fetch(`${API_BASE}/api/users/me`, {
      credentials: 'include',
    });
    if (res.ok) {
      // Already logged in — go straight to destination
      redirectAfterLogin();
    } else if (res.status === 401) {
      // Session expired — clear stale localStorage so avatar resets
      localStorage.removeItem('dtd_user');
    }
  } catch {
    // Server unreachable — stay on login page
  }
})();

// ─── Sign In form ─────────────────────────────────────────────────────────────
document.getElementById('signin-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('signin-error');
  errorEl.classList.add('hidden');
  errorEl.textContent = '';

  const email    = document.getElementById('signin-email').value.trim();
  const password = document.getElementById('signin-password').value;

  if (!email || !password) { showError(errorEl, 'Please fill in all fields.'); return; }
  if (!isValidEmail(email)) { showError(errorEl, 'Please enter a valid email address.'); return; }

  try {
    const res = await fetch(`${API_BASE}/api/users/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',   // ← sends/receives session cookie
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      const data = await res.json();
      // Backend returns: { message, userId, firstName, lastName? }
      saveUserSession({
        firstName: data.firstName || '',
        lastName:  data.lastName  || '',
        email,
        userId: data.userId || '',
      });
      redirectAfterLogin();
    } else {
      const data = await res.json().catch(() => ({}));
      showError(errorEl, data.message || 'Invalid email or password.');
    }
  } catch {
    showError(errorEl, 'Could not connect to server. Please try again.');
  }
});

// ─── Create Account form ──────────────────────────────────────────────────────
document.getElementById('signup-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('signup-error');
  errorEl.classList.add('hidden');
  errorEl.textContent = '';

  const firstName       = document.getElementById('signup-firstname').value.trim();
  const lastName        = document.getElementById('signup-lastname').value.trim();
  const email           = document.getElementById('signup-email').value.trim();
  const password        = document.getElementById('signup-password').value;
  const confirmPassword = document.getElementById('signup-confirm').value;

  if (!firstName || !lastName || !email || !password || !confirmPassword) {
    showError(errorEl, 'Please fill in all fields.'); return;
  }
  if (!isValidEmail(email)) { showError(errorEl, 'Please enter a valid email address.'); return; }
  if (password.length < 8)  { showError(errorEl, 'Password must be at least 8 characters.'); return; }
  if (password !== confirmPassword) { showError(errorEl, 'Passwords do not match.'); return; }

  try {
    const res = await fetch(`${API_BASE}/api/users/register`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',   // ← sends/receives session cookie
      body: JSON.stringify({ firstName, lastName, email, password }),
    });

    if (res.ok) {
      const data = await res.json();
      // ← FIX: include userId from backend response (was missing before)
      saveUserSession({
        firstName,
        lastName,
        email,
        userId: data.userId || '',
      });
      redirectAfterLogin();
    } else {
      const data = await res.json().catch(() => ({}));
      showError(errorEl, data.message || 'Could not create account. Please try again.');
    }
  } catch {
    showError(errorEl, 'Could not connect to server. Please try again.');
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
