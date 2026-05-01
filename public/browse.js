const API_BASE = 'http://localhost:3000';
const ITEMS_PER_PAGE = 8;

const PAGE_FILENAME = window.location.pathname.split('/').pop() || 'index.html';

// Map HTML filenames → API query params

const PAGE_CONFIG = {
  'browse-all.html': { category: null, subCategory: null },

  'holiday-party.html':       { category: 'Holiday & Party', subCategory: null },
  'halloween.html':           { category: 'Holiday & Party', subCategory: 'Halloween' },
  'christmas.html':           { category: 'Holiday & Party', subCategory: 'Christmas' },
  'new-years-eve.html':       { category: 'Holiday & Party', subCategory: "New Year's Eve" },
  'prom-night.html':          { category: 'Holiday & Party', subCategory: 'Prom Night' },
  'bachelorette-party.html':  { category: 'Holiday & Party', subCategory: 'Bachelorette Party' },
  'birthday-party.html':      { category: 'Holiday & Party', subCategory: 'Birthday Party' },
  'cocktail-party.html':      { category: 'Holiday & Party', subCategory: 'Cocktail Party' },
  'gala-fundraiser.html':     { category: 'Holiday & Party', subCategory: 'Gala/Fundraiser' },
  'graduation.html':          { category: 'Wedding & Formal', subCategory: 'Graduation' },

  'cultural-traditional.html':  { category: 'Cultural & Traditional', subCategory: null },
  'african-print.html':         { category: 'Cultural & Traditional', subCategory: 'African Print' },
  'hanfu.html':                 { category: 'Cultural & Traditional', subCategory: 'Hanfu' },
  'indian-saree.html':          { category: 'Cultural & Traditional', subCategory: 'Indian Saree' },
  'japanese-kimono.html':       { category: 'Cultural & Traditional', subCategory: 'Japanese Kimono' },
  'irish-celtic.html':          { category: 'Cultural & Traditional', subCategory: 'Irish/Celtic' },
  'flamenco.html':              { category: 'Cultural & Traditional', subCategory: 'Flamenco' },
  'black-tie-gala.html':        { category: 'Cultural & Traditional', subCategory: 'Black Tie Gala' },

  'wedding-formal.html':      { category: 'Wedding & Formal', subCategory: null },
  'bride.html':               { category: 'Wedding & Formal', subCategory: 'Bride' },
  'bridesmaid.html':          { category: 'Wedding & Formal', subCategory: 'Bridesmaid' },
  'wedding-guest.html':       { category: 'Wedding & Formal', subCategory: 'Wedding Guest' },
  'engagement-party.html':    { category: 'Wedding & Formal', subCategory: 'Engagement Party' },
  'rehearsal-dinner.html':    { category: 'Wedding & Formal', subCategory: 'Rehearsal Dinner' },
  'black-tie-gala.html':      { category: 'Wedding & Formal', subCategory: 'Black Tie Gala' },
  'diwali.html':              { category: 'Cultural & Traditional', subCategory: 'Diwali' },
};

const config = PAGE_CONFIG[PAGE_FILENAME] || { category: null, subCategory: null };

let state = {
  currentPage: 1,
  totalItems: 0,
  sort: 'price_asc',
  clothingTypeFilter: null,
};

// DOM refs
const grid        = document.querySelector('.product-grid');
const itemCountEl = document.querySelector('.item-count');
const pageInfoEl  = document.querySelector('.page-info');
const paginationEl = document.querySelector('.pagination-wrap');

// Fetch + Render
async function loadProducts() { // returns promise
  showSkeleton();

  const params = new URLSearchParams({
    sort:  state.sort,
    page:  state.currentPage,
    limit: ITEMS_PER_PAGE,
  });

  if (config.category)    params.set('category',    config.category);
  if (config.subCategory) params.set('subCategory', config.subCategory);

  // browse-all clothing-type chip filter (front-end driven, sent as clothingType param)
  if (PAGE_FILENAME === 'browse-all.html' && state.clothingTypeFilter) {
    params.set('clothingType', state.clothingTypeFilter);
  }

  try {
    const res = await fetch(`${API_BASE}/api/products?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    state.totalItems = data.total;
    renderGrid(data.products);
    renderPageInfo(data.page, data.limit, data.total);
    renderPagination(data.page, data.total, data.limit);
    updateItemCount(data.total);
    refreshWishlistUI(); // re-apply wishlist state after each render
  } catch (err) {
    console.error('Failed to load products:', err);
    showError();
  }
}

//  Grid rendering
function renderGrid(products) {
  if (!grid) return;

  if (products.length === 0) {
    grid.innerHTML = `<p class="no-results">No items found. Try adjusting your filters.</p>`;
    return;
  }

  grid.innerHTML = products.map(p => createCardHTML(p)).join('');

  // Event delegation: one listener on grid handles all wishlist clicks
}

function createCardHTML(product) {
  const imgSrc   = product.imageUrl || `/images/${product.imageFilename}`;
  const imgAlt   = product.name;
  const detailUrl = `product.html?id=${product.id}`;
  const rental   = product.rentalPrice3Days
      ? `Rent from $${product.rentalPrice3Days.toFixed(2)}`
      : '';

  // Check if item is wishlisted (stored in localStorage)
  const wishlisted = isWishlisted(product.id);

  return `
    <article class="product-card" data-id="${product.id}">
      <a href="${detailUrl}" class="card-img-link" aria-label="View ${product.name}">
        <div class="card-img">
          <img
            src="${imgSrc}"
            alt="${imgAlt}"
            loading="lazy"
          onerror="this.style.display='none'"
          />
        </div>
      </a>
      <button
        class="wishlist-btn${wishlisted ? ' wishlisted' : ''}"
        aria-label="${wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}"
        title="${wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}"
        aria-pressed="${wishlisted}"
        data-product-id="${product.id}"
        style="z-index:10;"
      >
        <svg viewBox="0 0 24 24">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
        </svg>
      </button>
      <a href="${detailUrl}" class="card-info-link">
        <div class="card-info">
          <p class="card-name">${escapeHTML(product.name)}</p>
          <p class="card-meta">
            <span class="brand">${escapeHTML(product.brand || product.clothingType || '')}</span>
            <span class="sep">|</span>
            Retail $${product.retailPrice}
          </p>
          ${rental ? `<p class="card-rental">${rental}</p>` : ''}
        </div>
      </a>
    </article>
  `;
}

// Skeleton loader
function showSkeleton() {
  if (!grid) return;
  grid.innerHTML = Array(ITEMS_PER_PAGE).fill(`
    <article class="product-card product-card--skeleton">
      <div class="card-img"><div class="img-placeholder skeleton-pulse"></div></div>
      <div class="card-info">
        <div class="skeleton-line skeleton-pulse" style="width:70%;height:14px;margin-bottom:6px"></div>
        <div class="skeleton-line skeleton-pulse" style="width:50%;height:12px"></div>
      </div>
    </article>
  `).join('');
}

function showError() {
  if (!grid) return;
  grid.innerHTML = `<p class="load-error">Something went wrong. Please refresh and try again.</p>`;
}

// Page info
function renderPageInfo(page, limit, total) {
  if (!pageInfoEl) return;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to   = Math.min(page * limit, total);
  pageInfoEl.textContent = `Showing ${from}–${to} of ${total.toLocaleString()} items`;
}

function updateItemCount(total) {
  if (itemCountEl) {
    itemCountEl.textContent = `${total.toLocaleString()} Items`;
  }
}

// Pagination
function renderPagination(currentPage, total, limit) {
  if (!paginationEl) return;

  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) {
    paginationEl.innerHTML = '';
    return;
  }

  // Build page number list with ellipsis logic
  const pages = buildPageList(currentPage, totalPages);

  const prevDisabled = currentPage <= 1;
  const nextDisabled = currentPage >= totalPages;

  paginationEl.innerHTML = `
    <button class="pg-arrow${prevDisabled ? ' disabled' : ''}" aria-label="Previous page" data-page="${currentPage - 1}" ${prevDisabled ? 'disabled' : ''}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
    </button>

    ${pages.map(p =>
      p === '...'
          ? `<span class="pg-ellipsis">…</span>`
          : `<button class="pg-btn${p === currentPage ? ' active' : ''}" aria-label="Page ${p}" ${p === currentPage ? 'aria-current="page"' : ''} data-page="${p}">${p}</button>`
  ).join('')}

    <button class="pg-arrow${nextDisabled ? ' disabled' : ''}" aria-label="Next page" data-page="${currentPage + 1}" ${nextDisabled ? 'disabled' : ''}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </button>
  `;

  // Attach pagination click listener
  paginationEl.addEventListener('click', handlePageClick);
}

function buildPageList(current, total) {
  // Always show: first, last, current ±2, with '...' gaps
  const pages = [];
  const delta = 2;
  const range = [];

  for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
    range.push(i);
  }

  if (current - delta > 2)    range.unshift('...');
  if (current + delta < total - 1) range.push('...');

  return [1, ...range, total];
}

function handlePageClick(e) {
  const btn = e.target.closest('[data-page]');
  if (!btn || btn.disabled) return;

  const newPage = parseInt(btn.dataset.page);
  if (isNaN(newPage) || newPage === state.currentPage) return;

  state.currentPage = newPage;
  loadProducts();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Sorting — single toggle button: Low to High ↔ High to Low
function initSortButton() {
  const sortBtn = document.querySelector('.sort-btn');
  if (!sortBtn) return;

  // Start with price_asc
  state.sort = 'price_desc';
  sortBtn.textContent = 'Price: High to Low';

  sortBtn.addEventListener('click', () => {
    if (state.sort === 'price_desc') {
      state.sort = 'price_asc';
      sortBtn.textContent = 'Price: Low to High';
    } else {
      state.sort = 'price_desc';
      sortBtn.textContent = 'Price: High to Low';
    }
    state.currentPage = 1;
    loadProducts();
  });
}

// Clothing-type chips
function initClothingTypeChips() {
  if (PAGE_FILENAME !== 'browse-all.html') return;

  const chips = document.querySelectorAll('.category-chips .chip');
  if (!chips.length) return;

  // Initial load shows ALL products — remove the default active chip from HTML
  chips.forEach(c => c.classList.remove('active'));
  state.clothingTypeFilter = null;

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      const alreadyActive = chip.classList.contains('active');

      chips.forEach(c => c.classList.remove('active'));

      if (alreadyActive) {
        // Clicking an active chip deselects it → show all
        state.clothingTypeFilter = null;
      } else {
        chip.classList.add('active');
        state.clothingTypeFilter = chip.textContent.trim();
      }

      state.currentPage = 1;
      loadProducts();
    });
  });
}

// ─── Wishlist ───
// localStorage is used as a cache; backend is the source of truth.

function getWishlist() {
  try { return JSON.parse(localStorage.getItem('dtd_wishlist') || '[]'); }
  catch { return []; }
}

function isWishlisted(productId) {
  const list = getWishlist();
  const result = list.includes(productId);
  // Debug: uncomment below to diagnose wishlist ID mismatch
  console.log('[wishlist] checking', productId, '| list:', list, '| match:', result);
  return result;
}

// Sync wishlist from backend into localStorage (called on page load if logged in)
// Normalises IDs: backend may store MongoDB _id or product.id — we always cache product.id
async function syncWishlistFromBackend() {
  try {
    const res = await fetch(`${API_BASE}/api/users/me`, { credentials: 'include' });
    if (!res.ok) return;
    const user = await res.json();
    if (!Array.isArray(user.wishlist) || user.wishlist.length === 0) {
      localStorage.setItem('dtd_wishlist', JSON.stringify([]));
      return;
    }

    // Detect whether IDs are already DTD-style (product.id) or MongoDB _id
    const sampleId = user.wishlist[0];
    const isDTDFormat = typeof sampleId === 'string' && sampleId.startsWith('DTD-');

    if (isDTDFormat) {
      // Already the right format — store directly
      localStorage.setItem('dtd_wishlist', JSON.stringify(user.wishlist));
    } else {
      // IDs are MongoDB _id — resolve each to product.id via API
      const resolved = await Promise.all(
        user.wishlist.map(id =>
          fetch(`${API_BASE}/api/products/${id}`)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
        )
      );
      const dtdIds = resolved
        .filter(p => p && p.id)
        .map(p => p.id);
      localStorage.setItem('dtd_wishlist', JSON.stringify(dtdIds));
    }
  } catch {}
}

// After syncing wishlist, update any already-rendered wishlist buttons on the page
function refreshWishlistUI() {
  if (!grid) return;
  grid.querySelectorAll('.wishlist-btn[data-product-id]').forEach(btn => {
    const productId = btn.dataset.productId;
    const wishlisted = isWishlisted(productId);
    btn.classList.toggle('wishlisted', wishlisted);
    btn.setAttribute('aria-pressed', wishlisted);
    btn.setAttribute('aria-label', wishlisted ? 'Remove from wishlist' : 'Add to wishlist');
    btn.setAttribute('title', wishlisted ? 'Remove from wishlist' : 'Add to wishlist');
  });
}

// Toggle wishlist item — updates backend + localStorage
async function handleWishlistClick(e) {
  const btn = e.target.closest('.wishlist-btn');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  const productId = btn.dataset.productId;
  if (!productId) return;

  // Check login
  const user = (() => { try { return JSON.parse(localStorage.getItem('dtd_user') || '{}'); } catch { return {}; } })();
  if (!user.firstName) {
    window.location.href = 'login.html';
    return;
  }

  const nowLiked = !isWishlisted(productId);

  // Optimistic UI update
  btn.classList.toggle('wishlisted', nowLiked);
  btn.setAttribute('aria-pressed', nowLiked);
  btn.setAttribute('aria-label', nowLiked ? 'Remove from wishlist' : 'Add to wishlist');
  btn.setAttribute('title', nowLiked ? 'Remove from wishlist' : 'Add to wishlist');

  // Update localStorage cache
  const list = getWishlist();
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
}

// Utility
function escapeHTML(str) {
  return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
}

// Init
document.addEventListener('DOMContentLoaded', async () => {
  initClothingTypeChips();
  initSortButton();

  // Event delegation for wishlist: binds once, works for all dynamically rendered cards
  if (grid) {
    grid.addEventListener('click', handleWishlistClick);
  }

  // Sync wishlist FIRST, then render products so isWishlisted() reads fresh data
  await syncWishlistFromBackend();
  await loadProducts();

  // After products are rendered, do a second-pass UI refresh in case
  // the sync and render raced (e.g. slow network for /api/users/me)
  refreshWishlistUI();
});