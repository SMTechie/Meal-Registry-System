# Meal Registry System

A Next.js/React meal allocation system backed by PostgreSQL.

## Stack

- Next.js App Router and React
- PostgreSQL hosted with Docker Compose locally and Neon in production
- Prisma ORM and migrations
- Tailwind CSS with shadcn-compatible theme tokens
- Iconify icons
- anime.js powered page reveal animation

## Local Development

The Docker database is exposed on host port `5434` to avoid conflicts with other local PostgreSQL services.

```powershell
docker compose up -d db
npm.cmd install
npm.cmd run db:migrate -- --name init
npm.cmd run db:seed
npm.cmd run dev
```

Open `http://127.0.0.1:3001`.

Default accounts:

- Admin: `admin` / `ChangeMe123!`
- Staff: `staff` / `ChangeMe123!`
- Seeded marking assistants are visible from the scanner screen.

## Useful Commands

```powershell
npm.cmd run build
npm.cmd run db:deploy
npm.cmd run db:studio
docker compose down
```

## Deploying To Vercel With Neon

This app is ready for Vercel. The Vercel build command is configured in `vercel.json` and runs:

```bash
npm run vercel-build
```

That command generates Prisma Client, applies committed Prisma migrations with `prisma migrate deploy`, and builds Next.js.

Set these Environment Variables in Vercel Project Settings:

```text
DATABASE_URL=<your Neon pooled connection string>
DIRECT_URL=<your Neon direct/non-pooled connection string>
SESSION_SECRET=<a long random secret>
NEXT_PUBLIC_APP_URL=https://your-vercel-app.vercel.app
```

For Neon:

- `DATABASE_URL` should use the pooled host, usually ending in `-pooler...neon.tech`.
- `DIRECT_URL` should use the direct host, usually the same URL but without `-pooler` in the hostname.
- Keep both values out of git. Add them only in Vercel or local ignored env files.

For the Neon URL supplied for this project:

- Use the supplied pooled URL as `DATABASE_URL`.
- Use the same URL with the hostname changed from `ep-sparkling-credit-ad6ec2fr-pooler...` to `ep-sparkling-credit-ad6ec2fr...` as `DIRECT_URL`.

After the first production deploy, seed the default admin, staff, assistants, settings and meal timeslots once:

```powershell
# Use Vercel's env pull or set DATABASE_URL and DIRECT_URL locally first.
npm.cmd run db:seed
```

Default seeded login:

- Admin: `admin` / `ChangeMe123!`

Change that password after the first sign-in.
