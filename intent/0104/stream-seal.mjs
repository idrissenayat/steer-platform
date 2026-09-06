// In-process execution instrumentation only. It never drives rows beyond the consumer.
import { createHash } from 'node:crypto';
export function consumeWithStreamSeal(rows, consume) {
  const source = rows[Symbol.iterator](), hash = createHash('sha256'), rowHash = createHash('sha256');
  hash.update('steer-consumed-stream/v1\0');
  let count = 0, bytes = 0, exhausted = false, closed = false;
  const iterator = {
    [Symbol.iterator]() { return this; },
    next() {
      const result = source.next();
      if (result.done) { exhausted = true; return result; }
      if (typeof result.value !== 'string') throw new Error('STREAM_ROW_NOT_BYTES');
      const size = Buffer.byteLength(result.value, 'utf8');
      if (count + 1 > 32901 || bytes + size > 536887296) throw new Error('STREAM_SEAL_LIMIT');
      const prefix = Buffer.alloc(8); prefix.writeBigUInt64BE(BigInt(size));
      hash.update(prefix); hash.update(result.value, 'utf8'); rowHash.update(result.value, 'utf8'); rowHash.update('\n');
      count++; bytes += size; return result;
    },
    return(value) {
      if (closed) return { done: true, value };
      const result = typeof source.return === 'function' ? source.return(value) : { done: true, value };
      closed = true; return result;
    },
  };
  let result;
  try { result = consume(iterator); } finally { if (!closed) iterator.return(); }
  return { result, stream: { framing: 'domain-separated-u64be-utf8-length', count, bytes, digest: hash.digest('hex'),
    rowsDigest: rowHash.digest('hex'), exhausted, closed } };
}
