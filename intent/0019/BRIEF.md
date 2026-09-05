# Intent

Verify browser-controlled behavior that HTTP drivers cannot prove: native form
Origin/Fetch-Metadata, cross-site IdP navigation, secure HttpOnly host-only cookies,
SameSite handling, JavaScript non-accessibility and real logout navigation.

Use a fresh headless Chromium profile and generated test accounts/certificates.
Do not modify the user's normal browsers, system trust, real credentials or
public runtime. Keep the reference pink/orange application UI untouched.
