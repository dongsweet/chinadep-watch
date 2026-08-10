# chinadep-watch

Egg.js MVP for connecting a user-authorized account to the China Digital Asset Market and later monitoring account-visible market data.

The current web console is available at `/` and uses an SQLite-backed platform account. Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` in `.env` before the first start; the account is created during database initialization. Changing those variables later does not overwrite an existing account.

After signing in to the console, use the `监控平台账号连接` card to submit the target platform's mobile and password. Successful target sessions are encrypted with `APP_KEYS` before being stored in SQLite; passwords are not stored. If the target returns a living-verification challenge, the console displays the challenge URL for the user to complete.

## Run

```bash
npm install
npm run dev
```

The default local login is `admin` / `admin123` when no environment variables are provided. Change it for any shared environment.

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
