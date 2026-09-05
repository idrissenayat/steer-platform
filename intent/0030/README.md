# 0030 · Encrypted secret-provider loading

Parent M2. Add a pinned encrypted-file secret provider, portable data-key unwrap
contract and explicit secret-backed local runtime bootstrap. Use synthetic
bundles and isolated services only; no existing credential is read or changed.

This implements a secret-manager seam and encrypted local configuration, not a
live KMS/Vault binding, deployment approval or complete regulated profile.

