
const API_BASE = 'http://localhost:3000';




// 2. Newsletter
function initNewsletter() {
  const emailInput  = document.querySelector('.email-input');
  const submitBtn   = document.querySelector('.newsletter-form .submit-btn');
  const consentBox  = document.querySelector('.consent-label input[type="checkbox"]');
  const formSection = document.querySelector('.newsletter-section');

  if (!submitBtn || !emailInput) return;

  submitBtn.addEventListener('click', async () => {
    const email   = emailInput.value.trim();
    const consent = consentBox?.checked ?? false;

    // Validate email
    if (!email || !isValidEmail(email)) {
      showNewsletterError(emailInput, 'Please enter a valid email address.');
      return;
    }

    // Validate consent
    if (!consent) {
      showNewsletterError(null, 'Please agree to the Terms of Service and Privacy Policy.');
      return;
    }

    clearNewsletterError();
    submitBtn.disabled     = true;
    submitBtn.textContent  = 'Submitting…';

    try {
      const res = await fetch(`${API_BASE}/api/newsletter`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      });

      if (!res.ok) {
        const err = await res.json();
        // Already subscribed — show friendly toast instead of error
        if (res.status === 409) {
          emailInput.value = '';
          if (consentBox) consentBox.checked = false;
          showNewsletterToast('You\'re already subscribed — we\'ll keep you posted!');
        } else {
          throw new Error(err.error || `HTTP ${res.status}`);
        }
      } else {
        // Success — show toast popup, then reset the form
        emailInput.value = '';
        if (consentBox) consentBox.checked = false;
        showNewsletterToast('You\'re in! Welcome to Dress the Day.');
      }

      // Reset button in all non-error cases
      submitBtn.disabled    = false;
      submitBtn.textContent = 'Submit';

    } catch (err) {
      console.error('Newsletter signup failed:', err);
      showNewsletterError(null, 'Something went wrong. Please try again.');
      submitBtn.disabled    = false;
      submitBtn.textContent = 'Submit';
    }
  });

  // Clear error on input
  emailInput.addEventListener('input', clearNewsletterError);
}

// Newsletter helpers
function showNewsletterError(inputEl, message) {
  clearNewsletterError();

  if (inputEl) inputEl.classList.add('input-error');

  const section = document.querySelector('.newsletter-section');
  if (!section) return;

  const err = document.createElement('p');
  err.className   = 'newsletter-error';
  err.textContent = message;

  const form = section.querySelector('.newsletter-form');
  if (form) form.insertAdjacentElement('afterend', err);
}

function clearNewsletterError() {
  document.querySelector('.email-input')?.classList.remove('input-error');
  document.querySelector('.newsletter-error')?.remove();
}

function showNewsletterToast(message) {
  // Remove any existing toast/overlay first
  document.querySelector('.newsletter-toast')?.remove();
  document.querySelector('.newsletter-toast-overlay')?.remove();

  // Overlay
  const overlay = document.createElement('div');
  overlay.className = 'newsletter-toast-overlay';
  document.body.appendChild(overlay);

  const toast = document.createElement('div');
  toast.className = 'newsletter-toast';
  toast.innerHTML = `
    <button class="newsletter-toast-close" aria-label="Close">×</button>
    <div class="newsletter-toast-check">✓</div>
    <p class="newsletter-toast-title">You're in!</p>
    <p class="newsletter-toast-msg">${message}</p>
  `;
  document.body.appendChild(toast);

  function dismiss() {
    toast.classList.remove('visible');
    overlay.classList.remove('visible');
    toast.addEventListener('transitionend', () => { toast.remove(); overlay.remove(); }, { once: true });
  }

  toast.querySelector('.newsletter-toast-close').addEventListener('click', dismiss);
  overlay.addEventListener('click', dismiss);

  // Trigger animation on next frame
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.add('visible');
      overlay.classList.add('visible');
    });
  });

  // Auto-hide after 3.5 seconds
  setTimeout(dismiss, 3500);
}


function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNewsletter();
});
