# Design Document

## Expense and Budget Visualizer

---

## Overview

The Expense and Budget Visualizer is a fully client-side single-page application (SPA) built with HTML, CSS, and Vanilla JavaScript. It requires no build step, no backend, and no package manager — the user simply opens the HTML file in a browser.

The app lets users record named expense transactions with a category and amount, view them in a scrollable list, monitor their running total balance, and understand spending distribution through a live Chart.js pie chart. All data survives page refreshes via `localStorage`.

### Key Design Decisions

- **No framework**: Using vanilla JS keeps the footprint small and removes all dependency management. It also fits the stated constraint exactly.
- **Single HTML file vs separate files**: The design targets separate `index.html`, `style.css`, and `app.js` files for maintainability, but works equally well as a single file.
- **Chart.js via CDN**: Loaded from a CDN `<script>` tag (jsDelivr) to avoid any local tooling requirement.
- **Event-driven state updates**: A central `state` object is the single source of truth. Any mutation triggers a `render()` cycle that re-paints the DOM and chart in one pass, ensuring the 100ms update requirement is met (DOM mutations and chart updates are synchronous from the JavaScript event loop's perspective).

---

## Architecture

The application follows a simple **unidirectional data flow** pattern:

```
User Action → State Mutation → render() → DOM + Chart update
                    ↕
              localStorage sync
```

```mermaid
flowchart TD
    U[User Interaction\nform submit / delete click] --> A[Action Handler\naddTransaction / deleteTransaction]
    A --> S[State Object\ntransactions: Transaction[]]
    A --> LS[localStorage.setItem]
    S --> R[render function]
    R --> D[DOM Updates\nbalance, list, empty state]
    R --> C[Chart.js update\npie chart data]
    LS2[localStorage.getItem\non page load] --> S
```

### Module Structure

```
index.html          – markup skeleton, CDN script tags
style.css           – layout, component styles, responsive breakpoints
app.js              – all application logic
  ├── state         – in-memory data store
  ├── storage       – localStorage read/write helpers
  ├── validator     – input validation logic
  ├── chart         – Chart.js initialisation and update
  ├── render        – DOM rendering functions
  └── events        – event listeners (form submit, delete)
```

All modules are plain JavaScript objects/functions defined in `app.js`. There are no ES modules or bundler requirements, though the code is structured in clearly separated logical sections with comments.

---

## Components and Interfaces

### 1. Input Form

**HTML structure:**
```html
<form id="expense-form">
  <div class="field-group">
    <label for="item-name">Item Name</label>
    <input type="text" id="item-name" maxlength="100" autocomplete="off">
    <span class="error-msg" id="item-name-error" aria-live="polite"></span>
  </div>
  <div class="field-group">
    <label for="amount">Amount</label>
    <input type="number" id="amount" step="0.01" min="0.01">
    <span class="error-msg" id="amount-error" aria-live="polite"></span>
  </div>
  <div class="field-group">
    <label for="category">Category</label>
    <select id="category">
      <option value="">-- Select category --</option>
      <option value="Food">Food</option>
      <option value="Transport">Transport</option>
      <option value="Fun">Fun</option>
    </select>
    <span class="error-msg" id="category-error" aria-live="polite"></span>
  </div>
  <button type="submit">Add Expense</button>
</form>
```

**Validator interface:**
```js
// Returns { valid: boolean, errors: { itemName?: string, amount?: string, category?: string } }
function validate(itemName, amountStr, category)
```

### 2. Balance Display

```html
<div id="balance-display">
  <span class="label">Total Spent</span>
  <span id="balance-value">$0.00</span>
</div>
```

Updated synchronously inside `render()` using `toFixed(2)` with round-half-up correction.

### 3. Transaction List

```html
<ul id="transaction-list" role="list" aria-label="Expense transactions">
  <!-- populated by render() -->
</ul>
<p id="empty-state" class="empty-state" hidden>No expenses recorded yet.</p>
```

Each list item rendered by `renderTransactionItem(tx)`:
```html
<li class="transaction-item" data-id="{{tx.id}}">
  <span class="tx-name">{{truncated name}}</span>
  <span class="tx-category">{{category}}</span>
  <span class="tx-amount">${{amount}}</span>
  <button class="delete-btn" aria-label="Delete {{name}}">×</button>
</li>
```

### 4. Pie Chart

```html
<div class="chart-container">
  <canvas id="expense-chart" aria-label="Spending by category pie chart" role="img"></canvas>
  <p id="chart-empty" class="chart-empty" hidden>Add expenses to see chart</p>
</div>
```

Chart.js instance is created once on `DOMContentLoaded` and updated (not recreated) on every render cycle using `chart.data = newData; chart.update('none')` for instant re-renders.

---

## Data Models

### Transaction

```js
/**
 * @typedef {Object} Transaction
 * @property {string}  id        - UUID v4 generated via crypto.randomUUID()
 * @property {string}  itemName  - User-provided name (1–100 chars, trimmed)
 * @property {number}  amount    - Positive float, 0.01 to 999999999.99
 * @property {string}  category  - One of: "Food" | "Transport" | "Fun"
 * @property {number}  timestamp - Date.now() at time of creation (used for sort order)
 */
```

### State Object

```js
const state = {
  /** @type {Transaction[]} */
  transactions: [],
};
```

### localStorage Schema

```
Key:   "expense_transactions"
Value: JSON.stringify(Transaction[])
```

On read, the stored JSON is parsed and each entry is validated for shape integrity (has `id`, `itemName`, `amount`, `category`, `timestamp` with correct types) before being loaded into state. Malformed entries are discarded silently, and if the overall parse fails, the app starts with an empty list and shows the informational fallback message.

### Category Totals (derived, not stored)

```js
// Computed fresh on every render from state.transactions
function getCategoryTotals() {
  return state.transactions.reduce((acc, tx) => {
    acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
    return acc;
  }, {}); // { Food: 50.00, Transport: 20.00, Fun: 30.00 }
}
```

### Chart Configuration

```js
const CHART_COLORS = {
  Food:      '#FF6384',
  Transport: '#36A2EB',
  Fun:       '#FFCE56',
};

// Pie chart data shape passed to Chart.js
{
  labels: ['Food', 'Transport', 'Fun'],   // only categories with > 0 total
  datasets: [{
    data:            [50, 20, 30],
    backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56'],
  }]
}
```

---


## Error Handling

### Storage Errors

`localStorage` operations are wrapped in `try/catch` blocks inside the `storage` module:

```js
const storage = {
  save(transactions) {
    try {
      localStorage.setItem('expense_transactions', JSON.stringify(transactions));
    } catch (err) {
      // QuotaExceededError or SecurityError in private browsing
      showError('Could not save your data. Storage may be full or unavailable.');
    }
  },
  load() {
    try {
      const raw = localStorage.getItem('expense_transactions');
      if (raw === null) return [];
      return JSON.parse(raw);
    } catch (err) {
      showError('Saved data could not be loaded. Starting with an empty list.');
      return [];
    }
  },
};
```

`showError(message)` writes to a dedicated `<div id="app-error" role="alert" aria-live="assertive">` banner at the top of the page. The banner auto-dismisses after 5 seconds or when the user clicks it.

### Failed Delete with State Rollback

Deletion follows an optimistic-update pattern with rollback on storage failure:

```js
function deleteTransaction(id) {
  // 1. Save a snapshot before mutation
  const snapshot = [...state.transactions];

  // 2. Apply optimistic update
  state.transactions = state.transactions.filter(tx => tx.id !== id);
  render();

  // 3. Attempt persistence
  try {
    storage.save(state.transactions);
  } catch (err) {
    // 4. Rollback: restore snapshot and re-render
    state.transactions = snapshot;
    render();
    showError('Could not delete the transaction. Please try again.');
  }
}
```

This ensures the Transaction_List is always consistent with the in-memory state, and on failure the deleted item reappears in its original position (since `snapshot` preserves insertion order).

### Corrupt or Invalid localStorage Data

During `load()`, after `JSON.parse`, each entry is validated against the expected shape before being accepted into state:

```js
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
```

- Entries that fail `isValidTransaction` are silently discarded (partial corruption does not wipe all data).
- If `JSON.parse` itself throws (completely malformed JSON), the error is caught, the app starts empty, and the informational banner is shown per Requirement 5.4.
- Discarded entries are never written back to localStorage, so a subsequent `save()` after any mutation will overwrite the corrupt data with clean state.

### Validation Errors

Inline field errors are cleared on every new submit attempt before re-running the validator, preventing stale messages:

```js
function clearErrors() {
  document.getElementById('item-name-error').textContent = '';
  document.getElementById('amount-error').textContent = '';
  document.getElementById('category-error').textContent = '';
}
```

---

## Rendering Logic

The `render()` function is the single point of truth for DOM synchronisation. It is called after every state mutation and on initial page load.

```
render()
  ├── updateBalance()        – recalculate and display total
  ├── updateTransactionList() – rebuild list DOM from state
  ├── updateChart()          – push new data to Chart.js instance
  └── toggleEmptyStates()    – show/hide empty-state messages
```

### Detailed Flow

```js
function render() {
  // 1. Update balance display
  const total = state.transactions.reduce((sum, tx) => sum + tx.amount, 0);
  document.getElementById('balance-value').textContent = '$' + formatAmount(total);

  // 2. Rebuild transaction list
  const list = document.getElementById('transaction-list');
  list.innerHTML = '';  // clear previous items
  // Render newest-first
  const sorted = [...state.transactions].sort((a, b) => b.timestamp - a.timestamp);
  sorted.forEach(tx => list.appendChild(renderTransactionItem(tx)));

  // 3. Update chart data
  const totals = getCategoryTotals();
  const labels = Object.keys(totals);
  const data   = labels.map(cat => totals[cat]);
  const colors = labels.map(cat => CHART_COLORS[cat]);
  pieChart.data.labels           = labels;
  pieChart.data.datasets[0].data = data;
  pieChart.data.datasets[0].backgroundColor = colors;
  pieChart.update('none');  // 'none' skips animation for instant update

  // 4. Toggle empty states
  const isEmpty = state.transactions.length === 0;
  document.getElementById('empty-state').hidden  = !isEmpty;
  document.getElementById('chart-empty').hidden  = !isEmpty;
  // Hide canvas when empty so Chart.js doesn't render a blank chart ring
  document.getElementById('expense-chart').hidden = isEmpty;
}
```

### `renderTransactionItem(tx)`

Builds a single `<li>` element without using `innerHTML` on user content (prevents XSS):

```js
function renderTransactionItem(tx) {
  const li = document.createElement('li');
  li.className = 'transaction-item';
  li.dataset.id = tx.id;

  const name = tx.itemName.length > 50
    ? tx.itemName.slice(0, 50) + '…'
    : tx.itemName;

  li.appendChild(createSpan('tx-name',     name));
  li.appendChild(createSpan('tx-category', tx.category));
  li.appendChild(createSpan('tx-amount',   '$' + formatAmount(tx.amount)));

  const btn = document.createElement('button');
  btn.className = 'delete-btn';
  btn.setAttribute('aria-label', 'Delete ' + tx.itemName);
  btn.textContent = '×';
  btn.addEventListener('click', () => deleteTransaction(tx.id));
  li.appendChild(btn);

  return li;
}
```

Using `createElement` + `textContent` instead of `innerHTML` ensures user-provided item names cannot inject HTML.

### `formatAmount(value)`

Rounds to 2 decimal places using the round-half-up rule and returns a string:

```js
function formatAmount(value) {
  return (Math.round(value * 100) / 100).toFixed(2);
}
```

---

## Responsive Layout

### Strategy

The layout uses **CSS Flexbox** for the overall page structure and **CSS Grid** for the form fields. A single media query breakpoint at `768px` switches the layout from two-column (side-by-side form + chart) on desktop to single-column (stacked) on mobile.

```
Desktop (≥ 768px)                  Mobile (< 768px)
┌─────────────────────────────┐    ┌──────────────┐
│      Balance Display        │    │   Balance    │
├──────────────┬──────────────┤    ├──────────────┤
│  Input Form  │  Pie Chart   │    │ Input Form   │
├──────────────┴──────────────┤    ├──────────────┤
│      Transaction List       │    │  Pie Chart   │
└─────────────────────────────┘    ├──────────────┤
                                   │  Tx List     │
                                   └──────────────┘
```

### CSS Structure

```css
/* --- Base layout (mobile-first) --- */
.app-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1rem;
  max-width: 1200px;
  margin: 0 auto;
  box-sizing: border-box;
}

.main-content {
  display: flex;
  flex-direction: column;   /* stacked on mobile by default */
  gap: 1.5rem;
}

/* --- Desktop breakpoint --- */
@media (min-width: 768px) {
  .main-content {
    flex-direction: row;    /* side-by-side form + chart */
    align-items: flex-start;
  }

  .form-panel  { flex: 1; }
  .chart-panel { flex: 1; }
}

/* --- Prevent overflow at any width --- */
* {
  box-sizing: border-box;
}

img, canvas, input, select, button {
  max-width: 100%;
}

.transaction-list {
  max-height: 320px;
  overflow-y: auto;
  overflow-x: hidden;  /* never show horizontal scroll */
}
```

### Breakpoints

| Breakpoint | Behaviour |
|---|---|
| `< 768px` | Single-column stack: Balance → Form → Chart → List |
| `≥ 768px` | Two-column: [Form + Chart] side by side, List spans full width below |
| `≥ 1200px` | Max-width cap at 1200px, centred with auto margins |

### Mobile Constraints

- All block elements use `width: 100%` or `max-width: 100%` within their containing flex/grid cell.
- The `<canvas>` element is wrapped in a `div.chart-container` with `width: 100%` and `position: relative` (required by Chart.js for responsive sizing). Chart.js is configured with `responsive: true` and `maintainAspectRatio: true`.
- The `<input type="number">` on iOS can render wider than its container without `width: 100%; box-sizing: border-box`, so both rules are applied globally.
- No fixed pixel widths are used on any layout element; only `max-width` constraints and relative/percentage widths.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Balance equals sum of all transaction amounts

*For any* list of transactions, the value shown in the Balance Display must equal the arithmetic sum of every transaction's `amount` field, formatted to two decimal places using round-half-up.

**Validates: Requirements 3.1, 3.5**

---

### Property 2: Whitespace-only item names are always rejected

*For any* string composed entirely of whitespace characters (spaces, tabs, newlines), the Validator SHALL return `valid: false` with an error on the `itemName` field and SHALL NOT add a transaction to the list.

**Validates: Requirements 1.4**

---

### Property 3: Valid inputs always produce a new transaction

*For any* combination of a trimmed non-empty item name (1–100 characters), a numeric amount in the range [0.01, 999999999.99], and a category from {Food, Transport, Fun}, calling `addTransaction` SHALL result in exactly one new entry in `state.transactions` with the stored `itemName` equal to the trimmed input.

**Validates: Requirements 1.2, 1.3**

---

### Property 4: Item names are always stored without leading or trailing whitespace

*For any* valid transaction submission where the item name has leading or trailing whitespace, the stored `itemName` in `state.transactions` and in localStorage SHALL equal `itemName.trim()` — never the raw unstripped value.

**Validates: Requirements 1.3**

---

### Property 5: Deleting a transaction removes exactly one entry

*For any* list of n transactions (n ≥ 1) and any transaction id in that list, after `deleteTransaction(id)`, `state.transactions` SHALL have length n − 1 and SHALL NOT contain any entry with that id, while all other entries remain unchanged.

**Validates: Requirements 2.4**

---

### Property 6: localStorage always mirrors in-memory state after any mutation

*For any* sequence of add and delete operations, immediately after each operation completes, `JSON.parse(localStorage.getItem('expense_transactions'))` SHALL produce an array that is structurally identical to `state.transactions` (same ids, itemNames, amounts, categories, and timestamps in the same order).

**Validates: Requirements 5.1, 5.2**

---

### Property 7: localStorage round-trip preserves all transaction fields

*For any* list of valid transactions written to localStorage and then read back via `storage.load()`, each restored transaction SHALL have the same `id`, `itemName`, `amount`, `category`, and `timestamp` as the original, and the list SHALL be returned in the same order.

**Validates: Requirements 5.3, 5.5**

---

### Property 8: Chart percentages are proportional and sum to 100%

*For any* non-empty list of transactions, the percentage assigned to each category in the chart SHALL equal `(categoryTotal / grandTotal) × 100` rounded to one decimal place, and the sum of all displayed percentages SHALL equal 100.0 (within ±0.1 floating-point tolerance due to independent rounding of each slice).

**Validates: Requirements 4.1, 4.4, 4.7**

---

## Testing Strategy

Since this project is plain HTML + CSS + Vanilla JS with no build tooling or test framework required, the testing strategy is split into three tiers that can be executed without a test runner:

### Tier 1 — Manual Smoke Tests (run in browser)

Cover the happy path end-to-end:
- Add one transaction of each category; verify balance, list, and chart update.
- Refresh the page; verify transactions reload from localStorage.
- Delete a transaction; verify balance and chart update immediately.
- Resize browser window below 768px; verify single-column stacked layout with no overflow.

### Tier 2 — Unit Tests (optional, plain JS or Jest)

If a test runner is introduced, unit-test the pure helper functions:

| Function | What to test |
|---|---|
| `validate()` | All error branches (empty name, whitespace name, zero amount, negative amount, out-of-range amount, missing category) |
| `formatAmount()` | Round-half-up rounding at 0.005 boundary; zero; large values |
| `getCategoryTotals()` | Correct aggregation; empty list returns `{}`; single category |
| `isValidTransaction()` | Rejects missing fields, wrong types, negative amounts |
| `renderTransactionItem()` | Names > 50 chars are truncated; `data-id` matches tx id |

### Tier 3 — Property-Based Tests (if tooling is added)

If a PBT library such as [fast-check](https://github.com/dubzzz/fast-check) is introduced, implement one test per correctness property above. Each test must:
- Run a minimum of **100 iterations**.
- Be tagged with a comment in the format: `// Feature: expense-budget-visualizer, Property N: <property_text>`

Example skeleton (fast-check + Jest):

```js
// Feature: expense-budget-visualizer, Property 1: Balance equals sum of all transaction amounts
test('balance equals sum of transaction amounts', () => {
  fc.assert(
    fc.property(
      fc.array(validTransactionArb, { minLength: 0, maxLength: 50 }),
      (transactions) => {
        const expected = transactions.reduce((s, tx) => s + tx.amount, 0);
        expect(computeBalance(transactions)).toBeCloseTo(expected, 2);
      }
    ),
    { numRuns: 100 }
  );
});
```
