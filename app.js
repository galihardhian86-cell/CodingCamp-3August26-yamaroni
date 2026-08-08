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

// Export for Node.js testing environments without breaking browser execution
if (typeof module !== 'undefined') module.exports = { validate, formatAmount, isValidTransaction, storage };

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
document.addEventListener('DOMContentLoaded', () => {
  // Load persisted transactions, filtering out any malformed entries
  const loaded = storage.load();
  state.transactions = loaded.filter(isValidTransaction);

  // Initialise chart first, then render the initial state
  initChart();
  render();

  // Wire up form submission
  document.getElementById('expense-form').addEventListener('submit', addTransaction);
});
