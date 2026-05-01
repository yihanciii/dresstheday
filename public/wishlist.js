const API_BASE = 'http://localhost:3000';

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  updateAccountIcon();
  updateSidebarName();
  await loadWishlist();
});

// ─── Auth helpers ─────────────────────────────────────────────────────────────
function getUser() {
  try { return JSON.parse(localStorage.getItem('dtd_user') || '{}'); }
  catch { return {}; }
}

function updateSidebarName() {
  const user = getUser();
  const el = document.getElementById('sidebar-username');
  if (el && user.firstName) {
    el.textContent = (user.firstName + (user.lastName ? ' ' + user.lastName : '')).trim();
  }
}

function updateAccountIcon() {
  const link = document.getElementById('account-icon-link');
  if (!link) return;
  const user = getUser();
  if (user.firstName) {
    const initial = user.firstName.charAt(0).toUpperCase();
    link.href = 'account-information.html';
    link.innerHTML = `<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:#5c3d2e;color:#fff;font-size:13px;font-weight:600;font-family:inherit;line-height:1;cursor:pointer;">${initial}</span>`;
  }
}

// ─── Load wishlist from backend ───────────────────────────────────────────────
async function loadWishlist() {
  const grid = document.querySelector('.wl-grid');
  const subtitle = document.querySelector('.returns-subtitle');
  if (!grid) return;

  grid.innerHTML = '<li style="padding:2rem;color:#999;">Loading wishlist…</li>';

  try {
    // Get user profile (includes wishlist array of productIds)
    const res = await fetch(`${API_BASE}/api/users/me`, { credentials: 'include' });
    if (res.status === 401) {
      window.location.href = 'login.html';
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const user = await res.json();
    const wishlistIds = user.wishlist || [];

    // Update localStorage cache
    localStorage.setItem('dtd_wishlist', JSON.stringify(wishlistIds));

    if (wishlistIds.length === 0) {
      if (subtitle) subtitle.textContent = '0 saved items';
      grid.innerHTML = `
        <li style="padding:2rem;grid-column:1/-1;text-align:center;">
          <p style="margin-bottom:1rem;color:#666;">Your wishlist is empty.</p>
          <a href="browse-all.html" style="color:#5c3d2e;text-decoration:underline;">Browse all items</a>
        </li>`;
      return;
    }

    // Fetch product details for each wishlisted item
    const products = await Promise.all(
      wishlistIds.map(id =>
        fetch(`${API_BASE}/api/products/${id}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )
    );

    const validProducts = products.filter(Boolean);
    if (subtitle) subtitle.textContent = `${validProducts.length} saved item${validProducts.length === 1 ? '' : 's'}`;

    grid.innerHTML = validProducts.map(p => createWishlistCard(p)).join('');

    // Bind remove buttons
    grid.querySelectorAll('.wl-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => handleRemove(e, btn.dataset.productId));
    });

    // Bind Rent Now buttons
    grid.querySelectorAll('.wl-rent-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        window.location.href = `product.html?id=${btn.dataset.productId}`;
      });
    });

  } catch (err) {
    console.error('Failed to load wishlist:', err);
    grid.innerHTML = '<li style="padding:2rem;color:#c00;">Could not load wishlist. Please refresh.</li>';
  }
}

// ─── Create wishlist card HTML ────────────────────────────────────────────────
function createWishlistCard(p) {
  const imgSrc = p.imageUrl || `${API_BASE}/images/${p.imageFilename}`;
  const retail = p.retailPrice ? `Retail $${p.retailPrice}` : '';
  const rental = p.rentalPrice3Days ? `Rent from $${p.rentalPrice3Days.toFixed(2)}` : '';

  return `
    <li class="wl-card">
      <div class="wl-card__img">
        <img src="${imgSrc}" alt="${escapeHTML(p.name)}" loading="lazy"
             onerror="this.style.display='none'"
             style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" />
        <button class="wl-remove-btn" aria-label="Remove from wishlist"
                data-product-id="${p.id}"
                style="position:absolute;top:8px;right:8px;z-index:10;">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"
               stroke="currentColor" stroke-width="1.5">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
          </svg>
        </button>
      </div>
      <div class="wl-card__info">
        <p class="wl-card__name">${escapeHTML(p.name)}</p>
        <p class="wl-card__brand">${escapeHTML(p.clothingType || '')}</p>
        <p class="wl-card__price">${retail}</p>
        ${rental ? `<p style="font-size:0.85rem;color:#5c3d2e;margin-top:2px;">${rental}</p>` : ''}
        <button class="wl-rent-btn" data-product-id="${p.id}">Rent Now</button>
      </div>
    </li>
  `;
}

// ─── Remove from wishlist ─────────────────────────────────────────────────────
async function handleRemove(e, productId) {
  e.preventDefault();
  e.stopPropagation();

  const card = e.currentTarget.closest('.wl-card');
  if (card) card.style.opacity = '0.5';

  try {
    await fetch(`${API_BASE}/api/users/me/wishlist`, {
      method:      'PATCH',
      headers:     { 'Content-Type': 'application/json' },
      credentials: 'include',
      body:        JSON.stringify({ productId, action: 'remove' }),
    });

    // Update localStorage
    const list = JSON.parse(localStorage.getItem('dtd_wishlist') || '[]');
    const idx = list.indexOf(productId);
    if (idx !== -1) list.splice(idx, 1);
    localStorage.setItem('dtd_wishlist', JSON.stringify(list));

    // Reload to reflect change
    await loadWishlist();

  } catch (err) {
    console.error('Remove failed:', err);
    if (card) card.style.opacity = '1';
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
