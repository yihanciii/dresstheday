const RENTAL_MIN_DAYS = 3;
const RENTAL_MAX_DAYS = 30;

// ─── State ───
let calState = {
  arrivalDate: null,   // Date object
  returnDate: null,    // Date object
  selecting: 'arrival', // 'arrival' | 'return'
  viewYear: null,
  viewMonth: null,     // 0-indexed
};

// ─── Build Modal DOM (once) ───
function buildCalendarModal() {
  if (document.getElementById('calendar-modal')) return;

  const modal = document.createElement('div');
  modal.id = 'calendar-modal';
  modal.className = 'calendar-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Select rental dates');
  modal.hidden = true;

  modal.innerHTML = `
    <div class="calendar-backdrop"></div>
    <div class="calendar-dialog">

      <div class="calendar-header">
        <div class="calendar-date-display">
          <div class="cal-date-box" id="cal-arrival-box">
            <span class="cal-date-label">Arrival Date</span>
            <span class="cal-date-value" id="cal-arrival-value">—</span>
          </div>
          <div class="cal-date-sep">→</div>
          <div class="cal-date-box" id="cal-return-box">
            <span class="cal-date-label">Return Date</span>
            <span class="cal-date-value" id="cal-return-value">—</span>
          </div>
        </div>
        <button class="calendar-close-btn" aria-label="Close date picker">✕</button>
      </div>

      <div class="calendar-hint" id="calendar-hint">Select your arrival date</div>

      <div class="calendar-nav">
        <button class="cal-nav-btn" id="cal-prev" aria-label="Previous month">‹</button>
        <span class="cal-month-label" id="cal-month-label"></span>
        <button class="cal-nav-btn" id="cal-next" aria-label="Next month">›</button>
      </div>

      <div class="calendar-grid">
        <div class="cal-day-names">
          <span>Su</span><span>Mo</span><span>Tu</span>
          <span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
        </div>
        <div class="cal-days" id="cal-days"></div>
      </div>

      <div class="calendar-footer">
        <div class="calendar-rental-info" id="calendar-rental-info"></div>
        <div class="calendar-actions">
          <button class="cal-reset-btn" id="cal-reset">Reset</button>
          <button class="cal-confirm-btn" id="cal-confirm" disabled>Confirm Dates</button>
        </div>
      </div>

    </div>
  `;

  document.body.appendChild(modal);
  attachCalendarEvents(modal);
}

// ─── Events ────
function attachCalendarEvents(modal) {
  // Close on backdrop click
  modal.querySelector('.calendar-backdrop').addEventListener('click', closeCalendar);
  modal.querySelector('.calendar-close-btn').addEventListener('click', closeCalendar);

  // Month navigation
  modal.querySelector('#cal-prev').addEventListener('click', () => {
    calState.viewMonth--;
    if (calState.viewMonth < 0) { calState.viewMonth = 11; calState.viewYear--; }
    renderCalendarGrid();
  });
  modal.querySelector('#cal-next').addEventListener('click', () => {
    calState.viewMonth++;
    if (calState.viewMonth > 11) { calState.viewMonth = 0; calState.viewYear++; }
    renderCalendarGrid();
  });

  // Reset
  modal.querySelector('#cal-reset').addEventListener('click', () => {
    calState.arrivalDate = null;
    calState.returnDate  = null;
    calState.selecting   = 'arrival';
    renderCalendarGrid();
    updateCalendarHeader();
  });

  // Confirm
  modal.querySelector('#cal-confirm').addEventListener('click', () => {
    if (calState.arrivalDate && calState.returnDate) {
      applyDatesToButton();
      closeCalendar();
    }
  });

  // Keyboard: close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCalendar();
  });
}

// ─── Open / Close ────
function openCalendar() {
  const modal = document.getElementById('calendar-modal');
  if (!modal) return;

  // Default view: current month
  const today = new Date();
  calState.viewYear  = today.getFullYear();
  calState.viewMonth = today.getMonth();

  renderCalendarGrid();
  updateCalendarHeader();

  modal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeCalendar() {
  const modal = document.getElementById('calendar-modal');
  if (modal) modal.hidden = true;
  document.body.style.overflow = '';
}

// ─── Render calendar grid ───
function renderCalendarGrid() {
  const modal = document.getElementById('calendar-modal');
  if (!modal) return;

  const { viewYear, viewMonth, arrivalDate, returnDate } = calState;

  // Month label
  const monthNames = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];
  modal.querySelector('#cal-month-label').textContent =
    `${monthNames[viewMonth]} ${viewYear}`;

  const today    = startOfDay(new Date());
  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay  = new Date(viewYear, viewMonth + 1, 0);

  // Leading blanks to align with day-of-week
  const startOffset = firstDay.getDay(); // 0=Sun

  const daysEl = modal.querySelector('#cal-days');
  daysEl.innerHTML = '';

  // Blank cells
  for (let i = 0; i < startOffset; i++) {
    const blank = document.createElement('div');
    blank.className = 'cal-cell cal-blank';
    daysEl.appendChild(blank);
  }

  // Day cells
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date     = new Date(viewYear, viewMonth, d);
    const cell     = document.createElement('button');
    cell.className = 'cal-cell';
    cell.textContent = d;
    cell.dataset.date = date.toISOString();

    // Past date
    if (date < today) {
      cell.classList.add('cal-past');
      cell.disabled = true;

    } else {
      // Highlight selected range
      if (arrivalDate && isSameDay(date, arrivalDate)) {
        cell.classList.add('cal-selected', 'cal-range-start');
      }
      if (returnDate && isSameDay(date, returnDate)) {
        cell.classList.add('cal-selected', 'cal-range-end');
      }
      if (arrivalDate && returnDate && date > arrivalDate && date < returnDate) {
        cell.classList.add('cal-in-range');
      }

      // If arrival is set and we're picking return: shade invalid return dates
      if (arrivalDate && !returnDate && calState.selecting === 'return') {
        const diffDays = daysBetween(arrivalDate, date);
        if (diffDays > 0 && diffDays < RENTAL_MIN_DAYS) {
          cell.classList.add('cal-too-short');
          cell.disabled = true;
        }
        if (diffDays > RENTAL_MAX_DAYS) {
          cell.classList.add('cal-too-long');
          cell.disabled = true;
        }
      }

      cell.addEventListener('click', handleDayClick);
    }

    daysEl.appendChild(cell);
  }

  // Rental info line
  updateRentalInfo();
}

// ─── Day click ───
function handleDayClick(e) {
  const date = startOfDay(new Date(e.currentTarget.dataset.date));

  if (calState.selecting === 'arrival') {
    calState.arrivalDate = date;
    calState.returnDate  = null;
    calState.selecting   = 'return';
  } else {
    // Must be after arrival + at least MIN days
    if (date <= calState.arrivalDate) {
      // Clicked before arrival — restart as new arrival
      calState.arrivalDate = date;
      calState.returnDate  = null;
      calState.selecting   = 'return';
    } else {
      const diff = daysBetween(calState.arrivalDate, date);
      if (diff > RENTAL_MAX_DAYS) {
        const maxReturn = new Date(calState.arrivalDate);
        maxReturn.setDate(maxReturn.getDate() + RENTAL_MAX_DAYS);
        calState.returnDate = startOfDay(maxReturn);
      } else {
        calState.returnDate = date;
      }
      calState.selecting = 'done';
    }
  }

  renderCalendarGrid();
  updateCalendarHeader();
}

// ─── Header date display ──────
function updateCalendarHeader() {
  const modal = document.getElementById('calendar-modal');
  if (!modal) return;

  const { arrivalDate, returnDate, selecting } = calState;

  modal.querySelector('#cal-arrival-value').textContent =
    arrivalDate ? formatDate(arrivalDate) : '—';
  modal.querySelector('#cal-return-value').textContent =
    returnDate ? formatDate(returnDate) : '—';

  // Highlight active box
  modal.querySelector('#cal-arrival-box').classList
    .toggle('active', selecting === 'arrival');
  modal.querySelector('#cal-return-box').classList
    .toggle('active', selecting === 'return');

  // Hint text
  const hints = {
    arrival: 'Select your arrival date',
    return:  `Select return date (min ${RENTAL_MIN_DAYS} days, max ${RENTAL_MAX_DAYS} days)`,
    done:    'Dates selected — confirm below',
  };
  modal.querySelector('#calendar-hint').textContent = hints[selecting] || '';

  // Enable/disable confirm button
  modal.querySelector('#cal-confirm').disabled = !(arrivalDate && returnDate);
}

function updateRentalInfo() {
  const modal = document.getElementById('calendar-modal');
  if (!modal) return;

  const el = modal.querySelector('#calendar-rental-info');
  const { arrivalDate, returnDate } = calState;

  if (arrivalDate && returnDate) {
    const days = daysBetween(arrivalDate, returnDate);
    el.textContent = `${days} day rental`;
  } else {
    el.textContent = '';
  }
}

// ─── Apply confirmed dates back to the page button ──────
function applyDatesToButton() {
  const btn = document.querySelector('.date-picker-row');
  if (!btn) return;

  const { arrivalDate, returnDate } = calState;
  const fields = btn.querySelectorAll('.date-field');
  if (fields[0]) fields[0].textContent = formatDate(arrivalDate);
  if (fields[1]) fields[1].textContent = formatDate(returnDate);

  btn.classList.add('dates-selected');
}

// ─── Public API (used by item-detail.js) ───
window.calendarGetSelection = function () {
  const { arrivalDate, returnDate } = calState;
  if (!arrivalDate || !returnDate) return null;
  return {
    arrivalDate,
    returnDate,
    days: daysBetween(arrivalDate, returnDate),
  };
};

// ─── Date utilities ────
function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}

function daysBetween(a, b) {
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Init ────
document.addEventListener('DOMContentLoaded', () => {
  buildCalendarModal();

  // Wire up the date-picker button on product.html
  const datePickerBtn = document.querySelector('.date-picker-row');
  if (datePickerBtn) {
    datePickerBtn.addEventListener('click', openCalendar);
  }
});
