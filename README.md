# chinadep-watch

Egg.js MVP for connecting a user-authorized account to the China Digital Asset Market and later monitoring account-visible market data.

The current web console is available at `/` and uses an SQLite-backed platform account. Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` in `.env` before the first start; the account is created during database initialization. Changing those variables later does not overwrite an existing account.

After signing in to the console, use the `监控平台账号连接` card to submit the target platform's mobile, complete the embedded CAPTCHA, request an SMS code, and submit that code. Successful target sessions are encrypted with `APP_KEYS` before being stored in SQLite; SMS codes and passwords are not stored. If the target returns a living-verification challenge, the console displays the challenge URL for the user to complete.

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

`POST /api/connections/sms/send` sends an SMS code after the console user completes the target CAPTCHA:

```json
{
  "mobile": "13800138000",
  "validate": "captcha-validate-result",
  "deviceToken": "optional-browser-device-token"
}
```

`POST /api/connections/sms/login` accepts the SMS code:

```json
{
  "mobile": "13800138000",
  "code": "123456",
  "deviceToken": "optional-browser-device-token"
}
```

Both SMS endpoints require the console session from `POST /api/auth/login`. CAPTCHA, SMS, and any face/living verification are intentionally completed by the user in the browser.

## Asset catalog

`POST /api/assets/sync` reads the full public asset catalog, including regular market and专区 assets, from the target platform and upserts it into SQLite. An optional `mobile` selects a specific connected account (the account is still required by the local API and is used for the request context):

```json
{
  "mobile": "13800138000",
  "pageSize": 50
}
```

`GET /api/assets` lists locally synced assets. Use `q` to search by asset name, issuer, or type and `enabled=true|false` to filter monitoring status. `PATCH /api/assets/:id` accepts `{ "enabled": true }` or `{ "note": "..." }` for local monitoring configuration.

The catalog phase is read-only against the target platform. Price snapshots, schedules, and alert rules are not enabled yet.

The MVP does not persist passwords, automatically bypass CAPTCHA, complete face verification, or perform trading actions. A production version must encrypt session tokens at rest and apply secret redaction, rate limiting, audit logging, and explicit user consent.
