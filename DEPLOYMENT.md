# Production deployment

Use a persistent Node web service rather than forcing this project into Netlify Functions. The application is an Express server (`npm start`) and the repository also contains an operational contract-delivery worker command. Netlify can host Express via Functions, but that would require an adapter/refactor and function execution constraints; a persistent host is the lower-risk fit for the current source.

Render example: repository root; runtime Node; build `npm ci`; start `npm start`; health path `/health`; Node 20. `render.yaml` contains the non-secret service skeleton.

Required runtime variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_API_KEY`, `APP_PUBLIC_BASE_URL`, `CORS_ORIGINS`. `PORT` is supplied by most hosts (local default is 4000). Optional integrations: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `CONTRACT_DELIVERY_LIMIT`, `CONTRACT_DELIVERY_MAX_ATTEMPTS`.

Set `CORS_ORIGINS` to a comma-separated list of exact allowed HTTPS origins. In production, missing `ADMIN_API_KEY` now fails closed for admin endpoints. The supplied `.env` was deliberately removed from the prepared package; rotate any credentials that may previously have been shared or committed.
