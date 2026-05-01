const TAX_RATE = 0.08875;

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateAccountIconLink();

  // Read confirmation data passed from checkout.js via sessionStorage
  const data = getConfirmationData();
  if (!data) {
    // No confirmation data — redirect to browse
    window.location.href = 'browse-all.html';
    return;
  }

  renderConfirmation(data);
});

// ─── Auth helper ──────────────────────────────────────────────────────────────
function updateAccountIconLink() {
  const link = document.getElementById('account-icon-link');
  if (!link) return;
  try {
    const user = JSON.parse(localStorage.getItem('dtd_user') || '{}');
    link.href = user.firstName ? 'account-information.html' : 'login.html';
  } catch { link.href = 'login.html'; }
}

// ─── Read confirmation data from sessionStorage ───────────────────────────────
// checkout.js stores the order result + cart snapshot here before redirecting
function getConfirmationData() {
  try {
    const raw = sessionStorage.getItem('dtd_order_confirmation');
    console.log('confirmation data:', raw);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ─── Render confirmation page ─────────────────────────────────────────────────
function renderConfirmation(data) {
  const { order, cart } = data;
  // order: { orderNumber, orderId, total } — from backend response
  // cart:  the dtd_cart_item snapshot saved before clearing localStorage

  // Order number
  setText('#conf-order-number', `#${order.orderNumber}`);

  // Dates
  const arrivalDate = formatDate(new Date(cart.arrivalDate));
  const returnDate  = formatDate(new Date(cart.returnDate));
  setText('#conf-arrival-date', arrivalDate);
  setText('#conf-return-date',  returnDate);

  // Item image
  const imgEl = document.getElementById('conf-item-img');
  if (imgEl && (cart.imageUrl || cart.imageFilename)) {
    const imgSrc = cart.imageUrl || `${API_BASE}/images/${cart.imageFilename}`;
    imgEl.innerHTML = `
      <img src="${imgSrc}"
           alt="${escapeHTML(cart.name)}"
           loading="lazy"
           onerror="this.style.display='none'"
           style="width:80px;height:107px;object-fit:cover;border-radius:4px;display:block" />
    `;
  }

  // Item details
  setText('#conf-item-name',   cart.name);
  setText('#conf-item-size',   `Size: ${cart.selectedSize}`);
  setText('#conf-item-backup', cart.backupSize ? `Free back up size: ${cart.backupSize}` : '');
  setText('#conf-item-period', `Rental period: ${cart.days} days`);
  setText('#conf-item-price',  `$${cart.rentalPrice.toFixed(2)}`);

  // Totals — recalculate from cart data
  const subtotal    = cart.rentalPrice;
  const deliveryFee = cart.deliveryFee ?? 0;
  const tax         = parseFloat((subtotal * TAX_RATE).toFixed(2));
  const total       = order.total ?? parseFloat((subtotal + deliveryFee + tax).toFixed(2));

  setText('#conf-subtotal', `$${subtotal.toFixed(2)}`);
  setText('#conf-shipping', deliveryFee === 0 ? 'Free' : `$${deliveryFee.toFixed(2)}`);
  setText('#conf-tax',      `$${tax.toFixed(2)}`);
  setText('#conf-total',    `$${total.toFixed(2)}`);
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function setText(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
