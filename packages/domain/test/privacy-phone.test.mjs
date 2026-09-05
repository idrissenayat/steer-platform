import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectPrivacyPhoneText as inspect, normalizePrivacyPhoneText as normalize, privacyPhoneTextLimit } from '../src/privacy-phone.ts';

test('every Unicode 17 decimal digit maps to its decimal value, including supplementary planes', () => {
  assert.equal(process.versions.unicode, '17.0', 'Reverify pinned Unicode data before changing runtime evidence.');
  let count = 0;
  for (let point = 0; point <= 0x10ffff; point++) {
    const character = String.fromCodePoint(point);
    if (!/\p{Nd}/u.test(character)) continue;
    assert.equal(normalize(character), String(count % 10), `U+${point.toString(16)}`); count++;
  }
  assert.equal(count, 770);
  assert.equal(normalize('日本語 unchanged'), '日本語 unchanged');
});

test('R5 Arabic-Indic examples and other scripts retain ASCII phone length and embedding boundaries', () => {
  for (const zero of [0x30, 0x660, 0x6f0, 0x966, 0x9e6, 0xe50, 0x104a0, 0x116da, 0x1d7ce]) {
    const script = (text) => text.replace(/\d/g, (digit) => String.fromCodePoint(zero + Number(digit)));
    for (const prefix of ['+', '00']) {
      for (const length of [6, 7, 15, 16]) {
        const number = script(prefix + '4'.repeat(length));
        assert.equal(inspect(number), length === 7 || length === 15 ? 'phone' : 'clear');
        assert.equal(inspect(`x${number}`), 'clear'); assert.equal(inspect(`${number}字`), 'clear');
      }
      assert.equal(inspect(script(`${prefix}44 20 7946 0958`)), 'phone');
    }
  }
  for (const text of ['+٤٤ ٢٠ ٧٩٤٦ ٠٩٥٨', '٠٠٤٤ ٢٠ ٧٩٤٦ ٠٩٥٨', '+४4 ٢0 ७9٤6 ०9٥8', '+٤٤\u200d ٢٠—٧٩٤٦—٠٩٥٨', '(202) 555-0123'])
    assert.equal(inspect(text), 'phone');
});

test('inspection rejects invalid, malformed and oversized input without returning content', () => {
  for (const value of [null, {}, 42, '\ud800', '\udfff', 'x'.repeat(privacyPhoneTextLimit + 1), '\ufdfa'.repeat(privacyPhoneTextLimit)])
    assert.equal(inspect(value), 'uninspectable');
  assert.equal(inspect('x'.repeat(privacyPhoneTextLimit)), 'clear');
  assert.equal(inspect(''), 'clear');
  assert.equal(normalize('＋４４　２０　７９４６　０９５８'), '+44 20 7946 0958');
});
