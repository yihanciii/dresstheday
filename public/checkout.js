const API_BASE = 'http://localhost:3000';
const TAX_RATE = 0.08875;

// ─── Read cart from localStorage ──────────────────────────────────────────────
function getCartItem() {
  try {
    const raw = localStorage.getItem('dtd_cart_item');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ─── Auth check: ask backend if session is alive ──────────────────────────────
// Returns true if logged in, false if not (and redirects to login).
async function requireAuth() {
  try {
    const res = await fetch(`${API_BASE}/api/users/me`, {
      credentials: 'include',
    });

    if (res.status === 401) {
      // Not logged in — save return destination then go to login
      sessionStorage.setItem('dtd_login_return', 'checkout.html');
      window.location.href = 'login.html';
      return false;
    }

    if (!res.ok) throw new Error('Auth check failed');

    // Refresh localStorage display info from session truth
    const user = await res.json();
    localStorage.setItem('dtd_user', JSON.stringify({
      firstName: user.firstName || '',
      lastName:  user.lastName  || '',
      email:     user.email     || '',
      userId:    user.userId    || '',
    }));

    return true;
  } catch (err) {
    console.error('Auth check error:', err);
    // Network error — fall back to localStorage to avoid wrongly kicking out logged-in users
    try {
      const local = JSON.parse(localStorage.getItem('dtd_user') || '{}');
      if (local.firstName) return true;  // assume still logged in
    } catch {}
    sessionStorage.setItem('dtd_login_return', 'checkout.html');
    window.location.href = 'login.html';
    return false;
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const cart = getCartItem();

  if (!cart) {
    showEmptyCart();
    return;
  }

  // ← Auth gate: check session BEFORE rendering anything
  const loggedIn = await requireAuth();
  if (!loggedIn) return;  // requireAuth() already redirected

  renderOrderSummary(cart);
  initDeliveryMethodListener(cart);
  initPaymentInputs();
  initFormSubmit(cart);
});

// ─── 1. Render Order Summary ──────────────────────────────────────────────────
function renderOrderSummary(cart) {
  const imgEl = document.querySelector('.order-item-img');
  if (imgEl) {
    imgEl.innerHTML = `
      <img
        src="${API_BASE}/images/${cart.imageFilename}"
        alt="${escapeHTML(cart.name)}"
        loading="lazy"
        onerror="this.style.display='none'"
      />
    `;
  }

  setText('.order-item-name', cart.name);

  const detailEls  = document.querySelectorAll('.order-item-detail');
  const arrivalStr = formatDate(new Date(cart.arrivalDate));
  const returnStr  = formatDate(new Date(cart.returnDate));

  if (detailEls[0]) detailEls[0].textContent = `Size: ${cart.selectedSize}`;
  if (detailEls[1]) detailEls[1].textContent = cart.backupSize
    ? `Free back up size: ${cart.backupSize}`
    : 'No backup size selected';
  if (detailEls[2]) detailEls[2].textContent = `Rental period: ${cart.days} days`;
  if (detailEls[3]) detailEls[3].textContent = `Arrival: ${arrivalStr} → Return: ${returnStr}`;

  setText('.order-price', `$${cart.rentalPrice.toFixed(2)}`);
  updateTotals(cart.rentalPrice, 0);
}

// ─── 2. Delivery method → update shipping cost ────────────────────────────────
function initDeliveryMethodListener(cart) {
  document.querySelectorAll('input[name="delivery"]').forEach(input => {
    input.addEventListener('change', () => {
      const fee = input.value === 'express' ? 5.99 : 0;
      updateTotals(cart.rentalPrice, fee);
    });
  });
}

function updateTotals(rentalPrice, deliveryFee) {
  const tax   = parseFloat((rentalPrice * TAX_RATE).toFixed(2));
  const total = parseFloat((rentalPrice + deliveryFee + tax).toFixed(2));

  setText('#row-subtotal span:last-child', `$${rentalPrice.toFixed(2)}`);
  setText('#row-shipping span:last-child', deliveryFee === 0 ? 'Free' : `$${deliveryFee.toFixed(2)}`);
  setText('#row-tax span:last-child', `$${tax.toFixed(2)}`);
  setText('.order-total-final span:last-child', `$${total.toFixed(2)}`);
}

// ─── 3. Form submission ───────────────────────────────────────────────────────
function initFormSubmit(cart) {
  const form = document.getElementById('checkout-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('.place-order-btn');
    submitBtn.disabled    = true;
    submitBtn.textContent = 'Placing order…';

    const shippingAddress = {
      firstName: form.first_name.value.trim(),
      lastName:  form.last_name.value.trim(),
      street:    form.street.value.trim(),
      apt:       form.apt?.value.trim() || '',
      city:      form.city.value.trim(),
      state:     form.state.value.trim(),
      zip:       form.zip.value.trim(),
    };

    const deliveryMethod = form.querySelector('input[name="delivery"]:checked')?.value || 'standard';

    // Payment info — never send raw CVV to server in production (use Stripe/tokenization)
    const rawCardNumber = (form.card_number?.value || '').replace(/\s/g, '');
    const cardBrand  = detectCardBrand(rawCardNumber);
    const cardLast4  = rawCardNumber.slice(-4);

    const paymentMethod = {
      cardName:   form.card_name?.value.trim()  || '',
      cardNumber: rawCardNumber,                  // stored encrypted on backend
      cardExpiry: form.card_expiry?.value.trim() || '',
      cardBrand,
      cardLast4,
    };

    // ← No userId in body — backend reads from req.session.userId
    const body = {
      productId:       cart.productId,
      size:            cart.selectedSize,
      backupSize:      cart.backupSize || null,
      arrivalDate:     cart.arrivalDate,
      returnDate:      cart.returnDate,
      shippingAddress,
      deliveryMethod,
      paymentMethod,
    };

    try {
      const res = await fetch(`${API_BASE}/api/orders`, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',   // ← session cookie
        body:        JSON.stringify(body),
      });

      if (res.status === 401) {
        // Session expired between page load and submit — re-auth
        sessionStorage.setItem('dtd_login_return', 'checkout.html');
        window.location.href = 'login.html';
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      localStorage.removeItem('dtd_cart_item');
      showConfirmation(data, cart);

    } catch (err) {
      console.error('Order failed:', err);
      alert(`Something went wrong: ${err.message}\nPlease try again.`);
      submitBtn.disabled    = false;
      submitBtn.textContent = 'Place order';
    }
  });
}

// ─── 4. Confirmation: store data and redirect ─────────────────────────────────
function showConfirmation(data, cart) {
  const deliveryMethod = document.querySelector('input[name="delivery"]:checked')?.value || 'standard';
  const deliveryFee    = deliveryMethod === 'express' ? 5.99 : 0;

  sessionStorage.setItem('dtd_order_confirmation', JSON.stringify({
    order: {
      orderNumber: data.orderNumber,
      orderId:     data.orderId,
      total:       data.total,
    },
    cart: { ...cart, deliveryFee },
  }));

  window.location.href = 'order-confirmation.html';
}

// ─── Empty cart fallback ──────────────────────────────────────────────────────
function showEmptyCart() {
  const main = document.querySelector('main');
  if (!main) return;
  main.innerHTML = `
    <div style="text-align:center;padding:4rem 2rem">
      <p style="font-size:1.2rem;margin-bottom:1rem">Your cart is empty.</p>
      <a href="browse-all.html" style="text-decoration:underline">Browse all items</a>
    </div>
  `;
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

// ─── Payment Inputs: formatting + validation ──────────────────────────────────
function initPaymentInputs() {
  const cardNumberInput = document.getElementById('card-number');
  const cardExpiryInput = document.getElementById('card-expiry');
  const cardCvvInput    = document.getElementById('card-cvv');
  const brandIcon       = document.getElementById('card-brand-icon');

  // Format card number: "1234 5678 9012 3456"
  cardNumberInput?.addEventListener('input', (e) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 16);
    e.target.value = val.replace(/(.{4})/g, '$1 ').trim();
    if (brandIcon) brandIcon.textContent = detectCardBrand(val) === 'Amex' ? '🟦' : '';
  });

  // Format expiry: "MM / YY"
  cardExpiryInput?.addEventListener('input', (e) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (val.length >= 3) {
      e.target.value = val.slice(0, 2) + ' / ' + val.slice(2);
    } else {
      e.target.value = val;
    }
  });

  // CVV: numbers only
  cardCvvInput?.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
  });
}

// Detect card brand from number prefix
function detectCardBrand(number) {
  if (/^4/.test(number))          return 'Visa';
  if (/^5[1-5]/.test(number))     return 'Mastercard';
  if (/^3[47]/.test(number))      return 'Amex';
  if (/^6(?:011|5)/.test(number)) return 'Discover';
  return 'Card';
}
