# ShortsCraft transactional email setup

Email delivery is not active in the inspected production environment.
The owner must complete account creation and handle credentials privately.

1. Create/sign in to [Resend](https://resend.com/signup).
2. In Domains, add `mail.shortscraft.online`. At the domain's DNS provider,
   add only the exact verification records supplied by Resend. Do not replace
   the website's existing A/CNAME records or root-domain mailbox MX records.
   Wait for the domain status to become Verified.
3. Create a Sending access API key restricted to that verified domain.
   Never paste the key into chat, source code, screenshots or logs.
4. In the existing Render service's Environment page, privately add
   `RESEND_API_KEY` and set
   `AUTH_FROM_EMAIL=ShortsCraft <noreply@mail.shortscraft.online>`.
   Preserve all other variables. Confirm the public site URL is
   `https://shortscraft.online`. Saving environment changes can redeploy.
5. Verify an actual password-reset email arrives, its link uses the live domain,
   expires correctly and cannot be replayed. Do not treat configured flags as
   proof of successful inbox delivery.
6. Leave `REFERRALS_ENABLED=false` until the referral migration, privileges and
   delivery checks are complete. Then use a controlled journey to confirm the
   verified invitee's first qualifying successful export grants exactly
   10 credits to each account, only once. Do not enable money features.

Official references checked on 8 October 2026:
[verified domains](https://resend.com/docs/dashboard/domains/introduction),
[API key security and restrictions](https://resend.com/docs/dashboard/api-keys/introduction).
No Resend account, DNS change or API key was created by this checklist.
