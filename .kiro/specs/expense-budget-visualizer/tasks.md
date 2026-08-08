# Implementation Plan: Expense and Budget Visualizer

## Overview

Implement a fully client-side expense tracker as three files (`index.html`, `style.css`, `app.js`) with no build step. Chart.js is loaded via CDN. The implementation follows a unidirectional data flow: user action → state mutation → `render()` → DOM + Chart.js update, with localStorage sync on every mutation.

## Tasks

- [x] 1. Scaffold project files and HTML skeleton
  - Create `index.html` with full document structure: `<meta charset>`, `<meta name="viewport">`, `<title>`, `<link>` to `style.css`, CDN `<script>` for Chart.js (jsDelivr), `<script src="app.js" defer>`
  - Add all semantic landmark elements: `<div id="app-error" role="alert" aria-live="assertive">`, `<div id="balance-display">`, `<form id="expense-form">`, `<ul id="transaction-list">`, `<p id="empty-state">`, `<div class="chart-container">` with `<canvas id="expense-chart">` and `<p id="chart-empty">`
  - Include all form fields exactly as specified in the design: `#item-name`, `#amount`, `#category` select with Food/Transport/Fun options, submit button, and their associated `<span class="error-msg">` elements with `aria-live="polite"`
  - Create empty `style.css` and empty `app.js` as sibling files
  - _Requirements: 1.1, 6.1, 6.2_

- [x] 2. Implement base styles and responsive layout
  - [x] 2.1 Write mobile-first base CSS
    - Apply `box-sizing: border-box` globally
    - Style `.app-container` as a vertical flex column with `gap: 1.5rem`, `padding: 1rem`, `max-width: 1200px`, centred with `margin: 0 auto`
    - Style `.main-content` as a vertical flex column for mobile stacking
    - Set `max-width: 100%` on `canvas`, `input`, `select`, `button`
    - _Requirements: 6.1, 6.6_

  - [x] 2.2 Add desktop breakpoint and transaction list scroll
    - Add `@media (min-width: 768px)` rule that sets `.main-content` to `flex-direction: row; align-items: flex-start` with `.form-panel` and `.chart-panel` each taking `flex: 1`
    - Style `#transaction-list` with `max-height: 320px; overflow-y: auto; overflow-x: hidden`
    - Add visible focus indicators (`:focus-visible` outline) for all interactive elements to satisfy keyboard accessibility
    - _Requirements: 6.1, 6.2, 6.6_

- [x] 3. Implement the Balance Display component styles
  - Style `#balance-display` prominently at the top: large `font-size` for `#balance-value`, clear label text for `.label`
  - Style the `#app-error` banner: fixed or sticky position, warning background colour, `display: none` by default, shown when non-empty
  - _Requirements: 3.1, 3.4_

- [x] 4. Style the Input Form and Transaction List
  - Style `.field-group` using CSS Grid or Flexbox for label/input/error-message stacking
  - Style `.error-msg` in red with `font-size: smaller`; hidden when empty
  - Style `button[type="submit"]` with sufficient tap target size (min 44×44px)
  - Style `.transaction-item` as a flex row showing name, category, amount, and delete button
  - Style `.delete-btn` with accessible tap target and hover/focus states
  - Style `.empty-state` and `.chart-empty` as centred, muted-colour informational text
  - _Requirements: 1.1, 2.1, 2.2, 2.6, 6.2_

- [x] 5. Implement the Validator module in `app.js`
  - [x] 5.1 Write the `validate(itemName, amountStr, category)` function
    - Return `{ valid: boolean, errors: { itemName?, amount?, category? } }`
    - `itemName` error: empty string or whitespace-only → "Item name is required"
    - `amount` error: empty, non-numeric, `<= 0`, or `> 999999999.99` → appropriate message
    - `category` error: empty string / no selection → "Please select a category"
    - _Requirements: 1.3, 1.4, 1.5, 1.6_

  - [~] 5.2 Write property test for `validate()` — whitespace-only names always rejected
    - **Property 2: Whitespace-only item names are always rejected**
    - **Validates: Requirements 1.4**
    - Test that any string of only whitespace characters returns `valid: false` with an `itemName` error

  - [-] 5.3 Write property test for `validate()` — valid inputs pass
    - **Property 3: Valid inputs always produce a new transaction (validator side)**
    - **Validates: Requirements 1.2, 1.3**
    - Test that any trimmed non-empty name (1–100 chars), amount in [0.01, 999999999.99], valid category → `valid: true`

- [x] 6. Implement the data model, state object, and helper functions in `app.js`
  - [x] 6.1 Define the `state` object, `Transaction` JSDoc typedef, and `CHART_COLORS` constant
    - `state = { transactions: [] }`
    - JSDoc `@typedef` for Transaction with fields: `id` (string), `itemName` (string), `amount` (number), `category` (string), `timestamp` (number)
    - `CHART_COLORS = { Food: '#FF6384', Transport: '#36A2EB', Fun: '#FFCE56' }`
    - _Requirements: 1.2, 4.1_

  - [x] 6.2 Implement `formatAmount(value)` and `getCategoryTotals()` pure helpers
    - `formatAmount`: round-half-up via `(Math.round(value * 100) / 100).toFixed(2)`
    - `getCategoryTotals`: reduce `state.transactions` into `{ category: total }` map
    - _Requirements: 3.5, 4.1, 4.4_

  - [~] 6.3 Write property test for `formatAmount()` — round-half-up rule
    - **Property 1: Balance equals sum of all transaction amounts (formatAmount correctness)**
    - **Validates: Requirements 3.1, 3.5**
    - Test that `formatAmount` produces the round-half-up result at the 0.005 boundary

- [ ] 7. Implement the Storage module in `app.js`
  - [x] 7.1 Write `isValidTransaction(obj)` shape-guard function
    - Check: non-null object, `id` is non-empty string, `itemName` is non-empty string after trim, `amount` is number ≥ 0.01, `category` is one of Food/Transport/Fun, `timestamp` is number
    - _Requirements: 5.3, 5.5_

  - [-] 7.2 Write `storage.save(transactions)` with try/catch
    - `localStorage.setItem('expense_transactions', JSON.stringify(transactions))`
    - On `QuotaExceededError` or any error: call `showError('Could not save your data. Storage may be full or unavailable.')`
    - _Requirements: 5.1, 5.2_

  - [~] 7.3 Write `storage.load()` with try/catch and shape validation
    - Return `[]` when key is absent
    - `JSON.parse` the raw string; on parse failure call `showError(...)` and return `[]`
    - Filter parsed array through `isValidTransaction`; silently discard malformed entries
    - _Requirements: 5.3, 5.4, 5.5_

  - [~] 7.4 Write property test for localStorage round-trip
    - **Property 7: localStorage round-trip preserves all transaction fields**
    - **Validates: Requirements 5.3, 5.5**
    - Test that any array of valid transactions saved via `storage.save` and loaded via `storage.load` is identical in fields and order

- [~] 8. Implement app initialisation (DOMContentLoaded)
  - Wire a `DOMContentLoaded` listener that calls `storage.load()`, filters results through `isValidTransaction`, assigns to `state.transactions`, then calls `render()` and `initChart()`
  - If `storage.load()` returns a non-empty array after filtering, do not show the error banner
  - _Requirements: 5.3, 5.4, 5.5_

- [~] 9. Checkpoint — open `index.html` in a browser and verify scaffolding
  - Ensure all HTML elements are present, CSS loads without errors, Chart.js CDN script loads, and `app.js` executes without console errors.
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement `initChart()` and Chart.js integration
  - [~] 10.1 Write `initChart()` to create the Chart.js pie chart instance
    - Call `new Chart(canvas, { type: 'pie', data: { labels: [], datasets: [{ data: [], backgroundColor: [] }] }, options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { ... } } } })`
    - Assign the instance to a module-level `pieChart` variable
    - _Requirements: 4.1, 4.4, 4.5_

  - [~] 10.2 Write `updateChart()` called inside `render()`
    - Compute `getCategoryTotals()`, derive `labels`, `data`, `colors` arrays from entries with `total > 0`
    - Set `pieChart.data.labels`, `pieChart.data.datasets[0].data`, `pieChart.data.datasets[0].backgroundColor`
    - Call `pieChart.update('none')` for instant re-render (no animation)
    - Toggle `#expense-chart` hidden and `#chart-empty` hidden based on `state.transactions.length === 0`
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.7_

  - [~] 10.3 Write property test for chart proportionality
    - **Property 8: Chart percentages are proportional and sum to 100%**
    - **Validates: Requirements 4.1, 4.4, 4.7**
    - Test that for any non-empty transaction list, `getCategoryTotals()` produces values proportional to the grand total within floating-point tolerance

- [ ] 11. Implement the `render()` function
  - [ ] 11.1 Write the `render()` function body
    - Update `#balance-value` textContent with `'$' + formatAmount(total)` where `total` is `state.transactions.reduce((s, tx) => s + tx.amount, 0)`
    - Clear `#transaction-list` with `list.innerHTML = ''`, then sort a copy of `state.transactions` by `timestamp` descending and append each item via `renderTransactionItem(tx)`
    - Call `updateChart()`
    - Toggle `#empty-state` hidden based on `state.transactions.length === 0`
    - _Requirements: 2.1, 2.3, 2.6, 3.1, 3.2, 3.3, 3.4, 4.2, 4.3, 4.5_



- [ ] 12. Implement `renderTransactionItem(tx)` and the delete handler
  - [ ] 12.1 Write `renderTransactionItem(tx)` using `createElement` (no `innerHTML` on user content)
    - Truncate `tx.itemName` to 50 chars with `'…'` if longer
    - Build `<li>` with `createSpan('tx-name', name)`, `createSpan('tx-category', ...)`, `createSpan('tx-amount', '$' + formatAmount(tx.amount))`
    - Create `<button class="delete-btn">` with `aria-label="Delete " + tx.itemName` and attach click listener calling `deleteTransaction(tx.id)`
    - _Requirements: 2.1, 2.4, 6.2_

  - [ ] 12.2 Write `deleteTransaction(id)` with optimistic update and snapshot rollback
    - Save `snapshot = [...state.transactions]`
    - Filter `state.transactions` to remove the entry, call `render()`
    - Call `storage.save(state.transactions)` inside try/catch; on failure restore `snapshot`, call `render()`, call `showError('Could not delete the transaction. Please try again.')`
    - _Requirements: 2.4, 2.5_

  - [ ]* 12.3 Write property test for delete correctness
    - **Property 5: Deleting a transaction removes exactly one entry**
    - **Validates: Requirements 2.4**
    - Test that after `deleteTransaction(id)`, `state.transactions` has length n−1 and contains no entry with that id

- [ ] 13. Implement `addTransaction` form submit handler
  - [ ] 13.1 Write the `addTransaction` event handler wired to `#expense-form` submit
    - Call `event.preventDefault()`, then `clearErrors()` to wipe any previous inline error messages
    - Read `#item-name`, `#amount`, `#category` values; call `validate(itemName, amountStr, category)`
    - On invalid: populate each `<span class="error-msg">` with its error message and return
    - On valid: create a Transaction object `{ id: crypto.randomUUID(), itemName: itemName.trim(), amount: parseFloat(amountStr), category, timestamp: Date.now() }`; push to `state.transactions`; call `storage.save(state.transactions)`; call `render()`; reset the form
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ]* 13.2 Write property test for item name trimming
    - **Property 4: Item names are always stored without leading or trailing whitespace**
    - **Validates: Requirements 1.3**
    - Test that any valid submission with surrounding whitespace in the item name stores `itemName.trim()` in state

  - [ ]* 13.3 Write property test for localStorage mirror after add
    - **Property 6: localStorage always mirrors in-memory state after any mutation**
    - **Validates: Requirements 5.1, 5.2**
    - Test that after any add operation, `JSON.parse(localStorage.getItem('expense_transactions'))` is structurally identical to `state.transactions`

- [ ] 14. Implement the `showError` / error banner module
  - Write `showError(message)` that sets `#app-error` textContent to `message`, removes the `hidden` attribute, and starts a 5-second `setTimeout` to re-add `hidden`
  - Attach a click listener on `#app-error` that immediately re-hides the banner and clears the timeout
  - _Requirements: 2.5, 5.4_

- [ ] 15. Implement keyboard accessibility and focus management
  - Verify that `<label>` elements are correctly associated to all form inputs via `for`/`id` pairs (already in HTML scaffold — confirm in code)
  - Ensure the delete button's `aria-label` includes the transaction name (already set in `renderTransactionItem` — verify)
  - Add `:focus-visible` CSS rules for `input`, `select`, `button`, and `a` elements with a visible outline that meets contrast requirements
  - Confirm `<ul id="transaction-list">` has `role="list"` and `aria-label="Expense transactions"`, and `<canvas>` has `role="img"` and `aria-label`
  - _Requirements: 6.2, 6.3_

- [ ] 16. Final integration checkpoint
  - Wire all sections of `app.js` together: confirm `DOMContentLoaded` handler calls `initChart()` before first `render()`, confirm `addTransaction` listener is attached to `#expense-form`, confirm all functions are in scope
  - Manually verify the smoke-test checklist from the design's Tier 1 tests:
    1. Add one transaction per category; confirm balance, list, and chart update
    2. Refresh the page; confirm transactions reload
    3. Delete a transaction; confirm balance and chart update immediately
    4. Resize below 768px; confirm single-column layout with no overflow
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP. They represent property-based and unit tests that require adding a test framework (e.g., fast-check + Jest or Vitest) not present in the base project.
- The design's Testing Strategy (Tier 1) smoke tests are embedded in the checkpoint tasks and can be run manually in a browser without any tooling.
- Each task references specific requirements for traceability.
- Checkpoints (tasks 9 and 16) ensure incremental validation before moving to the next phase.
- All DOM construction for user content MUST use `createElement` + `textContent`, never `innerHTML`, to prevent XSS.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "6.1"] },
    { "id": 1, "tasks": ["2.2", "3", "4", "5.1", "6.2", "7.1"] },
    { "id": 2, "tasks": ["5.2", "5.3", "6.3", "7.2", "7.3"] },
    { "id": 3, "tasks": ["7.4", "8", "10.1"] },
    { "id": 4, "tasks": ["10.2", "11.1", "14", "15"] },
    { "id": 5, "tasks": ["10.3", "11.2", "12.1"] },
    { "id": 6, "tasks": ["12.2", "13.1"] },
    { "id": 7, "tasks": ["12.3", "13.2", "13.3"] }
  ]
}
```
