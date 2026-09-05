# Encrypted secret-provider contract

Expose SecretProvider.read(reference) and SecretKeyUnwrapper.unwrap(input).
A reference contains strict name/revision identifiers and a lowercase SHA-256
digest of the exact encrypted envelope bytes. The configured scope is trusted
composition data, never a request-selected organization or path.

The POSIX encrypted-file binding accepts an explicit canonical absolute directory
owned by the current UID with mode 0700. Pin its device/inode and recheck identity,
mode and canonical path around reads. Open only name.revision.json with read-only,
no-follow and nonblocking flags. Require a current-UID regular file, one hardlink,
mode 0400 or 0600 and at most 64 KiB; check size/time metadata around a bounded
read. Reject symlinks, traversal, root replacement and digest mismatch before
calling the key provider. Never scan directories, discover keys, write, chmod,
delete, log or cache user secrets. Limit reads to four actual in-flight operations;
no queue or cosmetic timeout that hides pending unwrap work.

An envelope contains version steer-encrypted-secret/v1, scope, name, revision,
keyId, wrappedKey, nonce, tag and ciphertext. Strictly validate canonical base64,
96-bit nonce, 128-bit tag, opaque wrapped key at most 8 KiB and ciphertext at most
32 KiB. The key-provider context is purpose/scope/name/revision. It returns a
fresh 32-byte data key. AES-256-GCM additional authenticated data is the ordered
JSON array of version, scope, name, revision, keyId and wrappedKey. Authenticate
before releasing plaintext; wipe the transferred data key and intermediate
plaintext buffers on success/failure. Errors contain no path, bundle or provider
exception details.

The unwrap interface can bind to an approved KMS/Vault operation over its opaque
wrapped-key blob, but no real provider, local master-key file or credentials are
configured by this increment. Such a binding must enforce key/context policy,
service identity and actual network/cancellation budgets. Filesystem and key
provider work have bounded admission, not a universal OS deadline. Same-UID/root
compromise, ACL policy and distributed filesystems are not certified here.

Add startLocalIdentityFromSecretProvider to the API composition root. It accepts
the existing strict local profile, pinned reference and explicit provider.
The decoded UTF-8 JSON bundle is at most 32 KiB, versioned
steer-local-identity-secrets/v1, with existing identity/TLS secrets and 1–4
canonical base64-encoded 32-byte session keys. Reject extra/malformed data.
Start the existing local runtime, then clear transferred plaintext/key input
buffers in finally. Runtime cryptographic adapters own required key copies.
This is best-effort buffer hygiene, not guaranteed erasure of JavaScript strings,
native crypto memory or live runtime-owned keys.

Keep filesystem/path builtins confined to the exact adapter file; no new package
version, API filesystem import or default CLI/real provider activation. Verify
encrypted reads, tampering, file protections, cleanup/concurrency and real local
TLS/Postgres login-transaction encryption after temporary input buffers are wiped.

