# chinadep-watch

Egg.js MVP for connecting a user-authorized account to the China Digital Asset Market and later monitoring account-visible market data.

## Run

```bash
npm install
npm run dev
```

## API

`GET /health` checks that the service is running.

`POST /api/connections/login` accepts:

```json
{
  "mobile": "13800138000",
  "password": "your-password",
  "deviceToken": "optional-browser-device-token"
}
```

The login endpoint calls the target site's password-login API directly. It returns:

- `authenticated` with a session token when login succeeds;
- `challenge_required` with a `challengeUrl` when the target requires living verification;
- `authentication_failed` when the target rejects the credentials.

The MVP does not persist passwords, automatically bypass CAPTCHA, complete face verification, or perform trading actions. A production version must encrypt session tokens at rest and apply secret redaction, rate limiting, audit logging, and explicit user consent.
