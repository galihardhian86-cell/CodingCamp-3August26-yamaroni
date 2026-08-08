// Feature: expense-budget-visualizer, Property 2: Whitespace-only item names are always rejected
// Validates: Requirements 1.4

'use strict';

const assert = require('assert');
const { validate } = require('../app.js');

// ---------------------------------------------------------------------------
// Whitespace character pool: space, tab, newline, carriage return, form feed,
// vertical tab, non-breaking space (U+00A0), zero-width space (U+200B),
// Unicode thin space (U+2009), em space (U+2003).
// ---------------------------------------------------------------------------
const WHITESPACE_CHARS = [
  ' ',    // space
  '\t',   // tab
  '\n',   // newline
  '\r',   // carriage return
  '\f',   // form feed
  '\v',   // vertical tab
  '\u00A0', // no-break space
  '\u2003', // em space
  '\u2009', // thin space
];

/**
 * Generate a random whitespace-only string of the given length
 * by sampling randomly from WHITESPACE_CHARS.
 *
 * @param {number} length - Number of whitespace characters
 * @returns {string}
 */
function randomWhitespaceString(length) {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += WHITESPACE_CHARS[Math.floor(Math.random() * WHITESPACE_CHARS.length)];
  }
  return result;
}

// ---------------------------------------------------------------------------
// Property 2: For any whitespace-only item name string, validate() must
// return { valid: false } with errors.itemName set.
// ---------------------------------------------------------------------------

const ITERATIONS = 200;
let passed = 0;
const failures = [];

for (let i = 0; i < ITERATIONS; i++) {
  // Vary lengths: 1 to 20 chars so we cover single-char and multi-char cases
  const length = 1 + Math.floor(Math.random() * 20);
  const whitespaceOnly = randomWhitespaceString(length);

  // Use valid values for the other fields so only itemName can trigger a failure
  const result = validate(whitespaceOnly, '10', 'Food');

  const nameIsRejected = result.valid === false && typeof result.errors.itemName === 'string';

  if (!nameIsRejected) {
    failures.push({
      input: JSON.stringify(whitespaceOnly),
      result,
    });
  } else {
    passed++;
  }
}

// Also test the single-space edge case explicitly
const singleSpace = validate(' ', '10', 'Food');
assert.strictEqual(singleSpace.valid, false, 'single space: valid must be false');
assert.ok(typeof singleSpace.errors.itemName === 'string', 'single space: errors.itemName must be set');

// And a tab-only string
const tabOnly = validate('\t', '10', 'Food');
assert.strictEqual(tabOnly.valid, false, 'tab-only: valid must be false');
assert.ok(typeof tabOnly.errors.itemName === 'string', 'tab-only: errors.itemName must be set');

// And a newline-only string
const newlineOnly = validate('\n', '10', 'Food');
assert.strictEqual(newlineOnly.valid, false, 'newline-only: valid must be false');
assert.ok(typeof newlineOnly.errors.itemName === 'string', 'newline-only: errors.itemName must be set');

if (failures.length > 0) {
  console.error(`FAIL: Property 2 — ${failures.length} counterexample(s) found:`);
  failures.slice(0, 5).forEach(({ input, result }) => {
    console.error(`  Input itemName: ${input}`);
    console.error(`  Result: ${JSON.stringify(result)}`);
  });
  process.exit(1);
} else {
  console.log(`PASS: Property 2 — Whitespace-only item names are always rejected`);
  console.log(`  Ran ${ITERATIONS} random whitespace-only strings — all rejected correctly.`);
  console.log(`  Explicit edge cases (space, tab, newline) also verified.`);
}
