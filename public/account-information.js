const API_BASE = '';

// ─── Boot ──
document.addEventListener('DOMContentLoaded', async () => {
  updateAccountIconLink();

  // Immediately fill from localStorage to prevent flash of empty fields
  const localUser = getUser();
  if (localUser.firstName) {
    populateForm(localUser);
    populateSidebar(localUser);
  }

  // Then fetch from backend to get latest data
  await loadUserInfo();
  initEditButtons();
});

// ─── Auth helpers ───
function getUser() {
  try {
    return JSON.parse(localStorage.getItem('dtd_user') || '{}');
  } catch { return {}; }
}

function updateAccountIconLink() {
  const link = document.getElementById('account-icon-link');
  if (!link) return;
  const user = getUser();
  link.href = user.firstName ? 'account-information.html' : 'login.html';
}

// ─── 1. Load user info from backend ───
async function loadUserInfo() {
  try {
    const res = await fetch(`${API_BASE}/api/users/me`, {
      credentials: 'include',
    });

    if (res.status === 401) {
      // Not logged in → clear stale localStorage and redirect
      localStorage.removeItem('dtd_user');
      window.location.href = 'login.html';
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const user = await res.json();
    populateForm(user);
    populateSidebar(user);

  } catch (err) {
    console.error('Failed to load user info:', err);
    // Fallback: populate from localStorage if backend not ready
    const localUser = getUser();
    if (localUser.firstName) {
      populateForm(localUser);
      populateSidebar(localUser);
    }
  }
}

// ─── 2. Populate form fields ───
function populateForm(user) {
  setField('first-name',  user.firstName   || '');
  setField('last-name',   user.lastName    || '');
  setField('email',       user.email       || '');
  setField('phone',       user.phoneNumber || '');
  setField('dob',         user.dateOfBirth || '');
  setField('size',        user.defaultSize || '');

  // Address fields (stored in user.address object)
  const addr = user.address || {};
  setField('street', addr.street || '');
  setField('apt',    addr.apt    || '');
  setField('city',   addr.city   || '');
  setField('state',  addr.state  || '');
  setField('zip',    addr.zip    || '');
}

function setField(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

// ─── 3. Populate sidebar ───
function populateSidebar(user) {
  const nameEl = document.getElementById('sidebar-username');
  if (nameEl && user.firstName) {
    nameEl.textContent = user.firstName;
  }
  const memberEl = document.getElementById('sidebar-member');
  if (memberEl && user.memberSince) {
    memberEl.textContent = `Member Since ${user.memberSince}`;
  }
}

// ─── 4. Edit / Save buttons ───
function initEditButtons() {
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const section  = btn.closest('.info-section');
      const inputs   = section.querySelectorAll('.info-input');
      const actions  = section.querySelector('.info-form-actions');
      const isEditing = !inputs[0].readOnly;

      if (isEditing) {
        // Cancel — restore readonly
        inputs.forEach(i => i.setAttribute('readonly', true));
        actions.classList.add('hidden');
        btn.textContent = 'Edit';
        // Reload to reset any unsaved changes
        loadUserInfo();
      } else {
        // Enter edit mode
        inputs.forEach(i => i.removeAttribute('readonly'));
        actions.classList.remove('hidden');
        btn.textContent = 'Cancel';
        inputs[0].focus();
      }
    });
  });

  // Save buttons
  document.querySelectorAll('.save-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const section = btn.closest('.info-section');
      const sectionId = section.querySelector('h3')?.id;

      if (sectionId === 'password-heading') {
        await savePassword(section, btn);
      } else if (sectionId === 'address-heading') {
        await saveAddress(section, btn);
      } else {
        await savePersonalInfo(section, btn);
      }
    });
  });
}

// ─── 5. Save personal info ──
async function savePersonalInfo(section, btn) {
  const payload = {
    firstName:   document.getElementById('first-name')?.value.trim(),
    lastName:    document.getElementById('last-name')?.value.trim(),
    phoneNumber: document.getElementById('phone')?.value.trim(),
    dateOfBirth: document.getElementById('dob')?.value.trim(),
    defaultSize: document.getElementById('size')?.value.trim(),
  };

  await saveToBackend(payload, section, btn);

  // Update localStorage name
  const localUser = getUser();
  localUser.firstName = payload.firstName;
  localUser.lastName  = payload.lastName;
  localStorage.setItem('dtd_user', JSON.stringify(localUser));
  populateSidebar(payload);
}

// ─── 6. Save address ───
async function saveAddress(section, btn) {
  const payload = {
    address: {
      street: document.getElementById('street')?.value.trim(),
      apt:    document.getElementById('apt')?.value.trim(),
      city:   document.getElementById('city')?.value.trim(),
      state:  document.getElementById('state')?.value.trim(),
      zip:    document.getElementById('zip')?.value.trim(),
    }
  };

  await saveToBackend(payload, section, btn);
}

// ─── 7. Save password ───
async function savePassword(section, btn) {
  const newPw     = document.getElementById('new-pw')?.value;
  const confirmPw = document.getElementById('confirm-pw')?.value;

  if (!newPw || newPw.length < 8) {
    showSectionError(section, 'Password must be at least 8 characters.');
    return;
  }
  if (newPw !== confirmPw) {
    showSectionError(section, 'Passwords do not match.');
    return;
  }

  await saveToBackend({ password: newPw }, section, btn);
}

// ─── 8. Generic PATCH to /api/users/me ─────
async function saveToBackend(payload, section, btn) {
  const originalText = btn.textContent;
  btn.disabled    = true;
  btn.textContent = 'Saving…';

  try {
    const res = await fetch(`${API_BASE}/api/users/me`, {
      method:      'PATCH',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify(payload),
    });

    if (res.status === 401) {
      window.location.href = 'login.html';
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    // Success → go back to readonly
    const inputs = section.querySelectorAll('.info-input');
    inputs.forEach(i => i.setAttribute('readonly', true));
    section.querySelector('.info-form-actions')?.classList.add('hidden');
    section.querySelector('.edit-btn').textContent = 'Edit';
    showSectionSuccess(section);

  } catch (err) {
    console.error('Save failed:', err);
    showSectionError(section, 'Could not save. Please try again.');
  } finally {
    btn.disabled    = false;
    btn.textContent = originalText;
  }
}

// ─── Feedback helpers ────
function showSectionError(section, msg) {
  let el = section.querySelector('.section-feedback');
  if (!el) {
    el = document.createElement('p');
    el.className = 'section-feedback section-feedback--error';
    section.appendChild(el);
  }
  el.textContent = msg;
  el.style.color = '#c0392b';
  setTimeout(() => el.remove(), 4000);
}

function showSectionSuccess(section) {
  let el = section.querySelector('.section-feedback');
  if (!el) {
    el = document.createElement('p');
    el.className = 'section-feedback section-feedback--success';
    section.appendChild(el);
  }
  el.textContent = 'Saved successfully.';
  el.style.color = '#2e7d32';
  setTimeout(() => el.remove(), 3000);
}
