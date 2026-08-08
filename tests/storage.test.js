/**
 * Property test: localStorage round-trip preserves all transaction fields
 *
 * Property 7: Any array of valid transactions saved via storage.save and
 * loaded via storage.load is identical in fields and order.
 *
 * Validates: Requirements 5.3, 5.5
 */

'use strict';

const assert = require('assert');

// --- Mock localStorage (in-memory, no browser required) ---
const localStorageMock = (function () {
  let store = {};
  return {
    getItem:  function (key)        { return store[key] !== undefined ? store[key] : null; },
    setItem:  function (key, value) { store[key] = String(value); },
    clear:    function ()           { store = {}; },
  };
})();
global.localStorage = localStorageMock;

// --- Stub showError so storage errors don't crash the test runner ---
global.showError = (msg) => { /* captured for assertions if needed */ };

// --- Import the modules under test ---
const { isValidTransaction, storage } = require('../app.js');

// =============================================================================
// === Helpers ===
// =============================================================================

/**
 * Generate a single valid transaction.
 * @param {number} i - Unique index used to vary fields across the array.
 * @returns {import('../app.js').Transaction}
 */
function makeTransaction(i) {
  return {
    id:        `id-${i}-${Math.random().toString(36).slice(2)}`,
    itemName:  `Item ${i}`,
    amount:    Math.round((0.01 + Math.random() * 999.98) * 100) / 100,
    category:  ['Food', 'Transport', 'Fun'][i % 3],
    timestamp: Date.now() + i,
  };
}

/**
 * Build an array of 0–20 random valid transactions.
 * @returns {import('../app.js').Transaction[]}
 */
function randomTransactionArray() {
  const size = Math.floor(Math.random() * 21); // 0 to 20 inclusive
  return Array.from({ length: size }, (_, i) => makeTransaction(i));
}

// =============================================================================
// === Property 7: round-trip preserves all transaction fields ===
// =============================================================================

let passed = 0;
let failed = 0;
const ITERATIONS = 100;

for (let run = 0; run < ITERATIONS; run++) {
  // Reset localStorage between runs to avoid cross-contamination.
  localStorageMock.clear();

  const original = randomTransactionArray();

  // Exercise the full round-trip.
  storage.save(original);
  const loaded = storage.load();

  try {
    // 1. Length must be identical.
    assert.strictEqual(
      loaded.length,
      original.length,
      `Run ${run}: length mismatch — expected ${original.length}, got ${loaded.length}`
    );

    // 2. Each entry at index i must have identical fields.
    for (let i = 0; i < original.length; i++) {
      const orig = original[i];
      const load = loaded[i];

      assert.strictEqual(load.id,        orig.id,        `Run ${run}[${i}]: id mismatch`);
      assert.strictEqual(load.itemName,  orig.itemName,  `Run ${run}[${i}]: itemName mismatch`);
      assert.strictEqual(load.amount,    orig.amount,    `Run ${run}[${i}]: amount mismatch`);
      assert.strictEqual(load.category,  orig.category,  `Run ${run}[${i}]: category mismatch`);
      assert.strictEqual(load.timestamp, orig.timestamp, `Run ${run}[${i}]: timestamp mismatch`);

      // 3. Loaded entry must still pass the shape-guard.
      assert.ok(
        isValidTransaction(load),
        `Run ${run}[${i}]: loaded entry fails isValidTransaction`
      );
    }

    passed++;
  } catch (err) {
    failed++;
    console.error(`FAIL  Run ${run} —`, err.message);
    // Surface the counterexample so it's easy to reproduce.
    console.error('      original:', JSON.stringify(original));
    console.error('      loaded  :', JSON.stringify(loaded));
  }
}

// =============================================================================
// === Summary ===
// =============================================================================

console.log(`\nProperty 7: localStorage round-trip preserves all transaction fields`);
console.log(`  Ran ${ITERATIONS} iterations — ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.error(`\nPROPERTY TEST FAILED: ${failed}/${ITERATIONS} runs produced a mismatch`);
  process.exit(1);
} else {
  console.log(`  OK — property holds across all ${ITERATIONS} iterations`);
}
