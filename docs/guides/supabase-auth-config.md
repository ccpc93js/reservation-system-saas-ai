# Supabase Auth Configuration

One-time Supabase dashboard setup so email flows (password reset, invites,
signup confirmation) work reliably in production. These are dashboard
settings, not code — do them once per environment.

Project: `foujdkwmekdrtztvieyl` · Dashboard → Authentication.

## 1. URL Configuration

**Authentication → URL Configuration**

- **Site URL**: `https://hostmagsmart.com`
- **Redirect URLs** (allowlist — one per line):
  ```
  https://hostmagsmart.com/**
  http://localhost:3000/**
  ```
  The `/**` wildcard is required: without it, Supabase falls back to the Site
  URL and links land on `/` instead of the page that requested them.

## 2. Password reset email → use `token_hash` (important)

By default the reset link uses a **PKCE `?code=` token**, which is single-use
AND bound to the browser that requested the reset (it needs a `code_verifier`
stored client-side). That breaks the common case: request on a laptop, open
the link on a phone, or open in a different/incognito window.

Fix: switch the reset email to a **`token_hash`** link, which our
`/reset-password` page verifies with `verifyOtp` — works in any browser, no
verifier needed.

**Authentication → Email Templates → "Reset Password"** — set the link to:

```html
<a href="{{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}&type=recovery">
  Reset your password
</a>
```

(Keep the rest of the template; only the href matters. The locale prefix is
optional — `/reset-password` resolves to the default locale.)

### How the reset flow works after this

1. User clicks "Forgot password" on the login page → `resetPasswordForEmail`
   sends the email with the `token_hash` link.
2. Link opens `https://hostmagsmart.com/reset-password?token_hash=…&type=recovery`.
3. The page calls `supabase.auth.verifyOtp({ token_hash, type: "recovery" })`,
   which establishes a short-lived recovery session.
4. User sets a new password (`updateUser({ password })`); done.

The page also handles, as fallbacks: an existing session (refresh-safe,
never re-consumes a token), a PKCE `?code=` (same-browser), and an old
implicit `#access_token=` hash. It surfaces Supabase's own
`error_description` (e.g. "otp_expired") when a link is stale.

## 3. Team invitations

Invites are sent by our own code via Resend (not Supabase email), so no
template config is needed. The invite link is
`{SITE_URL}/invite/{token}` and the new member sets a password there
(pre-verified account created server-side). `SITE_URL` comes from
`getSiteOrigin()` / `NEXT_PUBLIC_SITE_URL`.

## 4. Signup confirmation

Signup uses `emailRedirectTo: {origin}/auth/callback`, which exchanges the
code and routes to the dashboard or onboarding. Ensure `/auth/callback` is
covered by the redirect allowlist (the `/**` wildcard above covers it).

## Environment variables (Vercel)

- `NEXT_PUBLIC_SITE_URL=https://hostmagsmart.com` — used for absolute links
  in server-sent emails; must match the deployed domain per environment.
- `RESEND_API_KEY`, `EMAIL_FROM` — team-invite emails.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Reset link lands on `/` (landing) | Redirect URL not allowlisted → add `/**`. Our root page also forwards `/?code=` to `/reset-password` as a safety net. |
| "This reset link is invalid or has expired" | Token already used (single-use) or expired → request a fresh reset. Switch to `token_hash` (step 2) to avoid browser-binding. |
| Works on localhost, fails on prod | Prod deploy is behind the code, or `NEXT_PUBLIC_SITE_URL` / redirect allowlist not set for the prod domain. |
| Invite link 404 / wrong host | `NEXT_PUBLIC_SITE_URL` not set for the environment. |
