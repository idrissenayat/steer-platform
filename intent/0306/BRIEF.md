# Canonical record decoding and owned key verification

Connect the owned records reader to canonical production metadata/AAD/payload
codecs and independently authorized key services. Do not copy the test decoder's
field-order lists into production or confuse decrypted records with verified
model authorship, source access, human approval or application activation.

Verify exact byte/metadata/source bindings, independent key purposes and key
revocation through final records readback. Preserve original key buffers and wipe
owned copies. Compare native results with the existing crypto/SDK test oracle.
Keep all live records/model/GitHub gates and the fixed progress denominator.
