// Feature: expense-budget-visualizer, Property 1: Balance equals sum of all transaction amounts
// Validates: Requirements 3.1, 3.5
//
// Property-based test for formatAmount() — round-half-up rule
// Uses Node.js built-in assert module (no external dependencies required).

'use strict';

const assert = require('assert');
const { formatAmount } = require('../app.js');

let passed = 0;
let failed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`  ✓ ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Property 1 — output is always a string with exactly 2 decimal places
// Generate 500 random positive floats in [0.01, 999999999.99] and verify format
// ---------------------------------------------------------------------------
test('Property 1: result is always a string matching /^\\d+\\.\\d{2}$/ for 500 random inputs', () => {
  const pattern = /^\d+\.\d{2}$/;
  for (let i = 0; i < 500; i++) {
    // Random float in [0.01, 999999999.99]
    const value = 0.01 + Math.random() * (999999999.99 - 0.01);
    const result = formatAmount(value);
    assert.ok(
      typeof result === 'string',
      `Expected string, got ${typeof result} for input ${value}`
    );
    assert.ok(
      pattern.test(result),
      `"${result}" does not match /^\\d+\\.\\d{2}$/ for input ${value}`
    );
  }
});

// ---------------------------------------------------------------------------
// Boundary tests — round-half-up at 0.005
// ---------------------------------------------------------------------------
test('Boundary: formatAmount(1.005) === "1.01" (rounds up at .005)', () => {
  assert.strictEqual(formatAmount(1.005), '1.01');
});

test('Boundary: formatAmount(1.004) === "1.00" (rounds down below .005)', () => {
  assert.strictEqual(formatAmount(1.004), '1.00');
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
test('Edge: formatAmount(0) === "0.00"', () => {
  assert.strictEqual(formatAmount(0), '0.00');
});

test('Edge: formatAmount(0.01) === "0.01" (minimum valid amount)', () => {
  assert.strictEqual(formatAmount(0.01), '0.01');
});

test('Edge: formatAmount(999999999.99) === "999999999.99" (maximum valid amount)', () => {
  assert.strictEqual(formatAmount(999999999.99), '999999999.99');
});

test('Edge: formatAmount(1.005) rounds up (not banker\'s rounding)', () => {
  // Banker's rounding would give "1.00" (round to even); round-half-up gives "1.01"
  const result = formatAmount(1.005);
  assert.strictEqual(result, '1.01', `Expected "1.01" but got "${result}" — check round-half-up vs banker's rounding`);
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('');
console.log(`formatAmount tests: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
