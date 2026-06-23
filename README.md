# Meal Registry System

A Django/PostgreSQL meal allocation system for QR-code based meal tickets.

## Features

- Unique QR access code per user.
- Staff-only scanner portal using device camera resources.
- Configurable meal categories and per-user daily limits.
- Role-based access control for User, Staff, Administrator, and Super Administrator.
- Full audit records for logins, failed logins, logouts, scans, user creation, category changes, branding changes, and email configuration changes.
- Branding settings for logo, organization name, contact details, and address.
- Email configuration page with SMTP and OAuth configuration fields.
- QR email sent when a user is created, with a fixed "Powered By Pop In Solutions" footer.

## Local Development

For now, Docker only runs PostgreSQL. The application runs locally through npm without Vite.

```bash
docker compose up -d db
npm run dev
```

Open `http://127.0.0.1:3000`.

The `npm run dev` command is a plain Node wrapper, not Vite. It waits for PostgreSQL on `localhost:5432`, runs Django migrations, bootstraps the default admin/categories, and starts Django's development server.

On Windows PowerShell, if script execution policy blocks `npm.ps1`, run:

```powershell
npm.cmd run dev
```

## Containers

The production-style nginx and webapp containers are currently commented out in `docker-compose.yml`. The intended production layout remains:

- `nginx`: exposes host port `443`.
- `webapp1` and `webapp2`: run the Django application.
- `db`: PostgreSQL database.

## Production-Style Run

```bash
cp .env.example .env
# Uncomment nginx, webapp1, webapp2, and their volumes in docker-compose.yml first.
docker compose up --build
```

Open `https://localhost`. Plain `http://localhost` is redirected to HTTPS. The default bootstrap admin is controlled by the `DJANGO_SUPERUSER_*` values in `.env`.
