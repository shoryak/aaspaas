# Auth testing notes (Aaspaas)
- Accounts live in `accounts` (id, email, primary_session_id, password_hash, email_verified); device tokens in `account_tokens` (token_hash = sha256("aaspaas-account:"+token)), cookie `aaspaas_account` (httpOnly, secure on https).
- Google: button redirects to https://auth.emergentagent.com/?redirect=<current url>; on return `#session_id=` is exchanged via POST /api/auth/google. Invalid session_id → 400.
- Password: POST /api/auth/register / /api/auth/login {email, password(8+), updates}. Test user pw-user@aaspaas.dev / chai-stall-2026.
- Code: seed a signin_requests row (see memory/test_credentials.md) then POST /api/auth/verify-code.
- Protected: /api/portfolios* require sign-in (401 otherwise).
