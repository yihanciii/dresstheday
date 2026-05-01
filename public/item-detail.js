const API_BASE = 'http://localhost:3000';

// ─── Read product ID from URL ─────────────────────────────────────────────────
const urlParams  = new URLSearchParams(window.location.search);
const PRODUCT_ID = urlParams.get('id'); // e.g. "DTD-0001"

// ─── Page state ───────────────────────────────────────────────────────────────
let product      = null;   // full API response
let selectedSize = null;   // number
let backupSize   = null;   // number | null

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if (!PRODUCT_ID) {
    showPageError('No product ID specified.');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/products/${PRODUCT_ID}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    product = await res.json();

    populatePage(product);
    initSizeSelectors(product);
    initCheckoutButton();
    watchCalendarForPriceUpdate();
    loadReviews(PRODUCT_ID);
    initReviewFilters(PRODUCT_ID);
    await initWishlistButton(product.id);

  } catch (err) {
    console.error('Failed to load product:', err);
    showPageError('Could not load product. Please try again.');
  }
});

// ─── 1. Populate page ─────────────────────────────────────────────────────────
function populatePage(p) {
  // <title>
  document.title = `${p.name} – Dress the Day`;

  // Main image
  const imgSrc = p.imageUrl || `/images/${p.imageFilename}`;
  replaceImgPlaceholder('.gallery-main .img-placeholder', imgSrc, p.name);
  // Thumbs — same image for now (only one image per product in DB)
  document.querySelectorAll('.gallery-thumbs .img-placeholder').forEach(el => {
    replaceImgPlaceholder(null, imgSrc, p.name, el);
  });

  // Product name & brand
  setText('.product-name-label', p.clothingType || '');
  setText('.product-brand-heading', p.name);

  // Pricing
  const baseRental = p.rentalPriceTable ? p.rentalPriceTable[3] : null;
  const minRental  = baseRental ? `$${baseRental.toFixed(2)}` : '—';
  setText('.price-rental', `Reserve from ${minRental}`);
  setText('.price-retail', `$${p.retailPrice} Original Retail`);

  // Rating
  renderStars('.product-rating .stars', p.avgRating ?? 0);
  setText('.rating-text', `${p.avgRating ?? '—'} \u00a0(${p.reviewCount ?? 0} Reviews)`);

  // Rental row
  setText('.rental-starting', `Starting at ${minRental}`);

  // Size grid — parse sizeRange "0-12" or "2,4,6,8"
  buildSizeGrid(p.sizeRange);

  // Reviews section
  populateReviews(p);

  // Product details — fixed text across all products
  setText('.details-block:nth-of-type(1) ul', null, buildListHTML([
    "Model is 5'9\" and wearing size 2. This style runs true to size.",
    "We recommend selecting your usual size. If you're between sizes, size up for a relaxed fit or size down for a more tailored look.",
    "Free backup size included with every rental.",
  ]));
  setText('.details-block:nth-of-type(2) ul', null, buildListHTML([
    "Dry clean only. Do not wash, bleach, tumble dry, or iron.",
    "All garments are professionally cleaned and inspected before each rental.",
    "Please return items in the provided garment bag.",
  ]));

  // More like this
  renderRelated(p);

  // "More X like this" heading
  setText('#more-heading', `More ${p.scenarioCategory} like this`);
}

// ─── 2. Size grid ─────────────────────────────────────────────────────────────
function buildSizeGrid(sizeRange) {
  let sizes = [];

  if (!sizeRange) {
    sizes = [0, 2, 4, 6, 8, 10, 12];
  } else if (sizeRange.includes(',')) {
    // Comma-separated: "XS,S,M,L,XL"
    sizes = sizeRange.split(',').map(s => s.trim());
  } else {
    // Try to extract a numeric range from parentheses: "XS-XL (0-14)"
    const parenMatch = sizeRange.match(/\((\d+)[-–](\d+)\)/);
    if (parenMatch) {
      const min = parseInt(parenMatch[1]);
      const max = parseInt(parenMatch[2]);
      for (let s = min; s <= max; s += 2) sizes.push(s);
    } else {
      // Pure numeric range: "0-12" or "2-14"
      const rangeMatch = sizeRange.match(/^(\d+)[-–](\d+)$/);
      if (rangeMatch) {
        const min = parseInt(rangeMatch[1]);
        const max = parseInt(rangeMatch[2]);
        for (let s = min; s <= max; s += 2) sizes.push(s);
      } else {
        // Fallback: use as single size label
        sizes = [sizeRange];
      }
    }
  }

  const sizeGrids   = document.querySelectorAll('.size-section .size-grid');
  const primaryGrid = sizeGrids[0] || null;
  const backupGrid  = sizeGrids[1] || null;

  if (primaryGrid) primaryGrid.innerHTML = sizes.map(s =>
      `<button class="size-btn" data-size="${s}" aria-label="Size ${s}">${s}</button>`
  ).join('');

  if (backupGrid) backupGrid.innerHTML = sizes.map(s =>
      `<button class="size-btn" data-size="${s}" aria-label="Backup size ${s}">${s}</button>`
  ).join('');

  // Auto-select the first available size so selectedSize is always initialized
  if (primaryGrid) {
    const firstBtn = primaryGrid.querySelector('.size-btn:not(.unavailable)');
    if (firstBtn) {
      firstBtn.classList.add('selected');
      selectedSize = firstBtn.dataset.size;
    }
  }
}

// ─── 3. Size selection ────────────────────────────────────────────────────────
function initSizeSelectors(p) {
  // Primary size
  const sizeGrids2  = document.querySelectorAll('.size-section .size-grid');
  const primaryGrid = sizeGrids2[0] || null;
  const backupGrid  = sizeGrids2[1] || null;

  // Helper: sync disabled state on backup grid based on current selectedSize
  function syncBackupDisabled() {
    if (!backupGrid) return;
    backupGrid.querySelectorAll('.size-btn').forEach(btn => {
      if (btn.dataset.size === selectedSize) {
        btn.classList.add('unavailable');
        btn.disabled = true;
        // If this was selected as backup, deselect it
        if (btn.classList.contains('selected')) {
          btn.classList.remove('selected');
          backupSize = null;
        }
      } else {
        btn.classList.remove('unavailable');
        btn.disabled = false;
      }
    });
  }

  if (primaryGrid) {
    primaryGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.size-btn');
      if (!btn || btn.classList.contains('unavailable')) return;

      primaryGrid.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedSize = btn.dataset.size;

      // Disable the matching size in backup grid
      syncBackupDisabled();
    });

    // Run once on init so the auto-selected primary size is already disabled in backup
    syncBackupDisabled();
  }

  if (backupGrid) {
    backupGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.size-btn');
      if (!btn || btn.classList.contains('unavailable')) return;

      // Clicking already-selected backup deselects it
      if (btn.classList.contains('selected')) {
        btn.classList.remove('selected');
        backupSize = null;
        return;
      }

      backupGrid.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      backupSize = btn.dataset.size;
    });
  }
}

// ─── 4. Rental price update when dates change ─────────────────────────────────
// Poll calendarGetSelection() after the modal closes via the confirm button
function watchCalendarForPriceUpdate() {
  // Listen for the confirm button click (calendar.js fires applyDatesToButton first)
  document.addEventListener('click', (e) => {
    if (e.target.closest('#cal-confirm')) {
      // Small delay to let calendar.js finish
      setTimeout(updatePriceFromCalendar, 50);
    }
  });
}

function updatePriceFromCalendar() {
  if (!product || !window.calendarGetSelection) return;
  const sel = window.calendarGetSelection();
  if (!sel) return;

  const { days } = sel;
  const price = product.rentalPriceTable?.[days];
  if (price !== undefined) {
    setText('.price-rental', `Reserve for $${price.toFixed(2)}`);
    setText('.rental-starting', `$${price.toFixed(2)} for ${days} days`);
  }
}

// ─── 5. Add to Cart button + Cart Drawer ─────────────────────────────────────
function initCheckoutButton() {
  const btn = document.querySelector('.checkout-btn');
  if (!btn) return;

  // Rename button label
  btn.textContent = 'Add to Cart';

  buildCartDrawer();

  btn.addEventListener('click', () => {
    if (!selectedSize) {
      alert('Please select a size before adding to cart.');
      return;
    }

    const dateSel = window.calendarGetSelection ? window.calendarGetSelection() : null;
    if (!dateSel) {
      alert('Please select your rental dates before adding to cart.');
      return;
    }

    const rentalPrice = product.rentalPriceTable?.[dateSel.days] ?? null;

    const cartItem = {
      productId:     product.id,
      name:          product.name,
      clothingType:  product.clothingType,
      imageFilename: product.imageFilename,
      imageUrl: product.imageUrl,
      retailPrice:   product.retailPrice,
      selectedSize,
      backupSize,
      arrivalDate:   dateSel.arrivalDate.toISOString(),
      returnDate:    dateSel.returnDate.toISOString(),
      days:          dateSel.days,
      rentalPrice,
    };

    localStorage.setItem('dtd_cart_item', JSON.stringify(cartItem));
    openCartDrawer(cartItem);
  });
}

// ─── Cart Drawer ──────────────────────────────────────────────────────────────
function buildCartDrawer() {
  if (document.getElementById('cart-drawer')) return;

  const drawer = document.createElement('div');
  drawer.id = 'cart-drawer';
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-label', 'Cart');
  drawer.hidden = true;

  drawer.innerHTML = `
    <div class="cart-drawer-backdrop"></div>
    <div class="cart-drawer-panel">
      <div class="cart-drawer-header">
        <h2 class="cart-drawer-title">Added to Cart</h2>
        <button class="cart-drawer-close" aria-label="Close cart">&#x2715;</button>
      </div>
      <div class="cart-drawer-item">
        <div class="cart-drawer-img" id="drawer-img"></div>
        <div class="cart-drawer-info">
          <p class="cart-drawer-name" id="drawer-name"></p>
          <p class="cart-drawer-detail" id="drawer-size"></p>
          <p class="cart-drawer-detail" id="drawer-backup"></p>
          <p class="cart-drawer-detail" id="drawer-dates"></p>
          <p class="cart-drawer-detail" id="drawer-days"></p>
          <p class="cart-drawer-price" id="drawer-price"></p>
        </div>
      </div>
      <div class="cart-drawer-actions">
        <button class="cart-drawer-btn cart-drawer-btn--checkout" id="drawer-checkout-btn">Checkout</button>
        <a class="cart-drawer-btn cart-drawer-btn--view-cart" href="cart.html">View Cart</a>
      </div>
    </div>
  `;

  document.body.appendChild(drawer);

  drawer.querySelector('.cart-drawer-backdrop').addEventListener('click', closeCartDrawer);
  drawer.querySelector('.cart-drawer-close').addEventListener('click', closeCartDrawer);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCartDrawer();
  });

  // Checkout button: check session first, show modal if not logged in
  drawer.querySelector('#drawer-checkout-btn').addEventListener('click', async () => {
    try {
      const res = await fetch(`${API_BASE}/api/users/me`, { credentials: 'include' });
      if (res.ok) {
        window.location.href = 'checkout.html';
      } else {
        closeCartDrawer();
        openAuthModal();
      }
    } catch {
      closeCartDrawer();
      openAuthModal();
    }
  });
}

function openCartDrawer(cartItem) {
  const drawer = document.getElementById('cart-drawer');
  if (!drawer) return;

  drawer.querySelector('#drawer-img').innerHTML = `
    <img src="${cartItem.imageUrl || '/images/' + cartItem.imageFilename}" alt="${cartItem.name.replace(/"/g,'&quot;')}" loading="lazy" onerror="this.style.display='none'" />
  `;

  drawer.querySelector('#drawer-name').textContent   = cartItem.name;
  drawer.querySelector('#drawer-size').textContent   = `Size: ${cartItem.selectedSize}`;
  drawer.querySelector('#drawer-backup').textContent = cartItem.backupSize
      ? `Backup size: ${cartItem.backupSize}` : 'No backup size';
  drawer.querySelector('#drawer-dates').textContent  =
      `${formatDate(new Date(cartItem.arrivalDate))} \u2192 ${formatDate(new Date(cartItem.returnDate))}`;
  drawer.querySelector('#drawer-days').textContent   = `${cartItem.days} day rental`;
  drawer.querySelector('#drawer-price').textContent  = cartItem.rentalPrice
      ? `$${cartItem.rentalPrice.toFixed(2)}` : '';

  drawer.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  if (drawer) drawer.hidden = true;
  document.body.style.overflow = '';
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}


// ─── 6. Reviews ───────────────────────────────────────────────────────────────
function populateReviews(p) {
  setText('.summary-label', null, `Customers Say: <strong>${p.customersSay || '—'}</strong>`);

  if (!p.review || !p.review.reviewText) return;

  const r = p.review;
  const card = document.querySelector('.review-card');
  if (!card) return;

  card.querySelector('.review-meta').innerHTML = `
    <p><strong>Location:</strong> ${r.location || '—'}</p>
    <p><strong>Age:</strong> ${r.age || '—'}</p>
    <p><strong>Body Type:</strong> ${r.bodyType || '—'}</p>
  `;

  card.querySelector('.review-score').textContent = r.starRating ?? '—';
  renderStars('.review-rating-row .stars', r.starRating);
  setText('.review-text', r.reviewText);
  card.querySelector('.review-details').innerHTML = `
    <p><strong>Fits:</strong> ${r.fits || '—'}</p>
    <p><strong>Size Rented:</strong> ${r.sizeRented || '—'}</p>
    <p><strong>Size Normally Worn:</strong> ${r.sizeNormallyWorn || '—'}</p>
    <p><strong>Occasion:</strong> ${r.occasion || '—'}</p>
  `;
}

// ─── 7. Related products ─────────────────────────────────────────────────────
async function renderRelated(p) {
    const grid = document.querySelector('.more-grid');
    if (!grid) return;

    try {
        const res = await fetch(`/api/products?subCategory=${encodeURIComponent(p.subCategory)}&limit=5`);
        const data = await res.json();

        const related = data.products.filter(r => r.id !== p.id).slice(0, 4);

        if (!related.length) { grid.innerHTML = ''; return; }

        grid.innerHTML = related.map(r => `
      <article class="product-card" onclick="window.location.href='product.html?id=${r.id}'">
        <div class="card-img">
          ${r.imageUrl
            ? `<img src="${r.imageUrl}" alt="${escapeHTML(r.name)}" loading="lazy" onerror="this.style.display='none'">`
            : `<div class="img-placeholder"></div>`
        }
        </div>
        <div class="card-info">
          <p class="card-name">${escapeHTML(r.name)}</p>
          <p class="card-meta">
            <span class="brand">${escapeHTML(r.brand || r.clothingType || '')}</span>
            <span class="sep"> | </span>
            Retail $${r.retailPrice ?? '—'}
          </p>
        </div>
      </article>
    `).join('');
    } catch(err) {
        console.error('Related products failed:', err);
    }
}

// ─── DOM helpers ─────────────────────────────────────────────────────────────
function setText(selector, text, html) {
  const el = typeof selector === 'string'
      ? document.querySelector(selector)
      : selector;
  if (!el) return;
  if (html !== undefined) { el.innerHTML = html; }
  else if (text !== null && text !== undefined) { el.textContent = text; }
}

function replaceImgPlaceholder(selector, src, alt, el) {
  const target = el || (selector ? document.querySelector(selector) : null);
  if (!target) return;
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt;
  img.loading = 'lazy';
  img.onerror = () => { img.style.display = 'none'; };
  target.replaceWith(img);
}

function renderStars(selector, rating) {
  const el = document.querySelector(selector);
  if (!el) return;
  const full  = Math.floor(rating);
  const empty = 5 - full;
  el.innerHTML =
      '<span class="star filled">★</span>'.repeat(full) +
      '<span class="star empty">★</span>'.repeat(empty);
}

function buildListHTML(items) {
  return items
      .filter(Boolean)
      .map(item => `<li>${escapeHTML(item)}</li>`)
      .join('');
}

function escapeHTML(str) {
  return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
}

function showPageError(msg) {
  const main = document.querySelector('main');
  if (main) main.innerHTML = `<p style="padding:2rem;text-align:center">${msg}</p>`;
}
// ─── Auth Modal (dynamically injected, same as cart.html) ────────────────────
function buildAuthModal() {
  if (document.getElementById('auth-modal')) return; // already exists

  const modal = document.createElement('div');
  modal.className = 'auth-modal-backdrop hidden';
  modal.id = 'auth-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Sign in to continue');

  modal.innerHTML = `
    <div class="auth-modal-panel">
      <button class="auth-modal-close" id="auth-modal-close" aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      <p class="auth-modal-eyebrow">Almost there!</p>
      <h2 class="auth-modal-title">Sign in to checkout</h2>

      <div class="auth-tabs">
        <button class="auth-tab active" id="auth-tab-signin"
                aria-selected="true" aria-controls="auth-panel-signin">Sign In</button>
        <button class="auth-tab" id="auth-tab-signup"
                aria-selected="false" aria-controls="auth-panel-signup">Create Account</button>
      </div>

      <!-- Sign In Panel -->
      <div class="auth-panel" id="auth-panel-signin">
        <form class="auth-form" id="modal-signin-form" novalidate>
          <div class="auth-error-msg hidden" id="modal-signin-error" role="alert"></div>
          <div class="auth-field">
            <label class="auth-label" for="modal-signin-email">Email Address</label>
            <input class="auth-input" type="email" id="modal-signin-email"
                   name="email" placeholder="you@email.com"
                   autocomplete="email" required />
          </div>
          <div class="auth-field">
            <label class="auth-label" for="modal-signin-password">
              Password
              <a href="#" class="auth-forgot-link">Forgot password?</a>
            </label>
            <div class="auth-password-wrapper">
              <input class="auth-input" type="password" id="modal-signin-password"
                     name="password" placeholder="Enter your password"
                     autocomplete="current-password" required />
              <button type="button" class="auth-pw-toggle"
                      aria-label="Show password" data-target="modal-signin-password">
                <svg class="icon-svg" viewBox="0 0 24 24">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
            </div>
          </div>
          <button type="submit" class="auth-submit-btn">Sign In &amp; Checkout</button>
          <p class="auth-switch">
            Don't have an account?
            <button type="button" class="auth-switch-link" data-target="signup">Create one</button>
          </p>
        </form>
      </div>

      <!-- Create Account Panel -->
      <div class="auth-panel hidden" id="auth-panel-signup">
        <form class="auth-form" id="modal-signup-form" novalidate>
          <div class="auth-error-msg hidden" id="modal-signup-error" role="alert"></div>
          <div class="auth-row">
            <div class="auth-field">
              <label class="auth-label" for="modal-signup-firstname">First Name</label>
              <input class="auth-input" type="text" id="modal-signup-firstname"
                     name="firstName" placeholder="First name"
                     autocomplete="given-name" required />
            </div>
            <div class="auth-field">
              <label class="auth-label" for="modal-signup-lastname">Last Name</label>
              <input class="auth-input" type="text" id="modal-signup-lastname"
                     name="lastName" placeholder="Last name"
                     autocomplete="family-name" required />
            </div>
          </div>
          <div class="auth-field">
            <label class="auth-label" for="modal-signup-email">Email Address</label>
            <input class="auth-input" type="email" id="modal-signup-email"
                   name="email" placeholder="you@email.com"
                   autocomplete="email" required />
          </div>
          <div class="auth-field">
            <label class="auth-label" for="modal-signup-password">Password</label>
            <div class="auth-password-wrapper">
              <input class="auth-input" type="password" id="modal-signup-password"
                     name="password" placeholder="Create a password (min 8 chars)"
                     autocomplete="new-password" required />
              <button type="button" class="auth-pw-toggle"
                      aria-label="Show password" data-target="modal-signup-password">
                <svg class="icon-svg" viewBox="0 0 24 24">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="auth-field">
            <label class="auth-label" for="modal-signup-confirm">Confirm Password</label>
            <div class="auth-password-wrapper">
              <input class="auth-input" type="password" id="modal-signup-confirm"
                     name="confirmPassword" placeholder="Confirm your password"
                     autocomplete="new-password" required />
              <button type="button" class="auth-pw-toggle"
                      aria-label="Show confirm password" data-target="modal-signup-confirm">
                <svg class="icon-svg" viewBox="0 0 24 24">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
            </div>
          </div>
          <button type="submit" class="auth-submit-btn">Create Account &amp; Checkout</button>
          <p class="auth-switch">
            Already have an account?
            <button type="button" class="auth-switch-link" data-target="signin">Sign in</button>
          </p>
        </form>
      </div>

    </div>
  `;

  document.body.appendChild(modal);
  initAuthModalEvents();
}

function initAuthModalEvents() {
  const modal = document.getElementById('auth-modal');

  // Close on backdrop / button / Escape
  modal.addEventListener('click', (e) => { if (e.target === modal) closeAuthModal(); });
  document.getElementById('auth-modal-close').addEventListener('click', closeAuthModal);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAuthModal(); });

  // Tab switching
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => switchAuthTab(tab.id.replace('auth-tab-', '')));
  });
  document.querySelectorAll('.auth-switch-link').forEach(link => {
    link.addEventListener('click', () => switchAuthTab(link.dataset.target));
  });

  // Password toggles
  document.querySelectorAll('.auth-pw-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      btn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
    });
  });

  // Sign In submit
  document.getElementById('modal-signin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('modal-signin-error');
    errorEl.classList.add('hidden');

    const email    = document.getElementById('modal-signin-email').value.trim();
    const password = document.getElementById('modal-signin-password').value;

    if (!email || !password) { showAuthError(errorEl, 'Please fill in all fields.'); return; }
    if (!isValidEmail(email)) { showAuthError(errorEl, 'Please enter a valid email address.'); return; }

    try {
      const res = await fetch(`${API_BASE}/api/users/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('dtd_user', JSON.stringify({
          firstName: data.firstName || '',
          lastName:  data.lastName  || '',
          email,
          userId: data.userId || '',
        }));
        window.location.href = 'checkout.html';
      } else {
        const data = await res.json().catch(() => ({}));
        showAuthError(errorEl, data.message || 'Invalid email or password.');
      }
    } catch {
      showAuthError(errorEl, 'Could not connect to server. Please try again.');
    }
  });

  // Create Account submit
  document.getElementById('modal-signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('modal-signup-error');
    errorEl.classList.add('hidden');

    const firstName       = document.getElementById('modal-signup-firstname').value.trim();
    const lastName        = document.getElementById('modal-signup-lastname').value.trim();
    const email           = document.getElementById('modal-signup-email').value.trim();
    const password        = document.getElementById('modal-signup-password').value;
    const confirmPassword = document.getElementById('modal-signup-confirm').value;

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      showAuthError(errorEl, 'Please fill in all fields.'); return;
    }
    if (!isValidEmail(email))         { showAuthError(errorEl, 'Please enter a valid email address.'); return; }
    if (password.length < 8)          { showAuthError(errorEl, 'Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { showAuthError(errorEl, 'Passwords do not match.'); return; }

    try {
      const res = await fetch(`${API_BASE}/api/users/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ firstName, lastName, email, password }),
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('dtd_user', JSON.stringify({
          firstName, lastName, email, userId: data.userId || '',
        }));
        window.location.href = 'checkout.html';
      } else {
        const data = await res.json().catch(() => ({}));
        showAuthError(errorEl, data.message || 'Could not create account. Please try again.');
      }
    } catch {
      showAuthError(errorEl, 'Could not connect to server. Please try again.');
    }
  });
}

function openAuthModal() {
  buildAuthModal(); // inject HTML if not already there
  const modal = document.getElementById('auth-modal');
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

function showAuthError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
// ─── Reviews from DB ──────────────────────────────────────────────────────────
async function loadReviews(productId, ratingFilter = '', bodyTypeFilter = '') {
  try {
    const isFiltered = ratingFilter || (bodyTypeFilter && bodyTypeFilter !== 'All Body Types');

    // Always fetch unfiltered for summary stats
    const allRes = await fetch(`${API_BASE}/api/reviews/${productId}`);
    const allData = await allRes.json();

    // Always update summary with FULL unfiltered data
    setText('.summary-score', allData.avgRating);
    renderStars('.review-summary-box .stars', allData.avgRating);
    setText('.summary-count', `(${allData.reviewCount} Reviews)`);
    renderStars('.product-rating .stars', allData.avgRating);
    setText('.rating-text', `${allData.avgRating} \u00a0(${allData.reviewCount} Reviews)`);

    // Fetch filtered reviews for display
    let url = `${API_BASE}/api/reviews/${productId}`;
    const params = new URLSearchParams();
    if (ratingFilter) params.set('rating', ratingFilter);
    if (bodyTypeFilter && bodyTypeFilter !== 'All Body Types') params.set('bodyType', bodyTypeFilter);
    if ([...params].length) url += '?' + params.toString();

    const res = isFiltered ? await fetch(url) : { ok: true, json: async () => allData };
    const data = isFiltered ? await res.json() : allData;

    // Use reviews-section as anchor, never modify it
    const reviewsSection = document.querySelector('.reviews-section');
    if (!reviewsSection) return;

    // Remove previous dynamic cards and messages
    reviewsSection.querySelectorAll('.review-card-dynamic, .no-reviews-msg').forEach(el => el.remove());

    // Find insert position — before </section> end, after hr
    const hr = reviewsSection.querySelector('.review-divider');
    const insertAfter = hr || reviewsSection.querySelector('.review-filters');

    if (!data.reviews.length) {
      const noResult = document.createElement('p');
      noResult.className = 'no-reviews-msg';
      noResult.style.cssText = 'color:#888;padding:1rem 0';
      noResult.textContent = 'No reviews match your filters.';
      insertAfter ? insertAfter.after(noResult) : reviewsSection.appendChild(noResult);
      return;
    }

    // Insert new cards before the Browse All button
    data.reviews.forEach(r => {
      const card = document.createElement('div');
      card.className = 'review-card review-card-dynamic';
      card.innerHTML = `
        <div class="review-meta">
          <p><strong>Location:</strong> ${r.location || '—'}</p>
          <p><strong>Age:</strong> ${r.age || '—'}</p>
          <p><strong>Body Type:</strong> ${r.bodyType || '—'}</p>
        </div>
        <div class="review-body">
          <div class="review-rating-row">
            <span class="review-score">${r.rating}.0</span>
            <span class="stars">${'<span class="star filled">★</span>'.repeat(r.rating)}${'<span class="star empty">★</span>'.repeat(5 - r.rating)}</span>
          </div>
          <p class="review-text">${r.comment || ''}</p>
          <div class="review-details">
            <p><strong>Fits:</strong> ${r.fits || '—'}</p>
            <p><strong>Size Rented:</strong> ${r.sizeRented || '—'}</p>
            <p><strong>Size Normally Worn:</strong> ${r.sizeNormallyWorn || '—'}</p>
            <p><strong>Occasion:</strong> ${r.occasion || '—'}</p>
          </div>
        </div>
      `;
      reviewsSection.appendChild(card);
    });

  } catch (err) {
    console.error('Failed to load reviews:', err);
  }
}

// Init review filters
function initReviewFilters(productId) {
  const ratingSelect   = document.getElementById('star-filter');
  const bodyTypeSelect = document.getElementById('body-filter');
  const resetBtn       = document.querySelector('.reset-filters-btn');

  function applyFilters() {
    const ratingText = ratingSelect?.value || '';
    const rating = ratingText.includes('5') ? '5'
                 : ratingText.includes('4') ? '4'
                 : ratingText.includes('3') ? '3'
                 : ratingText.includes('2') ? '2'
                 : ratingText.includes('1') ? '1' : '';

    const bodyType = bodyTypeSelect?.value === 'All Body Types' ? '' : (bodyTypeSelect?.value || '');
    loadReviews(productId, rating, bodyType);
  }

  ratingSelect?.addEventListener('change', applyFilters);
  bodyTypeSelect?.addEventListener('change', applyFilters);
  resetBtn?.addEventListener('click', () => {
    if (ratingSelect)   ratingSelect.value   = 'All Ratings';
    if (bodyTypeSelect) bodyTypeSelect.value = 'All Body Types';
    loadReviews(productId);
  });
}


// ─── Wishlist button ──────────────────────────────────────────────────────────
function getWishlistLocal() {
  try { return JSON.parse(localStorage.getItem('dtd_wishlist') || '[]'); }
  catch { return []; }
}

async function initWishlistButton(productId) {
  const btn = document.querySelector('.wishlist-btn');
  if (!btn) return;

  // Sync from backend first
  try {
    const res = await fetch(`${API_BASE}/api/users/me`, { credentials: 'include' });
    if (res.ok) {
      const user = await res.json();
      if (Array.isArray(user.wishlist)) {
        localStorage.setItem('dtd_wishlist', JSON.stringify(user.wishlist));
      }
    }
  } catch {}

  // Set initial state
  const wishlisted = getWishlistLocal().includes(productId);
  btn.classList.toggle('wishlisted', wishlisted);
  btn.setAttribute('aria-pressed', wishlisted);
  btn.setAttribute('aria-label', wishlisted ? 'Remove from wishlist' : 'Add to wishlist');

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Require login
    const user = (() => { try { return JSON.parse(localStorage.getItem('dtd_user') || '{}'); } catch { return {}; } })();
    if (!user.firstName) {
      sessionStorage.setItem('dtd_login_return', `product.html?id=${productId}`);
      window.location.href = 'login.html';
      return;
    }

    const nowLiked = !getWishlistLocal().includes(productId);

    // Optimistic UI
    btn.classList.toggle('wishlisted', nowLiked);
    btn.setAttribute('aria-pressed', nowLiked);
    btn.setAttribute('aria-label', nowLiked ? 'Remove from wishlist' : 'Add to wishlist');

    // Update localStorage cache
    const list = getWishlistLocal();
    if (nowLiked) { if (!list.includes(productId)) list.push(productId); }
    else          { const i = list.indexOf(productId); if (i !== -1) list.splice(i, 1); }
    localStorage.setItem('dtd_wishlist', JSON.stringify(list));

    // Sync to backend
    try {
      await fetch(`${API_BASE}/api/users/me/wishlist`, {
        method:      'PATCH',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ productId, action: nowLiked ? 'add' : 'remove' }),
      });
    } catch (err) {
      console.error('Wishlist sync failed:', err);
    }
  });
}
