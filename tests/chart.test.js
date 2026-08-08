// Feature: expense-budget-visualizer, Property 8: Chart percentages are proportional and sum to 100%
// Validates: Requirements 4.1, 4.4, 4.7
'use strict';

// Mock browser globals not available in Node
global.localStorage = { getItem: () => null, setItem: () => {} };
global.showError = () => {};
global.document = null; // prevent DOMContentLoaded from running

const assert = require('assert');
const { getCategoryTotals, state } = require('../app.js');

const CATEGORIES = ['Food', 'Transport', 'Fun'];
const TOLERANCE = 0.1; // ±0.1% tolerance for floating-point rounding

function makeTransaction(i, category, amount) {
  return {
    id: `id-${i}`,
    itemName: `Item ${i}`,
    amount,
    category,
    timestamp: Date.now() + i,
  };
}

let passed = 0;
let failed = 0;

function test(desc, fn) {
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${desc}: ${e.message}`);
    failed++;
  }
}

// Run 100 random iterations
for (let iter = 0; iter < 100; iter++) {
  // Generate 1–20 random transactions across categories
  const count = 1 + Math.floor(Math.random() * 20);
  const transactions = [];
  for (let i = 0; i < count; i++) {
    const cat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    const amount = Math.round((0.01 + Math.random() * 999.98) * 100) / 100;
    transactions.push(makeTransaction(i, cat, amount));
  }

  // Temporarily set state.transactions
  state.transactions = transactions;

  const totals = getCategoryTotals();
  const grandTotal = transactions.reduce((s, tx) => s + tx.amount, 0);
  const categories = Object.keys(totals);

  test(`Iteration ${iter + 1}: percentages sum to ~100% (grandTotal=${grandTotal.toFixed(2)})`, () => {
    const percentageSum = categories.reduce((sum, cat) => {
      return sum + (totals[cat] / grandTotal) * 100;
    }, 0);
    assert.ok(
      Math.abs(percentageSum - 100) <= TOLERANCE,
      `Percentage sum ${percentageSum.toFixed(4)}% deviates from 100% by more than ${TOLERANCE}%`
    );
  });

  test(`Iteration ${iter + 1}: each category total equals sum of its transactions`, () => {
    for (const cat of categories) {
      const expected = transactions
        .filter(tx => tx.category === cat)
        .reduce((s, tx) => s + tx.amount, 0);
      assert.ok(
        Math.abs(totals[cat] - expected) < 0.0001,
        `Category ${cat}: expected ${expected}, got ${totals[cat]}`
      );
    }
  });
}

// Restore state
state.transactions = [];

console.log('');
console.log(`chart proportionality tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
