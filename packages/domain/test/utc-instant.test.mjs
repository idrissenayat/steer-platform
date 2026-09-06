import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseUtcInstant } from '../src/utc-instant.ts';

test('UTC instant parser preserves every fractional digit and equivalent representations', () => {
  const base = parseUtcInstant('2026-09-06T00:00:00Z');
  for (let precision = 1; precision <= 9; precision++) {
    const fraction = '123456789'.slice(0, precision);
    assert.equal(parseUtcInstant(`2026-09-06T00:00:00.${fraction}Z`) - base, BigInt(fraction.padEnd(9, '0')));
  }
  for (const fraction of ['1', '10', '100', '1000', '100000000']) assert.equal(parseUtcInstant(`2026-09-06T00:00:00.${fraction}Z`), base + 100000000n);
  assert.equal(parseUtcInstant('2026-09-06T00:00:00.000000001Z'), base + 1n);
  assert.equal(parseUtcInstant('2026-09-06T00:00:00.000000000Z'), base);
});

test('UTC instant parser validates calendar boundaries, early years and pre-epoch fractions exactly', () => {
  assert.equal(parseUtcInstant('1970-01-01T00:00:00Z'), 0n);
  assert.equal(parseUtcInstant('1969-12-31T23:59:59.999999999Z'), -1n);
  assert.equal(parseUtcInstant('0000-01-01T00:00:00Z'), -62167219200000000000n);
  assert.equal(parseUtcInstant('9999-12-31T23:59:59.999999999Z'), 253402300799999999999n);
  for (const year of ['0000', '0004', '0096', '0400', '2000', '2024']) assert.equal(typeof parseUtcInstant(`${year}-02-29T00:00:00Z`), 'bigint');
  assert.equal(parseUtcInstant('0099-12-31T23:59:59.999999999Z') + 1n, parseUtcInstant('0100-01-01T00:00:00Z'));
  assert.equal(parseUtcInstant('2024-02-29T23:59:59.999999999Z') + 1n, parseUtcInstant('2024-03-01T00:00:00Z'));
});

test('UTC instant parser rejects invalid dates, offsets, excessive precision and non-string inputs', () => {
  for (const input of [null, undefined, 0, 0n, {}, [], '', 'x'.repeat(10000), '2026-09-06T00:00Z',
    '2026-09-06T00:00:00Z\n', '2026-09-06T00:00:00z', '2026-09-06T00:00:00+00:00',
    '2026-09-06T00:00:00-04:00', '2026-09-06T00:00:00.0000000001Z', '2026-09-06T00:00:00.Z',
    '2026-02-29T00:00:00Z', '1900-02-29T00:00:00Z', '0100-02-29T00:00:00Z',
    '2026-04-31T00:00:00Z', '2026-09-06T24:00:00Z', '2026-09-06T00:00:60Z',
    '10000-01-01T00:00:00Z', '+002026-01-01T00:00:00Z', '2026-00-01T00:00:00Z']) assert.equal(parseUtcInstant(input), null, String(input));
});
