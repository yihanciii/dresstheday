const TAX_RATE = 0.08875;
const API_BASE = 'http://localhost:3000';

// ─── Auth helpers ─────────────────────────────────────────────────────────────
function getUser() {
  try {
    const raw = localStorage.getItem('dtd_user');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveUserSession(user) {
  localStorage.setItem('dtd_user', JSON.stringify({
    firstName: user.firstName || '',
    lastName:  user.lastName  || '',
    email:     user.email     || '',
    userId:    user.userId    || '',
  }));
}

async function isLoggedIn() {
  try {
    const res = await fetch(`${API_BASE}/api/users/me`, { credentials: 'include' });
    if (res.ok) {
      // Keep localStorage display info in sync with the real session
      const user = await res.json();
      saveUserSession(user);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ─── Rental price formula ─────────────────────────────────────────────────────
function calcRentalPrice(retailPrice, days) {
  const d = Math.min(Math.max(days, 3), 30);
  return parseFloat((0.75 * retailPrice * (1 - Math.exp(-0.12 * d))).toFixed(2));
}

// ─── Read cart (array) ────────────────────────────────────────────────────────
function getCartItems() {
  try {
    // Try plural array first
    const rawArray = localStorage.getItem('dtd_cart_items');
    if (rawArray) return JSON.parse(rawArray);
    // Fall back to singular item from item-detail.js
    const rawSingle = localStorage.getItem('dtd_cart_item');
    if (rawSingle) return [JSON.parse(rawSingle)];
    return [];
  } catch { return []; }
}

function saveCartItems(items) {
  localStorage.setItem('dtd_cart_items', JSON.stringify(items));
  // Keep singular key in sync for checkout.js compatibility
  if (items.length > 0) {
    localStorage.setItem('dtd_cart_item', JSON.stringify(items[0]));
  } else {
    localStorage.removeItem('dtd_cart_item');
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateAccountIconLink();

  const cartItems = getCartItems();
  if (!cartItems.length) {
    showEmptyCart();
    return;
  }

  renderCartItems(cartItems);
  renderOrderSummary(cartItems);
  initRemoveButtons();
  initPromoCode();
  initProceedToCheckout();
  initAuthModal();
});

// ─── Update account icon ──────────────────────────────────────────────────────
function updateAccountIconLink() {
  const link = document.getElementById('account-icon-link');
  if (!link) return;
  const user = getUser();
  link.href = user ? 'account-information.html' : 'login.html';
}

// ─── 1. Render all cart items ─────────────────────────────────────────────────
function renderCartItems(cartItems) {
  const cartLeft = document.querySelector('.cart-left');
  if (!cartLeft) return;

  const itemsHTML = cartItems.map((cart, index) => {
    const rentalPrice = calcRentalPrice(cart.retailPrice, cart.days);
    return `
      <div class="cart-item" data-index="${index}">
        <div class="cart-item-img">
          <img src="${cart.imageUrl || `${API_BASE}/images/${escapeHTML(cart.imageFilename)}`}"
               alt="${escapeHTML(cart.name)}" loading="lazy"
               onerror="this.style.display='none'" />
        </div>
        <div class="cart-item-details">
          <p class="cart-item-brand">${escapeHTML(cart.clothingType || '')}</p>
          <p class="cart-item-scenario">${escapeHTML(cart.name)}</p>
          <div class="cart-meta-rows">
            <p>Size: ${escapeHTML(String(cart.selectedSize))}</p>
            <p>Free Back Up Size: ${cart.backupSize ? escapeHTML(String(cart.backupSize)) : '—'}</p>
            <p>Arrival Date: ${formatDate(new Date(cart.arrivalDate))}</p>
            <p>Return Date: ${formatDate(new Date(cart.returnDate))}</p>
            <p>Rental Period: ${cart.days} days</p>
            <p class="cart-item-retail">Retail $${cart.retailPrice}</p>
            <p class="cart-item-rental-price">$${rentalPrice.toFixed(2)}</p>
            <button class="cart-remove-btn" data-index="${index}">Remove</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Keep the title, replace everything else
  const title = cartLeft.querySelector('.cart-title');
  if (title) {
    title.insertAdjacentHTML('afterend', itemsHTML);
    // Remove any old single-item markup that was already there
    cartLeft.querySelectorAll('.cart-item:not([data-index])').forEach(el => el.remove());
  } else {
    cartLeft.innerHTML = `<h2 class="cart-title">My Cart</h2>` + itemsHTML;
  }
}

// ─── 2. Render order summary (sum of all items) ───────────────────────────────
function renderOrderSummary(cartItems) {
  const subtotal = cartItems.reduce((sum, cart) =>
    sum + calcRentalPrice(cart.retailPrice, cart.days), 0);
  const tax   = parseFloat((subtotal * TAX_RATE).toFixed(2));
  const total = parseFloat((subtotal + tax).toFixed(2));

  const totalRows = document.querySelectorAll('.order-total-row');
  if (totalRows[0]) totalRows[0].querySelector('span:last-child').textContent = `$${subtotal.toFixed(2)}`;
  if (totalRows[1]) totalRows[1].querySelector('span:last-child').textContent = 'Free';
  if (totalRows[2]) totalRows[2].querySelector('span:last-child').textContent = `$${tax.toFixed(2)}`;

  setText('.order-total-amount', `$${total.toFixed(2)}`);
}

// ─── 3. Remove buttons ────────────────────────────────────────────────────────
function initRemoveButtons() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.cart-remove-btn');
    if (!btn) return;

    const index = parseInt(btn.dataset.index);
    const items = getCartItems();
    items.splice(index, 1);

    if (items.length === 0) {
      localStorage.removeItem('dtd_cart_items');
      localStorage.removeItem('dtd_cart_item');
      showEmptyCart();
    } else {
      saveCartItems(items);
      location.reload();
    }
  });
}

// ─── 4. Promo code ────────────────────────────────────────────────────────────
function initPromoCode() {
  const promoBtn   = document.querySelector('.promo-btn');
  const promoInput = document.querySelector('.promo-input');
  if (!promoBtn || !promoInput) return;
  promoBtn.addEventListener('click', () => {
    const code = promoInput.value.trim();
    if (!code) return;
    promoInput.value       = '';
    promoInput.placeholder = 'Promo codes coming soon';
    promoBtn.disabled      = true;
  });
}

// ─── 5. Proceed to Checkout ───────────────────────────────────────────────────
// [FIX 1] Now asks backend for session truth instead of reading localStorage.
// This matches checkout.js's requireAuth() so both pages agree on login state.
function initProceedToCheckout() {
  const checkoutBtn = document.getElementById('checkout-cta-btn');
  if (!checkoutBtn) return;

  checkoutBtn.addEventListener('click', async () => {
    const cartItems = getCartItems();
    if (!cartItems.length) { showEmptyCart(); return; }

    checkoutBtn.disabled = true;
    checkoutBtn.textContent = 'Checking…';

    const loggedIn = await isLoggedIn();

    checkoutBtn.disabled = false;
    checkoutBtn.textContent = 'Proceed to Checkout';

    if (loggedIn) {
      window.location.href = 'checkout.html';
    } else {
      // Clear stale localStorage so it doesn't mislead other pages
      localStorage.removeItem('dtd_user');
      openAuthModal();
    }
  });
}

// ─── 6. Auth Modal ────────────────────────────────────────────────────────────
function initAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;

  modal.addEventListener('click', (e) => { if (e.target === modal) closeAuthModal(); });
  document.getElementById('auth-modal-close')?.addEventListener('click', closeAuthModal);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAuthModal(); });

  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => switchAuthTab(tab.id.replace('auth-tab-', '')));
  });
  document.querySelectorAll('.auth-switch-link').forEach(link => {
    link.addEventListener('click', () => switchAuthTab(link.dataset.target));
  });

  document.querySelectorAll('.auth-pw-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      btn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
    });
  });

  document.getElementById('modal-signin-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('modal-signin-error');
    errorEl.classList.add('hidden');
    const email    = document.getElementById('modal-signin-email').value.trim();
    const password = document.getElementById('modal-signin-password').value;
    if (!email || !password) { showModalError(errorEl, 'Please fill in all fields.'); return; }
    if (!isValidEmail(email)) { showModalError(errorEl, 'Please enter a valid email address.'); return; }
    try {
      const res = await fetch(`${API_BASE}/api/users/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const data = await res.json();
        saveUserSession({ firstName: data.firstName || '', lastName: data.lastName || '', email, userId: data.userId || '' });
        window.location.href = 'checkout.html';
      } else {
        const data = await res.json().catch(() => ({}));
        showModalError(errorEl, data.message || 'Invalid email or password.');
      }
    } catch { showModalError(errorEl, 'Could not connect to server. Please try again.'); }
  });

  document.getElementById('modal-signup-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('modal-signup-error');
    errorEl.classList.add('hidden');
    const firstName       = document.getElementById('modal-signup-firstname').value.trim();
    const lastName        = document.getElementById('modal-signup-lastname').value.trim();
    const email           = document.getElementById('modal-signup-email').value.trim();
    const password        = document.getElementById('modal-signup-password').value;
    const confirmPassword = document.getElementById('modal-signup-confirm').value;
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      showModalError(errorEl, 'Please fill in all fields.'); return;
    }
    if (!isValidEmail(email))         { showModalError(errorEl, 'Please enter a valid email address.'); return; }
    if (password.length < 8)          { showModalError(errorEl, 'Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { showModalError(errorEl, 'Passwords do not match.'); return; }
    try {
      const res = await fetch(`${API_BASE}/api/users/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ firstName, lastName, email, password }),
      });
      if (res.ok) {
        const data = await res.json();
        saveUserSession({ firstName, lastName, email, userId: data.userId || '' });
        window.location.href = 'checkout.html';
      } else {
        const data = await res.json().catch(() => ({}));
        showModalError(errorEl, data.message || 'Could not create account. Please try again.');
      }
    } catch { showModalError(errorEl, 'Could not connect to server. Please try again.'); }
  });
}

function openAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('modal-signin-email')?.focus(), 50);
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  document.body.style.overflow = '';
}

function switchAuthTab(targetId) {
  document.querySelectorAll('.auth-tab').forEach(tab => {
    const isActive = tab.id === `auth-tab-${targetId}`;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive);
  });
  document.querySelectorAll('.auth-panel').forEach(panel => {
    panel.classList.toggle('hidden', panel.id !== `auth-panel-${targetId}`);
  });
}

function showModalError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function showEmptyCart() {
  const cartLeft  = document.querySelector('.cart-left');
  const cartRight = document.querySelector('.cart-right');
  if (cartLeft) {
    cartLeft.innerHTML = `
      <h2 class="cart-title">My Cart</h2>
      <div class="cart-empty">
        <p>Your cart is empty.</p>
        <a href="browse-all.html" class="continue-shopping-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Browse all items
        </a>
      </div>
    `;
  }
  if (cartRight) cartRight.style.display = 'none';
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function setText(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
