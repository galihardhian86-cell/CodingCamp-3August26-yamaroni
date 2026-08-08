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
