// Offline correction candidate only. The frozen R5 package is imported, never rewritten.
// No production route imports this module and no gate or destructive action is performed.
import { readFileSync } from 'node:fs';
import { inspectPrivacyPhoneText, privacyPhonePolicy, privacyPhoneTextLimit } from '../../packages/domain/src/privacy-phone.ts';
import { privacyGraphDecision } from '../0001/reviews/domain/round-3/remediation/semantic-oracles.candidate.mjs';
import { exactKeys, jcs, parseCanonical, sha256, zeroEffects } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';

const policyBytes = jcs({
  version: 'steer-r5-005-correction/v1', finding: 'PREFLIGHT-R3-R5-005', phonePolicy: privacyPhonePolicy,
  implementationDigest: sha256(readFileSync(new URL('../../packages/domain/src/privacy-phone.ts', import.meta.url))),
  unicodeDataSha256: '2e1efc1dcb59c575eedf5ccae60f95229f706ee6d031835247d843c11d96470c',
  textLimit: privacyPhoneTextLimit, candidateLimit: 128, candidateTextBudget: 262144,
  decoding: 'literal, one URI decode, canonical base64 tokens in either; strict UTF-8',
  priorGraph: 'unchanged round-3 R5 graph; all original checks required',
});
export const correctionPolicyBytes = policyBytes;
export const correctionPolicyDigest = sha256(policyBytes);
const reject = (firstError) => ({ decision: 'REJECT', firstError, effects: zeroEffects() });
const decoder = new TextDecoder('utf-8', { fatal: true });

function inspectPrompt(text) {
  const texts = new Set([text]); let budget = text.length;
  const add = (candidate) => {
    if (texts.has(candidate)) return;
    budget += candidate.length;
    if (texts.size >= 128 || budget > 262144) throw new Error('inspection limit');
    texts.add(candidate);
  };
  if (text.length > privacyPhoneTextLimit) return 'uninspectable';
  try { add(decodeURIComponent(text)); } catch (error) { if (!(error instanceof URIError)) throw error; }
  for (const candidate of [...texts]) {
    for (const token of candidate.split(/\s+/u)) {
      if (!/^[A-Za-z0-9+/]{16,}={0,2}$/.test(token)) continue;
      const bytes = Buffer.from(token, 'base64');
      const canonical = bytes.toString('base64');
      if (token !== canonical && token !== canonical.replace(/=+$/, '')) continue;
      // A plausible encoded token with invalid UTF-8 is uncertain, never clear.
      add(decoder.decode(bytes));
    }
  }
  let outcome = 'clear';
  for (const candidate of texts) {
    const result = inspectPrivacyPhoneText(candidate);
    if (result === 'phone') return 'phone';
    if (result === 'uninspectable') outcome = result;
  }
  return outcome;
}

/** Closed, canonical correction envelope binds the exact additional policy/code.
 * Normalized text is an inspection copy; signed graph/source bytes remain intact. */
export function correctedPrivacyGraphDecision(serialized) {
  try {
    if (typeof serialized !== 'string' || serialized.length > 8388608) return reject('CORRECTION_ENVELOPE_INVALID');
    const envelope = parseCanonical(serialized);
    if (!exactKeys(envelope, ['version', 'policyDigest', 'graphBytes']) || envelope.version !== 'steer-r5-005-correction/v1' ||
        envelope.policyDigest !== correctionPolicyDigest || typeof envelope.graphBytes !== 'string' || envelope.graphBytes.length > 4194304)
      return reject('CORRECTION_ENVELOPE_INVALID');
    const graph = parseCanonical(envelope.graphBytes);
    const base = privacyGraphDecision(envelope.graphBytes);
    if (base.decision !== 'ACCEPT') return reject('BASE_PRIVACY_REJECTED');
    for (const prompt of graph.prompts) {
      const result = inspectPrompt(decoder.decode(Buffer.from(prompt.bytesBase64, 'base64')));
      if (result !== 'clear') return reject(result === 'phone' ? 'UNICODE_PHONE_DETECTED' : 'PHONE_INSPECTION_UNCERTAIN');
    }
    return { ...base, correctionPolicyDigest };
  } catch { return reject('PHONE_INSPECTION_UNCERTAIN'); }
}
