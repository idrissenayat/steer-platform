# Intent

Make STEER's real native sign-in interface reusable outside its test harness.
Keep the renderer isolated from browser credentials and preserve the identity
service as the only authority for login, callback, tools and logout. Do not
activate provider access, load real secrets or change signed architecture.

