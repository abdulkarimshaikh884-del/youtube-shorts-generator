# Google sign-in activation

Implementation is local. No production database migration or deployment has been run.

## Configure

1. Back up production and test the additive `google_sign_in` migration on staging first. Apply `supabase/migrations/20260923091330_google_sign_in.sql` through the normal reviewed migration process. It adds one nullable unique identity column; no account data is removed. Keep the existing users table server-only/RLS restricted. Verify `google_sub` exists and its unique index is valid before enabling OAuth.
2. In Google Auth Platform, configure the consent screen, app name ShortsCraft, support contact, homepage, privacy and terms URLs. Create an OAuth client of type **Web application**. Request only `openid email profile` (no Drive, Gmail or offline access).
3. Add this exact authorized redirect URI: `https://shortscraft.online/api/auth/google/callback`.
4. Add server environment variables `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `PUBLIC_SITE_URL=https://shortscraft.online`. Never commit the secret or paste it into frontend JavaScript/chat.
5. For local testing use a separate client and `PUBLIC_SITE_URL=http://127.0.0.1:3000`, with the matching redirect `http://127.0.0.1:3000/api/auth/google/callback`. Use the same hostname in the browser: localhost and 127.0.0.1 do not share cookies.
6. Restart/deploy only after configuration and staging checks. Review Google's publishing/test-user requirements for the chosen consent-screen status.

## Account rules

- New Google users get an ordinary free account and a unique generated creator handle (editable in Settings). No local password is invented; password reset can set one later.
- Google subject ID, not email, identifies returning Google users. Existing role, plan, projects and credits are preserved.
- An existing password account is **not automatically merged by email**. Log in to that account first (or reset its password), then Settings → Connect Google, choosing the matching email. The sign-in session is bound to the OAuth flow to prevent connecting to the wrong account.
- Only verified Google email claims are accepted. Google sign-in does not grant a public blue tick or admin access.
- Short-lived signed HttpOnly flow cookie, state, PKCE and Google's one-use authorization code protect the callback. Tokens are exchanged on the server and not stored. A second simultaneous sign-in tab invalidates the first flow; retry in one tab.
- Without credentials, buttons explain that Google sign-in is unavailable; password login remains usable. Failed provider/DB calls do not claim success.

## Release checklist (requires real credentials and staging)

- New Google signup → unique handle → reload/logout/login → same account.
- Existing password account collision → no auto-merge; authenticate and connect → same projects/credits, old password still works.
- Cancel, expired flow, wrong state, mismatched email and network/provider failure.
- Test mobile and desktop, both themes; test `next=/editor` return and external redirect rejection.
- Check callback cookie has Secure in production, HttpOnly and SameSite=Lax. Confirm tokens/codes never appear in application logs.
- Verify users-table RLS and grants and the new index on staging; run security advisors before release. Offline mocks do not establish live database or Google integration success.
- Rollback: remove Google environment variables to disable the feature; leave the additive column in place so identities are not lost.

References: https://developers.google.com/identity/protocols/oauth2/web-server and https://developers.google.com/identity/openid-connect/openid-connect
