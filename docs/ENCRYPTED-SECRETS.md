# Encrypted secret-provider loading

The secret-provider seam now has an encrypted local-file binding and a separate
wrapped-data-key interface. This implements the local encrypted-configuration
portion of architecture ADR-15 without changing the selected stack. A live
KMS/Vault binding, service identity and production deployment remain separate.

## Contracts

| Contract | Meaning |
| --- | --- |
| SecretProvider.read(reference) | Return a newly owned plaintext byte buffer for one pinned secret revision |
| Reference | Strict name, revision and SHA-256 of exact encrypted file bytes |
| File binding configuration | Explicit canonical absolute private directory and trusted scope |
| SecretKeyUnwrapper.unwrap | Unwrap an opaque data-key blob using keyId and purpose/scope/name/revision context |
| Returned data key | Fresh 32-byte buffer transferred to the reader, which wipes it after decryption |

The production provider is createEncryptedFileSecretProvider in
packages/adapters/src/secrets/file.ts, exported as @steer/adapters/secrets.
It reads only name.revision.json, never discovers a credential path or writes
files. Directory mode must be 0700 and file mode 0400/0600, both current-UID-owned.
The reader pins and rechecks the root inode/device/canonical path, uses a
no-follow/nonblocking final open, rejects nonregular/multilink files, bounds
reads to 64 KiB and checks file metadata plus the pinned digest before unwrap.

Keep configured secret directories outside the repository and application/public
trees. No existing STEER credential location is opened by default. This adapter
does not repair permissions, perform rotations, revoke keys or delete old files.

## Envelope and unwrap boundary

The strict JSON envelope is version steer-encrypted-secret/v1 and contains
scope, name, revision, keyId, wrappedKey, nonce, tag and ciphertext. Binary fields
use canonical base64. AES-256-GCM uses a 12-byte nonce, 16-byte tag and at most
32 KiB ciphertext. Its AAD is the JSON array:

    [version, scope, name, revision, keyId, wrappedKey]

wrappedKey is an opaque provider-format blob, at most 8 KiB, not the raw data key.
The unwrap call receives keyId, those wrapped bytes, and a context with purpose
steer-encrypted-secret/v1 plus scope/name/revision. An approved KMS/Vault adapter
must enforce allowed key/context and service identity, with bounded real network
and cancellation behavior. No live unwrap provider is implemented or activated
here; tests return a fresh synthetic data-key copy under exact-context assertions.

The reader releases plaintext only after authentication succeeds. It wipes
transferred data-key and intermediate plaintext buffers; it does not cache secret
values. Four actual reads may be in flight, including unwrap. Excess reads deny
without queueing. A stuck filesystem/provider is not disguised as completed work
by a response timeout. That still requires infrastructure-specific supervision.

## Local runtime entry

startLocalIdentityFromSecretProvider(profile, reference, provider, transports?)
is an explicit API composition entry point. It receives the existing
steer-local-identity/v1 public profile and decodes one encrypted-provider result
as strict UTF-8 JSON with version steer-local-identity-secrets/v1:

- identity: existing browser client secret, GitHub PEM, database password and
  sessionKeys, encoded as canonical base64 32-byte values, 1–4 entries.
- tls: supplied local HTTPS key and certificate.

The entry starts the existing local runtime and clears temporary plaintext/key
input buffers afterward, including failures. Existing cryptographic components
own the copies needed during service lifetime. JavaScript strings, native crypto
storage and live runtime keys are not covered by a claim of total memory erasure.

Only encrypted envelope digests and non-secret references belong in the public
profile. Never log bundle bytes, decoded objects, keys or unwrap exceptions.
Rotation is explicit: publish a newly encrypted revision, pin its new digest and
restart under the appropriate authorization; there is no mutable latest fallback.
The caller owns provider lifetime. Default CLI startup and real account access
remain unchanged.

## Verification and limits

Synthetic tests cover encrypted reads, context binding, no cache, data-key
cleanup, unsafe paths/modes/symlinks/hardlinks, root replacement, digest/encoding/
metadata/tag rejection, key-provider failures and four-read admission. An actual
isolated TLS/Postgres runtime creates a login transaction after input cleanup;
a separate expected-key store decrypts/consumes it, proving runtime key copies
are intact. No real credential or KMS is used.

The POSIX binding is tested locally, not certified against ACLs, hostile same-UID/
root actors, network filesystems or Kubernetes secret mounts. Public directory
ancestry and infrastructure policies remain operator responsibilities. Pinned
ciphertext/AAD protects the selected bundle; it is not a general host sandbox.
Evidence: intent/0030/. Full provider binding, supervised production operation
and all applicable gates remain open.

