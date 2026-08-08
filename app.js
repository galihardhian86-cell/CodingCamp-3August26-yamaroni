// app.js — Expense & Budget Visualizer
// Application logic will be added in subsequent tasks

// --- Validator ---

/**
 * Validate the expense form fields before adding a transaction.
 *
 * @param {string} itemName   - Raw value from the #item-name input
 * @param {string} amountStr  - Raw value from the #amount input
 * @param {string} category   - Raw value from the #category select
 * @returns {{ valid: boolean, errors: { itemName?: string, amount?: string, category?: string } }}
 */
function validate(itemName, amountStr, category) {
  const errors = {};

  // --- Item name validation (Requirements 1.3, 1.4) ---
  if (typeof itemName !== 'string' || itemName.trim().length === 0) {
    errors.itemName = 'Item name is required';
  }

  // --- Amount validation (Requirements 1.3, 1.5) ---
  if (amountStr === '' || amountStr === null || amountStr === undefined) {
    errors.amount = 'Amount is required';
  } else {
    const numericValue = Number(amountStr);
    if (isNaN(numericValue)) {
      errors.amount = 'Amount must be a number';
    } else if (numericValue <= 0) {
      errors.amount = 'Amount must be greater than 0';
    } else if (numericValue > 999999999.99) {
      errors.amount = 'Amount must not exceed 999,999,999.99';
    }
  }

  // --- Category validation (Requirements 1.3, 1.6) ---
  if (typeof category !== 'string' || category.trim().length === 0) {
    errors.category = 'Please select a category';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

// =============================================================================
// === DATA MODEL & STATE ===
// =============================================================================

/**
 * @typedef {Object} Transaction
 * @property {string}  id        - UUID v4 generated via crypto.randomUUID()
 * @property {string}  itemName  - User-provided name (1–100 chars, trimmed)
 * @property {number}  amount    - Positive float, 0.01 to 999999999.99
 * @property {string}  category  - One of: "Food" | "Transport" | "Fun"
 * @property {number}  timestamp - Date.now() at time of creation (used for sort order)
 */

/**
 * Central application state — single source of truth.
 * All mutations must be followed by a render() call.
 * Requirements: 1.2, 4.1
 */
const state = {
  /** @type {Transaction[]} */
  transactions: [],
};

/**
 * Colour mapping for each spending category, used by Chart.js.
 * Requirements: 4.1
 */
const CHART_COLORS = {
  Food:      '#FF6384',
  Transport: '#36A2EB',
  Fun:       '#FFCE56',
};

// =============================================================================
// === HELPER FUNCTIONS ===
// =============================================================================

/**
 * Format a numeric value as a two-decimal-place string using the
 * round-half-up rule (multiply by 100, Math.round, divide, toFixed).
 *
 * @param {number} value - The raw numeric value to format
 * @returns {string}       e.g. "12.50", "0.00", "999999999.99"
 *
 * Requirements: 3.5
 */
function formatAmount(value) {
  return (Math.round(value * 100) / 100).toFixed(2);
}

/**
 * Derive per-category totals from the current state.
 * Returns a plain object mapping each category present in state.transactions
 * to the sum of its transaction amounts.
 * Only categories that appear at least once are included (no zero entries).
 *
 * @returns {{ [category: string]: number }}  e.g. { Food: 50, Transport: 20, Fun: 30 }
 *
 * Requirements: 4.1, 4.4
 */
function getCategoryTotals() {
  return state.transactions.reduce((acc, tx) => {
    acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
    return acc;
  }, {});
}

// =============================================================================
// === STORAGE MODULE ===
// =============================================================================

/**
 * Shape-guard for transaction objects loaded from localStorage.
 * Returns true only when every required field is present with the correct type
 * and meets the minimum value constraints. Malformed entries are discarded
 * silently by the caller so partial corruption never wipes clean data.
 *
 * Checks:
 *  - non-null object
 *  - id         : non-empty string
 *  - itemName   : non-empty string after trim
 *  - amount     : number >= 0.01
 *  - category   : one of "Food" | "Transport" | "Fun"
 *  - timestamp  : number
 *
 * @param {*} obj - The candidate value to validate
 * @returns {boolean}
 *
 * Requirements: 5.3, 5.5
 */
function isValidTransaction(obj) {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    typeof obj.id === 'string' && obj.id.length > 0 &&
    typeof obj.itemName === 'string' && obj.itemName.trim().length > 0 &&
    typeof obj.amount === 'number' && obj.amount >= 0.01 &&
    ['Food', 'Transport', 'Fun'].includes(obj.category) &&
    typeof obj.timestamp === 'number'
  );
}

/**
 * Persistence helpers for reading and writing the transaction list to
 * localStorage. Both methods are wrapped in try/catch so storage errors
 * (QuotaExceededError, SecurityError in private browsing, corrupt JSON) are
 * surfaced as user-visible banner messages rather than uncaught exceptions.
 */
const storage = {
  /**
   * Persist the full transactions array to localStorage as JSON.
   * On any storage error (e.g. QuotaExceededError when the storage quota is
   * exceeded, or SecurityError in private-browsing mode), shows a user-facing
   * error banner so the user is informed rather than silently losing data.
   *
   * @param {Transaction[]} transactions - The current in-memory transaction list
   * @returns {void}
   *
   * Requirements: 5.1, 5.2
   */
  save(transactions) {
    try {
      localStorage.setItem('expense_transactions', JSON.stringify(transactions));
    } catch (err) {
      // QuotaExceededError or SecurityError in private browsing
      showError('Could not save your data. Storage may be full or unavailable.');
      throw err; // re-throw so callers (e.g. deleteTransaction) can roll back
    }
  },

  /**
   * Load and validate the transaction list from localStorage.
   * - Returns [] when the key is absent (first visit or storage cleared).
   * - Returns [] and shows an error banner when the stored value cannot be
   *   parsed as JSON (completely corrupt data).
   * - Filters each parsed entry through isValidTransaction, silently
   *   discarding any malformed objects so partial corruption does not
   *   wipe the rest of the list.
   *
   * @returns {Transaction[]} - A (possibly empty) array of valid transactions
   *
   * Requirements: 5.3, 5.4, 5.5
   */
  load() {
    try {
      const raw = localStorage.getItem('expense_transactions');
      if (raw === null) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isValidTransaction);
    } catch (err) {
      showError('Saved data could not be loaded. Starting with an empty list.');
      return [];
    }
  },
};

// =============================================================================
// === CHART MODULE ===
// =============================================================================

/** @type {import('chart.js').Chart|null} */
let pieChart = null;

/**
 * Initialise the Chart.js pie chart on the #expense-chart canvas.
 * Must be called once after DOMContentLoaded, before the first render().
 * Assigns the Chart instance to the module-level `pieChart` variable.
 *
 * Requirements: 4.1, 4.4, 4.5
 */
function initChart() {
  const canvas = document.getElementById('expense-chart');
  pieChart = new Chart(canvas, {
    type: 'pie',
    data: {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: [],
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 16,
            boxWidth: 12,
          },
        },
        tooltip: {
          callbacks: {
            label(context) {
              const total = context.dataset.data.reduce((s, v) => s + v, 0);
              const pct   = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : '0.0';
              return `${context.label}: $${formatAmount(context.parsed)} (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

/**
 * Push the latest category totals into the existing Chart.js pie chart instance
 * and trigger an instant (no-animation) re-render.
 *
 * Only categories with a total > 0 are included so the chart never shows
 * zero-value slices. Hides the canvas and shows #chart-empty when there are
 * no transactions; reverses that when transactions exist.
 *
 * Called at the end of every render() cycle.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.5, 4.7
 */
function updateChart() {
  const totals = getCategoryTotals();
  // Only include categories with a positive total (no zero-value slices)
  const entries = Object.entries(totals).filter(([, v]) => v > 0);
  const labels  = entries.map(([cat]) => cat);
  const data    = entries.map(([, v]) => v);
  const colors  = labels.map(cat => CHART_COLORS[cat]);

  pieChart.data.labels                        = labels;
  pieChart.data.datasets[0].data             = data;
  pieChart.data.datasets[0].backgroundColor  = colors;
  pieChart.update('none'); // instant re-render, no animation

  // Toggle chart visibility
  const isEmpty = state.transactions.length === 0;
  document.getElementById('expense-chart').hidden = isEmpty;
  document.getElementById('chart-empty').hidden   = !isEmpty;
}

// =============================================================================
// === RENDER MODULE ===
// =============================================================================

/**
 * Convenience helper — creates a <span> with a CSS class and text content.
 * Used by renderTransactionItem() to avoid repetition.
 *
 * @param {string} className - CSS class name for the span
 * @param {string} text      - Text content (set via textContent, never innerHTML)
 * @returns {HTMLSpanElement}
 */
function createSpan(className, text) {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  return span;
}

/**
 * Single render pass — synchronises the entire DOM with the current state.
 * Called after every state mutation and once on initial page load.
 *
 * Steps:
 *  1. Update #balance-value with the formatted total
 *  2. Rebuild #transaction-list (newest-first by timestamp)
 *  3. Update the Chart.js pie chart via updateChart()
 *  4. Toggle #empty-state and #chart-empty visibility
 *
 * Requirements: 2.1, 2.3, 2.6, 3.1, 3.2, 3.3, 3.4, 4.2, 4.3, 4.5
 */
function render() {
  // 1. Update balance display
  const total = state.transactions.reduce((sum, tx) => sum + tx.amount, 0);
  document.getElementById('balance-value').textContent = '$' + formatAmount(total);

  // 2. Rebuild transaction list (newest-first)
  const list = document.getElementById('transaction-list');
  list.innerHTML = '';
  const sorted = [...state.transactions].sort((a, b) => b.timestamp - a.timestamp);
  sorted.forEach(tx => list.appendChild(renderTransactionItem(tx)));

  // 3. Update the pie chart
  updateChart();

  // 4. Toggle empty states
  const isEmpty = state.transactions.length === 0;
  document.getElementById('empty-state').hidden = !isEmpty;
}

/**
 * Build a single <li> element for a transaction.
 * Uses createElement + textContent throughout — never innerHTML on user content.
 * This prevents XSS from user-supplied item names.
 *
 * Structure:
 *   <li class="transaction-item" data-id="{tx.id}">
 *     <span class="tx-name">{truncated name}</span>
 *     <span class="tx-category">{category}</span>
 *     <span class="tx-amount">${amount}</span>
 *     <button class="delete-btn" aria-label="Delete {name}">×</button>
 *   </li>
 *
 * - Item names longer than 50 characters are truncated with '…' for display.
 *   The full name is still used for the aria-label.
 * - The delete button wires a click listener to deleteTransaction(tx.id).
 *
 * @param {Transaction} tx - The transaction to render
 * @returns {HTMLLIElement}
 *
 * Requirements: 2.1, 2.4, 6.2
 */
function renderTransactionItem(tx) {
  const li = document.createElement('li');
  li.className = 'transaction-item';
  li.dataset.id = tx.id;

  // Truncate display name to 50 chars (full name kept for aria-label)
  const displayName = tx.itemName.length > 50
    ? tx.itemName.slice(0, 50) + '…'
    : tx.itemName;

  li.appendChild(createSpan('tx-name',     displayName));
  li.appendChild(createSpan('tx-category', tx.category));
  li.appendChild(createSpan('tx-amount',   '$' + formatAmount(tx.amount)));

  const btn = document.createElement('button');
  btn.className  = 'delete-btn';
  btn.type       = 'button'; // prevent accidental form submit
  btn.setAttribute('aria-label', 'Delete ' + tx.itemName);
  btn.textContent = '×';
  btn.addEventListener('click', () => deleteTransaction(tx.id));
  li.appendChild(btn);

  return li;
}

// =============================================================================
// === ERROR BANNER MODULE ===
// =============================================================================

/**
 * Module-level reference to the auto-dismiss timeout so it can be
 * cancelled when the user clicks the banner manually.
 * @type {ReturnType<typeof setTimeout>|null}
 */
let errorTimeout = null;

/**
 * Show a user-facing error message in the #app-error banner.
 *
 * Behaviour:
 * - Sets the banner's textContent to the message and removes the `hidden`
 *   attribute so it becomes visible.
 * - Clears any pending auto-dismiss timeout from a previous call.
 * - Schedules auto-dismiss after 5 000 ms.
 * - Attaches a one-time click listener so the user can dismiss early.
 *
 * @param {string} message - The human-readable error message to display
 * @returns {void}
 *
 * Requirements: 2.5, 5.4
 */
function showError(message) {
  const banner = document.getElementById('app-error');
  if (!banner) return; // guard: called before DOM is ready (e.g. during storage load on first visit)

  // Clear any pending dismiss timeout
  if (errorTimeout !== null) {
    clearTimeout(errorTimeout);
    errorTimeout = null;
  }

  banner.textContent = message;
  banner.removeAttribute('hidden');

  // Auto-dismiss after 5 seconds
  errorTimeout = setTimeout(() => {
    banner.setAttribute('hidden', '');
    banner.textContent = '';
    errorTimeout = null;
  }, 5000);
}

/**
 * Attach a click handler on the #app-error banner to allow immediate dismissal.
 * Registered once after DOMContentLoaded (see App Initialisation).
 * Defined here to keep all error-banner logic in one place.
 */
function initErrorBanner() {
  const banner = document.getElementById('app-error');
  if (!banner) return;
  banner.addEventListener('click', () => {
    if (errorTimeout !== null) {
      clearTimeout(errorTimeout);
      errorTimeout = null;
    }
    banner.setAttribute('hidden', '');
    banner.textContent = '';
  });
}

// =============================================================================
// === EVENTS MODULE ===
// =============================================================================

/**
 * Remove a transaction by id using an optimistic-update pattern with rollback.
 *
 * Steps:
 *  1. Snapshot the current transactions array
 *  2. Optimistically remove the entry and re-render immediately (fast UI)
 *  3. Attempt to persist the new state to localStorage
 *  4. On storage failure: restore the snapshot, re-render (item reappears),
 *     and show an error banner so the user knows what happened
 *
 * @param {string} id - The id of the transaction to remove
 * @returns {void}
 *
 * Requirements: 2.4, 2.5
 */
function deleteTransaction(id) {
  // 1. Save snapshot before mutation
  const snapshot = [...state.transactions];

  // 2. Optimistic update — remove the entry and re-render immediately
  state.transactions = state.transactions.filter(tx => tx.id !== id);
  render();

  // 3. Persist the updated state
  try {
    storage.save(state.transactions);
  } catch (err) {
    // 4. Rollback on storage failure
    state.transactions = snapshot;
    render();
    showError('Could not delete the transaction. Please try again.');
  }
}

/**
 * Clear all inline validation error messages before a new submit attempt.
 * Prevents stale messages from a previous failed submission remaining visible.
 */
function clearErrors() {
  document.getElementById('item-name-error').textContent = '';
  document.getElementById('amount-error').textContent    = '';
  document.getElementById('category-error').textContent  = '';
}

/**
 * Handle #expense-form submit: validate, build a Transaction, push to state,
 * persist, and re-render. Populates inline error messages on validation failure.
 *
 * @param {Event} event - The form submit event
 * @returns {void}
 *
 * Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7
 */
function addTransaction(event) {
  event.preventDefault();

  // Clear previous inline errors before re-validating
  clearErrors();

  const itemName   = document.getElementById('item-name').value;
  const amountStr  = document.getElementById('amount').value;
  const category   = document.getElementById('category').value;

  const { valid, errors } = validate(itemName, amountStr, category);

  if (!valid) {
    // Populate inline error spans for each failing field
    if (errors.itemName) document.getElementById('item-name-error').textContent = errors.itemName;
    if (errors.amount)   document.getElementById('amount-error').textContent    = errors.amount;
    if (errors.category) document.getElementById('category-error').textContent  = errors.category;
    return;
  }

  // Build and store the new transaction
  const tx = {
    id:        crypto.randomUUID(),
    itemName:  itemName.trim(),
    amount:    parseFloat(amountStr),
    category,
    timestamp: Date.now(),
  };

  state.transactions.push(tx);
  storage.save(state.transactions);
  render();

  // Reset the form so it's ready for the next entry
  event.target.reset();
}

// =============================================================================
// === APP INITIALISATION ===
// =============================================================================

/**
 * Bootstrap the application once the DOM is fully parsed.
 *
 * Steps:
 *  1. Load persisted transactions from localStorage and filter out any
 *     malformed entries via `isValidTransaction` (defensive double-filter
 *     in addition to the one inside `storage.load()`).
 *  2. Assign the clean array to `state.transactions`.
 *  3. Initialise the Chart.js instance via `initChart()` — must happen before
 *     the first `render()` call so the `pieChart` reference is available.
 *  4. Call `render()` to paint the initial DOM state.
 *  5. Wire the form submit handler so `addTransaction` is called on every
 *     subsequent submission.
 *
 * Requirements: 5.3, 5.4, 5.5
 */
// Bootstrap the application only in a real browser environment
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function () {
    initErrorBanner();

    // Load persisted transactions, filtering out any malformed entries
    var loaded = storage.load();
    state.transactions = loaded.filter(isValidTransaction);

    // Initialise chart first, then render the initial state
    initChart();
    render();

    // Wire up form submission
    document.getElementById('expense-form').addEventListener('submit', addTransaction);
  });
}

// Export for Node.js testing environments without breaking browser execution
if (typeof module !== 'undefined') module.exports = { validate, formatAmount, isValidTransaction, storage, getCategoryTotals, state };
