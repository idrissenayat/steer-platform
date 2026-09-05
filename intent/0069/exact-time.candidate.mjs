// Exact UTC instants for offline assurance. No implicit clock or floating-point time.
import { jcs, sha256 } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';

export const timePolicyDigest = sha256(jcs({ version: 'steer-exact-time/v1',
  grammar: 'four-digit UTC year; whole seconds or exactly nine fractional digits; Z only',
  arithmetic: 'signed bigint nanoseconds; half-open intervals; UTC calendar years with leap-day clamp',
  compatibility: 'whole-second inputs retained; no rounding or default clock; not execution authority' }));
const SECOND = 1000000000n, DAY = 86400n * SECOND;
const fail = () => { throw new Error('EXACT_TIME_INVALID'); };
const floorDivide = (a, b) => a / b - (a % b < 0n ? 1n : 0n);

export function exactInstant(value) {
  if (typeof value !== 'string' || (value.length !== 20 && value.length !== 30)) return null;
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{9}))?Z$/.exec(value);
  if (!match) return null;
  const base = `${match[1]}Z`, milliseconds = Date.parse(base);
  if (!Number.isSafeInteger(milliseconds) || new Date(milliseconds).toISOString() !== `${match[1]}.000Z`) return null;
  return BigInt(milliseconds) * 1000000n + BigInt(match[2] ?? '0');
}

export function formatExactInstant(instant) {
  if (typeof instant !== 'bigint') fail();
  // Compare before converting to Number or constructing a Date. The bounded
  // whole seconds are exactly representable; fractional time never uses Number.
  const minimum = -62167219200n * SECOND, maximum = 253402300800n * SECOND;
  if (instant < minimum || instant >= maximum) fail();
  const seconds = floorDivide(instant, SECOND), fraction = instant - seconds * SECOND;
  const base = new Date(Number(seconds * 1000n)).toISOString().slice(0, 19);
  return `${base}${fraction === 0n ? '' : `.${String(fraction).padStart(9, '0')}`}Z`;
}

export function exactRetentionBoundary(triggerAt, duration, parentExpiryAt = null) {
  const trigger = exactInstant(triggerAt), parent = parentExpiryAt === null ? null : exactInstant(parentExpiryAt);
  if (trigger === null || (parentExpiryAt !== null && parent === null) || typeof duration !== 'string' || duration.length > 32) fail();
  if (duration === 'indefinite') { if (parent !== null) fail(); return null; }
  let boundary;
  if (duration === 'immediate') boundary = trigger;
  else {
    const match = /^(?:P([1-9][0-9]*)(D|Y)|PT([1-9][0-9]*)S)$/.exec(duration);
    if (!match) fail();
    const amount = BigInt(match[1] ?? match[3]);
    if (match[2] !== 'Y') boundary = trigger + amount * (match[2] === 'D' ? DAY : SECOND);
    else {
      const seconds = floorDivide(trigger, SECOND), fraction = trigger - seconds * SECOND;
      const date = new Date(Number(seconds * 1000n)), month = date.getUTCMonth(), day = date.getUTCDate();
      const year = BigInt(date.getUTCFullYear()) + amount;
      if (year > 9999n) fail();
      date.setUTCDate(1); date.setUTCFullYear(Number(year));
      const last = new Date(date); last.setUTCMonth(month + 1); last.setUTCDate(0);
      date.setUTCDate(Math.min(day, last.getUTCDate()));
      boundary = BigInt(date.getTime()) * 1000000n + fraction;
    }
  }
  // Reject an unrepresentable class expiry even if an earlier cap is supplied.
  formatExactInstant(boundary);
  if (parent !== null && parent < boundary) boundary = parent;
  return formatExactInstant(boundary);
}
