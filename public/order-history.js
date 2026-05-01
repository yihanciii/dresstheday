const API_BASE = '';

// Status → human-readable label + track step index (0-based)
const STATUS_CONFIG = {
  confirmed:         { label: 'Order confirmed',              step: 0 },
  dispatched:        { label: 'Dispatched',                   step: 1 },
  with_you:          { label: 'With you',                     step: 2 },
  return_scheduled:  { label: 'Return scheduled',             step: 2 },
  returned:          { label: 'Returned & completed',         step: 3 },
};

const TRACK_STEPS = [
  'Order confirmed',
  'Garment dry-cleaned & dispatched',
  'With you',
  'Returned & completed',
];

// Boot
document.addEventListener('DOMContentLoaded', () => {
  initFilterTabs();
  loadOrders('all');
});

// 1. Load orders
async function loadOrders(filter) {
  const list = document.querySelector('.oh-list');
  if (!list) return;

  list.innerHTML = `<li class="oh-loading">Loading orders…</li>`;

  const params = new URLSearchParams();
  if (filter === 'active')    params.set('status', 'active');
  if (filter === 'completed') params.set('status', 'completed');

  try {
    const res = await fetch(`${API_BASE}/api/orders?${params}`, {
      credentials: 'include',
    });

    if (res.status === 401) {
      window.location.href = 'account-information.html';
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const orders = await res.json();

    updateOrderCount(orders.length);
    renderOrders(orders, list);

  } catch (err) {
    console.error('Failed to load orders:', err);
    list.innerHTML = `<li class="oh-error">Could not load orders. Please refresh and try again.</li>`;
  }
}

// 2. Render order list
async function renderOrders(orders, list) {
  if (orders.length === 0) {
    list.innerHTML = `
      <li class="oh-empty">
        <p>No orders found.</p>
        <a href="browse-all.html">Browse all items</a>
      </li>`;
    return;
  }

  // Fetch imageUrl for each order via /api/products/:id (same as wishlist.js)
  const enriched = await Promise.all(orders.map(async (order) => {
    const productId = order.product?.productId;
    if (productId) {
      try {
        const res = await fetch(`${API_BASE}/api/products/${productId}`);
        if (res.ok) {
          const p = await res.json();
          order.product.imageUrl = p.imageUrl || null;
        }
      } catch {}
    }
    return order;
  }));

  list.innerHTML = enriched.map(order => createOrderHTML(order)).join('');

  // Attach interactions
  list.querySelectorAll('.oh-order').forEach((el, i) => {
    initOrderItem(el, enriched[i]);
  });
}

// 3. Build order HTML
function createOrderHTML(order) {
  const p           = order.product;
  const imgSrc      = p.imageUrl || `${API_BASE}/images/${encodeURIComponent(p.imageFilename || '')}`;
  const arrivalStr  = formatDate(new Date(order.arrivalDate));
  const returnStr   = formatDate(new Date(order.returnDate));
  const dueBadge    = buildDueBadge(order);
  const isCompleted = order.status === 'returned';

  return `
    <li class="oh-order" data-order-id="${order._id}">
      <div class="oh-summary">
        <div class="oh-summary__img">
          <img src="${imgSrc}" alt="${escapeHTML(p.itemName)}" loading="lazy"
               onerror="this.style.display='none'"/>
        </div>
        <div class="oh-summary__info">
          <p class="item-name">${escapeHTML(p.itemName)}</p>
          <p class="item-detail">SIZE: ${p.size}</p>
          <p class="item-detail">Order: ${order.orderNumber}</p>
          <p class="item-detail">Price: $${order.total.toFixed(2)}</p>
          <p class="item-detail">${arrivalStr} – ${returnStr}</p>
        </div>
        <div class="oh-summary__right">
          ${dueBadge}
          <button class="oh-chevron" aria-label="Toggle order details">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="oh-tabs" role="tablist">
        <button class="oh-subtab oh-subtab--active" role="tab" data-tab="track">Track Order</button>
        ${!isCompleted ? `<button class="oh-subtab" role="tab" data-tab="extend">Extend Rental</button>` : ''}
      </div>

      <div class="oh-panel oh-panel--track">
        ${buildTrackHTML(order)}
      </div>

      ${!isCompleted ? `
      <div class="oh-panel oh-panel--extend" hidden>
        ${buildExtendHTML(order)}
      </div>` : ''}
    </li>
  `;
}

// 4. Due badge
function buildDueBadge(order) {
  if (order.status === 'returned') {
    return `<span class="due-badge due-badge--done">Completed</span>`;
  }
  if (order.status === 'confirmed') {
    return `<span class="due-badge due-badge--ok">Confirmed</span>`;
  }

  const daysLeft = Math.ceil(
    (new Date(order.returnDate) - new Date()) / (1000 * 60 * 60 * 24)
  );

  if (daysLeft < 0)  return `<span class="due-badge due-badge--urgent">Overdue</span>`;
  if (daysLeft <= 3) return `<span class="due-badge due-badge--urgent">Due in ${daysLeft} day${daysLeft === 1 ? '' : 's'}</span>`;
  return `<span class="due-badge due-badge--ok">Due in ${daysLeft} days</span>`;
}

// 5. Track order panel
function buildTrackHTML(order) {
  const currentStep = STATUS_CONFIG[order.status]?.step ?? 0;

  // Build timeline from statusTimeline if available, fallback to static labels
  const timeline = order.statusTimeline || [];

  const steps = TRACK_STEPS.map((label, i) => {
    const isDone    = i < currentStep;
    const isActive  = i === currentStep;
    const isPending = i > currentStep;

    const timelineEntry = timeline[i];
    const timeStr = timelineEntry
      ? formatDateTime(new Date(timelineEntry.timestamp))
      : (isPending ? 'Pending' : '');

    // Override label for active "with you" step
    let displayLabel = label;
    if (isActive && (order.status === 'with_you' || order.status === 'return_scheduled')) {
      displayLabel = `With you — return due ${formatDate(new Date(order.returnDate))}`;
    }

    let iconHTML, stepClass;
    if (isDone) {
      stepClass = 'track-step--done';
      iconHTML  = `<span class="track-icon track-icon--check">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg></span>`;
    } else if (isActive) {
      stepClass = 'track-step--active';
      iconHTML  = `<span class="track-icon track-icon--ring"></span>`;
    } else {
      stepClass = 'track-step--pending';
      iconHTML  = `<span class="track-icon track-icon--empty"></span>`;
    }

    return `
      <li class="track-step ${stepClass}">
        ${iconHTML}
        <div class="track-text">
          <p class="track-label${isActive ? ' track-label--accent' : ''}${isPending ? ' track-label--muted' : ''}">
            ${escapeHTML(displayLabel)}
          </p>
          <p class="track-time${isPending ? ' track-label--muted' : ''}">${timeStr}</p>
        </div>
      </li>`;
  });

  return `<ol class="track-steps">${steps.join('')}</ol>`;
}

// 6. Extend rental panel
function buildExtendHTML(order) {
  if (order.extension?.extended) {
    return `<p class="extend-already">This rental has already been extended.</p>`;
  }

  const returnDate = new Date(order.returnDate);
  const pricePerDay = order.product.pricePerDay;

  const options = [3, 5, 7].map(days => {
    const fee = (pricePerDay * days).toFixed(2);
    return `
      <button class="extend-opt" data-days="${days}" data-fee="${fee}">
        <span class="extend-opt__days">+${days} days</span>
        <span class="extend-opt__price">$${fee}</span>
      </button>`;
  });

  return `
    <div class="extend-row">
      <p class="extend-label">Current Return Date</p>
      <p class="extend-date">${formatDate(returnDate)}</p>
    </div>
    <div class="extend-row">
      <p class="extend-label">Extend By</p>
      <div class="extend-options" role="group">
        ${options.join('')}
      </div>
    </div>
    <div class="extend-summary" hidden>
      <p class="extend-summary__label">Summary</p>
      <div class="extend-summary__row">
        <span class="extend-summary__key">New Return Date</span>
        <span class="extend-summary__val" id="extend-new-date-${order._id}">—</span>
      </div>
      <div class="extend-summary__row">
        <span class="extend-summary__key">Total Extension Fee</span>
        <span class="extend-summary__val" id="extend-fee-${order._id}">—</span>
      </div>
    </div>
    <div class="extend-notice" hidden>
      Extending your rental cancels the scheduled return shipping.
    </div>
    <div class="extend-actions">
      <button class="btn-outline extend-cancel-btn">Cancel</button>
      <button class="btn-solid extend-confirm-btn" disabled>Confirm Extension</button>
    </div>
  `;
}

// 7. Order item interactions
function initOrderItem(el, order) {
  // Chevron expand/collapse
  const chevron = el.querySelector('.oh-chevron');
  chevron?.addEventListener('click', () => {
    el.classList.toggle('oh-order--open');
  });

  // Sub-tabs: Track / Extend
  const subtabs = el.querySelectorAll('.oh-subtab');
  const trackPanel  = el.querySelector('.oh-panel--track');
  const extendPanel = el.querySelector('.oh-panel--extend');

  subtabs.forEach(tab => {
    tab.addEventListener('click', () => {
      subtabs.forEach(t => t.classList.remove('oh-subtab--active'));
      tab.classList.add('oh-subtab--active');

      const which = tab.dataset.tab;
      if (trackPanel)  trackPanel.hidden  = (which !== 'track');
      if (extendPanel) extendPanel.hidden = (which !== 'extend');
    });
  });

  // Extend options
  if (!order.extension?.extended) {
    initExtendOptions(el, order);
  }
}

function initExtendOptions(el, order) {
  const extendPanel = el.querySelector('.oh-panel--extend');
  if (!extendPanel) return;

  const opts        = extendPanel.querySelectorAll('.extend-opt');
  const summary     = extendPanel.querySelector('.extend-summary');
  const notice      = extendPanel.querySelector('.extend-notice');
  const confirmBtn  = extendPanel.querySelector('.extend-confirm-btn');
  const cancelBtn   = extendPanel.querySelector('.extend-cancel-btn');

  const newDateEl = extendPanel.querySelector(`#extend-new-date-${order._id}`);
  const feeEl     = extendPanel.querySelector(`#extend-fee-${order._id}`);

  let selectedDays = null;
  let selectedFee  = null;

  opts.forEach(opt => {
    opt.addEventListener('click', () => {
      opts.forEach(o => o.classList.remove('extend-opt--selected'));
      opt.classList.add('extend-opt--selected');

      selectedDays = parseInt(opt.dataset.days);
      selectedFee  = parseFloat(opt.dataset.fee);

      // Update summary
      const newDate = new Date(order.returnDate);
      newDate.setDate(newDate.getDate() + selectedDays);
      if (newDateEl) newDateEl.textContent = formatDate(newDate);
      if (feeEl)     feeEl.textContent     = `$${selectedFee.toFixed(2)}`;

      if (summary) summary.hidden = false;
      if (notice)  notice.hidden  = false;
      if (confirmBtn) confirmBtn.disabled = false;
    });
  });

  // Cancel — deselect
  cancelBtn?.addEventListener('click', () => {
    opts.forEach(o => o.classList.remove('extend-opt--selected'));
    if (summary)   summary.hidden   = true;
    if (notice)    notice.hidden    = true;
    if (confirmBtn) confirmBtn.disabled = true;
    selectedDays = null;
    selectedFee  = null;
  });

  // Confirm extension
  confirmBtn?.addEventListener('click', async () => {
    if (!selectedDays) return;

    confirmBtn.disabled  = true;
    confirmBtn.textContent = 'Processing…';

    try {
      const res = await fetch(`${API_BASE}/api/orders/${order._id}/extend`, {
        method:      'PATCH',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ extensionDays: selectedDays }),
      });

      if (res.status === 401) {
        window.location.href = 'account-information.html';
        return;
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();

      // Update the due badge and return date in the summary row
      const badge = el.querySelector('.due-badge');
      if (badge) badge.textContent = `Due ${formatDate(new Date(data.newReturnDate))}`;

      // Also update the track panel "With you" step label
      const trackLabels = el.querySelectorAll('.track-label--accent');
      trackLabels.forEach(lbl => {
        if (lbl.textContent.includes('With you')) {
          lbl.textContent = `With you — return due ${formatDate(new Date(data.newReturnDate))}`;
        }
      });

      extendPanel.innerHTML = `
        <p class="extend-already">
          ✓ Rental extended by ${selectedDays} days.
          New return date: <strong>${formatDate(new Date(data.newReturnDate))}</strong>.
          <strong>$${data.extensionFee.toFixed(2)}</strong> has been charged to your original payment method.
        </p>`;

    } catch (err) {
      console.error('Extension failed:', err);
      alert(`Could not extend rental: ${err.message}`);
      confirmBtn.disabled   = false;
      confirmBtn.textContent = 'Confirm Extension';
    }
  });
}

// 8. Filter tabs
function initFilterTabs() {
  const tabs = document.querySelectorAll('.oh-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('oh-tab--active'));
      tab.classList.add('oh-tab--active');

      const label  = tab.textContent.trim().toLowerCase();
      const filter = label === 'all' ? 'all' : label; // 'all' | 'active' | 'completed'
      loadOrders(filter);
    });
  });
}

// 9. Order count
function updateOrderCount(count) {
  const el = document.querySelector('.returns-subtitle');
  if (el) el.textContent = `${count} order${count === 1 ? '' : 's'}`;
}

// Utilities
function formatDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(date) {
  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
