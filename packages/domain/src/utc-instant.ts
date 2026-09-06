/** Exact UTC ordering for normalized gate facts. No clock, provider or authority.
 * Fractions are padded, never rounded. Offsets and precision above nanoseconds
 * are rejected. Whole-second calendar validation cannot discard a fraction. */
export function parseUtcInstant(value: unknown): bigint | null {
  if (typeof value !== 'string' || value.length < 20 || value.length > 30) return null;
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z$/.exec(value);
  if (!match) return null;
  const milliseconds = Date.parse(`${match[1]}Z`);
  if (!Number.isSafeInteger(milliseconds) || new Date(milliseconds).toISOString() !== `${match[1]}.000Z`) return null;
  return BigInt(milliseconds) * 1000000n + BigInt((match[2] ?? '').padEnd(9, '0'));
}
