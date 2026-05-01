const API_BASE = 'http://localhost:3000';

const USE_MOCK = false;

function getMockReturns() {
  const today = new Date();
  const daysFromNow = (n) => new Date(today.getTime() + n * 86400000).toISOString();
  const daysAgo     = (n) => new Date(today.getTime() - n * 86400000).toISOString();

  return [
    {
      _id:           'mock-return-001',
      orderId:       'mock-order-001',
      itemName:      'Alchemy Ruffle Mini Dress',
      imageFilename: 'DTD-0001__AlchemyRuffleMiniDress.png',
      size:          '2',
      rentalStart:   daysAgo(10),
      rentalEnd:     daysFromNow(2),
      returnDueDate: daysFromNow(2),
      status:        'pending',
      shippingLabel: null,
      issue:         null,
    },
    {
      _id:           'mock-return-002',
      orderId:       'mock-order-002',
      itemName:      'Luna Wool Silk Tailored Short',
      imageFilename: 'DTD-0002__LunaWoolSilkTailoredShort.png',
      size:          '0',
      rentalStart:   daysAgo(8),
      rentalEnd:     daysFromNow(7),
      returnDueDate: daysFromNow(7),
      status:        'pending',
      shippingLabel: null,
      issue:         null,
    },
  ];
}

const MOCK_STORAGE_KEY = 'dtd_mock_returns';

function getMockReturnsFromStorage() {
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveMockReturnsToStorage(returns) {
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(returns));
}

function getOrInitMockReturns() {
  const stored = getMockReturnsFromStorage();
  if (stored) return stored;
  const fresh = getMockReturns();
  saveMockReturnsToStorage(fresh);
  return fresh;
}

async function mockFetchReturns() {
  return getOrInitMockReturns();
}

async function mockScheduleShipping(orderId) {
  const returns = getOrInitMockReturns();
  const ret = returns.find(r => r.orderId === orderId);
  if (!ret) throw new Error('Return not found');
  ret.status        = 'scheduled';
  ret.shippingLabel = 'DTD-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  saveMockReturnsToStorage(returns);
  return { shippingLabel: ret.shippingLabel };
}

async function mockReportIssue(returnId, issue) {
  const returns = getOrInitMockReturns();
  const ret = returns.find(r => r._id === returnId);
  if (!ret) throw new Error('Return not found');
  ret.issue = issue;
  saveMockReturnsToStorage(returns);
  return { success: true };
}

document.addEventListener('DOMContentLoaded', () => {
  updateAccountIconLink();
  populateSidebar();
  loadReturns();
});

function updateAccountIconLink() {
  const link = document.getElementById('account-icon-link');
  if (!link) return;
  const user = getUser();
  link.href = user ? 'account-information.html' : 'login.html';
}

function populateSidebar() {
  const user = getUser();
  if (!user) return;
  const nameEl = document.getElementById('sidebar-username');
  if (nameEl && user.firstName) {
    nameEl.textContent = `${user.firstName} ${user.lastName || ''}`.trim();
  }
}

function getUser() {
  try {
    const raw = localStorage.getItem('dtd_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function loadReturns() {
  const list = document.querySelector('.return-list');
  if (!list) return;

  list.innerHTML = `<li class="oh-loading">Loading returns…</li>`;

  try {
    let returns;

    if (USE_MOCK) {
      returns = await mockFetchReturns();
    } else {
      const res = await fetch(`${API_BASE}/api/returns`, {
        credentials: 'include',
      });
      if (res.status === 401) {
        window.location.href = 'login.html';
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      returns = await res.json();
    }

    updateSubtitle(returns.length);
    renderReturns(returns, list);

  } catch (err) {
    console.error('Failed to load returns:', err);
    list.innerHTML = `<li class="oh-error">Could not load returns. Please refresh and try again.</li>`;
  }
}

async function renderReturns(returns, list) {
  if (returns.length === 0) {
    list.innerHTML = `
      <li class="oh-empty">
        <p>No pending returns.</p>
        <a href="browse-all.html">Browse all items</a>
      </li>`;
    return;
  }

  const enriched = await Promise.all(returns.map(async (ret) => {
    try {
      const orderRes = await fetch(`${API_BASE}/api/orders/${ret.orderId}`, { credentials: 'include' });
      if (orderRes.ok) {
        const order = await orderRes.json();
        const productId = order.product?.productId;
        if (productId) {
          const prodRes = await fetch(`${API_BASE}/api/products/${productId}`);
          if (prodRes.ok) {
            const p = await prodRes.json();
            ret.imageUrl = p.imageUrl || null;
            ret.retailPrice = p.retailPrice || null;
          }
        }
      }
    } catch {}
    return ret;
  }));

  list.innerHTML = enriched.map(r => createReturnCardHTML(r)).join('');

  enriched.forEach((ret, i) => {
    const card = list.querySelectorAll('.return-card')[i];
    if (card) initReturnCard(card, ret);
  });
}

function createReturnCardHTML(ret) {
  const daysLeft  = Math.ceil((new Date(ret.returnDueDate) - new Date()) / (1000 * 60 * 60 * 24));
  const isUrgent  = daysLeft <= 3;
  const badgeText = daysLeft < 0
      ? 'Overdue'
      : daysLeft === 0
          ? 'Due today'
          : `Due in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`;
  const badgeClass  = isUrgent ? 'due-badge--urgent' : 'due-badge--ok';
  const imgSrc      = ret.imageUrl || `${API_BASE}/images/${encodeURIComponent(ret.imageFilename || '')}`;
  const rentalStart = formatDate(new Date(ret.rentalStart));
  const rentalEnd   = formatDate(new Date(ret.rentalEnd));
  const isScheduled = ret.status === 'scheduled';
  const checkSVG    = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

  return `
    <li class="return-card${isUrgent ? ' return-card--urgent' : ''}"
        data-return-id="${ret._id}" data-order-id="${ret.orderId}"
        style="display:flex;flex-direction:column;gap:12px;">

      <div class="progress-steps progress-steps--card"
           style="display:flex;align-items:center;width:100%;padding:4px 0 0 0;">
        <div class="step step--done"
             style="display:flex;flex-direction:column;align-items:center;gap:4px;min-width:120px;">
          <span class="step-icon step-icon--done"
                style="width:24px;height:24px;border-radius:50%;background:#5c3d2e;display:flex;align-items:center;justify-content:center;">${checkSVG}</span>
          <span class="step-label" style="font-size:0.75rem;white-space:nowrap;">Selected</span>
        </div>
        <span class="step-connector"
              style="flex:1;height:2px;background:${isScheduled ? '#5c3d2e' : '#ddd'};margin-bottom:18px;"></span>
        <div class="step ${isScheduled ? 'step--done' : ''}"
             style="display:flex;flex-direction:column;align-items:center;gap:4px;min-width:120px;">
          <span class="step-icon ${isScheduled ? 'step-icon--done' : ''}"
                style="width:24px;height:24px;border-radius:50%;${isScheduled ? 'background:#5c3d2e;' : 'background:#eee;border:2px solid #ddd;'}display:flex;align-items:center;justify-content:center;">${isScheduled ? checkSVG : ''}</span>
          <span class="step-label" style="font-size:0.75rem;white-space:nowrap;">Shipping scheduled</span>
        </div>
      </div>

      <div style="display:flex;gap:16px;align-items:flex-start;">
        <div class="return-card__img">
          <img src="${imgSrc}" alt="${escapeHTML(ret.itemName)}" loading="lazy"
               onerror="this.style.display='none'"/>
        </div>
        <div class="return-card__info" style="flex:1;">
          <div class="return-card__top" style="display:flex;flex-direction:column;align-items:flex-start;gap:6px;margin-bottom:6px;">
            <p class="item-name" style="margin:0;">${escapeHTML(ret.itemName)}</p>
            <span class="due-badge ${badgeClass}" style="flex-shrink:0;">${badgeText}</span>
          </div>
          <p class="item-detail">SIZE: ${ret.size}</p>
          <p class="item-detail">Rented: ${rentalStart} – ${rentalEnd}</p>
          ${daysLeft < 0
      ? `<p class="item-detail" style="color:#c0392b;font-weight:600;">Overdue — your account has been charged $${ret.retailPrice || 'the full retail price'} for this item.</p>`
      : `<p class="item-detail" style="color:${isUrgent ? '#c0392b' : '#8b4513'};font-size:0.82rem;">Please return by ${formatDate(new Date(ret.returnDueDate))} — late returns will be charged the full retail price.</p>`
  }
          ${isScheduled ? `
            <div class="return-scheduled-msg">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Shipping scheduled — Label: <strong>${escapeHTML(ret.shippingLabel || '')}</strong>
            </div>` : ''}

          <div class="return-card__actions">
            <button class="btn-outline report-issue-btn" ${ret.issue ? 'disabled' : ''}>
              ${ret.issue ? 'Issue Reported' : 'Report Issues'}
            </button>
            <button class="btn-solid schedule-btn" ${isScheduled ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
              ${isScheduled ? 'Shipping Scheduled' : 'Schedule Shipping'}
            </button>
            <button class="btn-outline purchase-btn"
              style="border-color:#8b4513;color:#8b4513;">
              Keep this item — $${ret.retailPrice ? (ret.retailPrice * 0.6).toFixed(2) : '—'}
            </button>
          </div>

          <div class="report-issue-form" hidden style="display:none;">
            <textarea class="issue-textarea"
              placeholder="Describe the issue (damage, missing item, wrong size, etc.)"
              rows="3"
              style="font-size:0.85rem;font-family:inherit;width:100%;padding:8px;box-sizing:border-box;resize:vertical;border:1px solid #ddd;border-radius:6px;"></textarea>
            <div class="issue-form-actions">
              <button class="btn-outline issue-cancel-btn">Cancel</button>
              <button class="btn-solid issue-submit-btn">Submit</button>
            </div>
          </div>
        </div>
      </div>
    </li>
  `;
}

function initReturnCard(card, ret) {
  const scheduleBtn    = card.querySelector('.schedule-btn');
  const reportBtn      = card.querySelector('.report-issue-btn');
  const issueForm      = card.querySelector('.report-issue-form');
  const issueCancelBtn = card.querySelector('.issue-cancel-btn');
  const issueSubmitBtn = card.querySelector('.issue-submit-btn');
  const purchaseBtn    = card.querySelector('.purchase-btn');

  // ── Schedule Shipping ──
  scheduleBtn?.addEventListener('click', async () => {
    if (scheduleBtn.disabled) return;
    scheduleBtn.disabled    = true;
    scheduleBtn.textContent = 'Scheduling…';

    try {
      let data;
      if (USE_MOCK) {
        data = await mockScheduleShipping(ret.orderId);
      } else {
        const res = await fetch(`${API_BASE}/api/returns/${ret.orderId}/schedule`, {
          method:      'POST',
          credentials: 'include',
        });
        if (res.status === 401) { window.location.href = 'login.html'; return; }
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        data = await res.json();
      }

      scheduleBtn.textContent   = 'Shipping Scheduled';
      scheduleBtn.style.opacity = '0.5';
      scheduleBtn.style.cursor  = 'not-allowed';
      ret.status        = 'scheduled';
      ret.shippingLabel = data.shippingLabel;

      const actionsEl = card.querySelector('.return-card__actions');
      const msg = document.createElement('div');
      msg.className = 'return-scheduled-msg';
      msg.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Shipping scheduled — Label: <strong>${escapeHTML(data.shippingLabel)}</strong>
      `;
      actionsEl.insertAdjacentElement('beforebegin', msg);

      const cardSteps = card.querySelectorAll('.step');
      const svgCheck = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      if (cardSteps[1]) {
        cardSteps[1].classList.add('step--done');
        const icon2 = cardSteps[1].querySelector('.step-icon');
        if (icon2) { icon2.classList.add('step-icon--done'); icon2.innerHTML = svgCheck; icon2.style.background = '#5c3d2e'; icon2.style.border = 'none'; }
        const connector = card.querySelector('.step-connector');
        if (connector) connector.style.background = '#5c3d2e';
      }

    } catch (err) {
      console.error('Schedule failed:', err);
      alert(`Could not schedule shipping: ${err.message}`);
      scheduleBtn.disabled    = false;
      scheduleBtn.textContent = 'Schedule Shipping';
    }
  });

  // ── Report Issues ──
  reportBtn?.addEventListener('click', () => {
    if (ret.issue) return;
    const isOpen = issueForm.style.display === 'block';
    issueForm.style.display = isOpen ? 'none' : 'block';
    issueForm.hidden        = isOpen;
  });

  issueCancelBtn?.addEventListener('click', () => {
    issueForm.hidden        = true;
    issueForm.style.display = 'none';
  });

  // ── Submit Issue ──
  issueSubmitBtn?.addEventListener('click', async () => {
    const textarea = card.querySelector('.issue-textarea');
    const issue    = textarea?.value.trim();
    if (!issue) { textarea?.focus(); return; }

    issueSubmitBtn.disabled    = true;
    issueSubmitBtn.textContent = 'Submitting…';

    try {
      if (USE_MOCK) {
        await mockReportIssue(ret._id, issue);
      } else {
        const res = await fetch(`${API_BASE}/api/returns/${ret._id}/issue`, {
          method:      'PATCH',
          headers:     { 'Content-Type': 'application/json' },
          credentials: 'include',
          body:        JSON.stringify({ issue }),
        });
        if (res.status === 401) { window.location.href = 'login.html'; return; }
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || `HTTP ${res.status}`);
        }
      }

      issueForm.hidden        = true;
      issueForm.style.display = 'none';
      reportBtn.textContent   = 'Issue Reported';
      reportBtn.disabled      = true;
      ret.issue               = issue;

    } catch (err) {
      console.error('Issue report failed:', err);
      alert(`Could not submit issue: ${err.message}`);
      issueSubmitBtn.disabled    = false;
      issueSubmitBtn.textContent = 'Submit';
    }
  });

  // ── Purchase / Keep item ──
  purchaseBtn?.addEventListener('click', async () => {
    const price = ret.retailPrice ? (ret.retailPrice * 0.6).toFixed(2) : null;
    const confirmed = await showPurchaseConfirm(ret.itemName, price);
    if (!confirmed) return;

    purchaseBtn.disabled    = true;
    purchaseBtn.textContent = 'Processing…';

    try {
      const res = await fetch(`${API_BASE}/api/orders/${ret.orderId}/purchase`, {
        method:      'POST',
        credentials: 'include',
      });
      if (res.status === 401) { window.location.href = 'login.html'; return; }
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();

      purchaseBtn.textContent      = '✓ Purchase Confirmed';
      purchaseBtn.style.background = '#5c3d2e';
      purchaseBtn.style.color      = '#fff';
      purchaseBtn.style.border     = 'none';

      card.querySelector('.schedule-btn')?.remove();
      card.querySelector('.report-issue-btn')?.remove();

      const actionsEl = card.querySelector('.return-card__actions');
      const msg = document.createElement('p');
      msg.style.cssText = 'font-size:0.85rem;color:#5c3d2e;margin-top:8px;';
      msg.textContent = `Purchase confirmed at $${data.purchasePrice}. No return needed — enjoy your item!`;
      actionsEl.insertAdjacentElement('afterend', msg);

    } catch (err) {
      console.error('Purchase failed:', err);
      alert(`Could not complete purchase: ${err.message}`);
      purchaseBtn.disabled    = false;
      purchaseBtn.textContent = `Keep this item — $${price ?? '—'}`;
    }
  });
}

function updateProgressStep(step) {
  const steps = document.querySelectorAll('.progress-steps .step');
  steps.forEach((el, i) => {
    const isDone = i < step;
    el.classList.toggle('step--done', isDone);
    const icon = el.querySelector('.step-icon');
    if (!icon) return;
    if (isDone) {
      icon.classList.add('step-icon--done');
      icon.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>`;
    } else {
      icon.classList.remove('step-icon--done');
      icon.innerHTML = '';
    }
  });
}

function updateSubtitle(count) {
  const el = document.querySelector('.returns-subtitle');
  if (el) {
    el.textContent = count === 0
        ? 'No pending returns'
        : `${count} item${count === 1 ? '' : 's'} pending return`;
  }
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
function showPurchaseConfirm(itemName, price) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position:fixed;inset:0;z-index:1000;
      background:rgba(52,29,22,0.45);
      display:flex;align-items:center;justify-content:center;
      padding:20px;
    `;
    modal.innerHTML = `
      <div style="
        background:#fffdf7;border-radius:12px;
        padding:36px 32px;max-width:420px;width:100%;
        box-shadow:0 20px 60px rgba(52,29,22,0.18);
        font-family:inherit;
      ">
        <p style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#d4b59a;margin-bottom:8px;">Keep This Item</p>
        <h3 style="font-size:20px;font-weight:700;color:#341d16;margin-bottom:12px;">${escapeHTML(itemName)}</h3>
        <p style="font-size:13.5px;font-weight:300;color:#341d16;line-height:1.6;margin-bottom:24px;">
          Purchase this item for <strong>$${price ?? '—'}</strong> (60% off retail price).<br/>
          Your return will be cancelled and the item is yours to keep.
        </p>
        <div style="display:flex;gap:12px;justify-content:flex-end;">
          <button id="purchase-cancel-btn" style="
            padding:10px 24px;border:1.5px solid #d4b59a;border-radius:20px;
            background:transparent;color:#341d16;font-family:inherit;
            font-size:13px;cursor:pointer;
          ">Cancel</button>
          <button id="purchase-confirm-btn" style="
            padding:10px 24px;border:1.5px solid #341d16;border-radius:20px;
            background:#341d16;color:#fffdf7;font-family:inherit;
            font-size:13px;cursor:pointer;
          ">Confirm Purchase</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#purchase-confirm-btn').addEventListener('click', () => {
      document.body.removeChild(modal);
      resolve(true);
    });
    modal.querySelector('#purchase-cancel-btn').addEventListener('click', () => {
      document.body.removeChild(modal);
      resolve(false);
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
        resolve(false);
      }
    });
  });
}