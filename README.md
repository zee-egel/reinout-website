# Reinout Portfolio Playground

This project powers the interactive portfolio at [reinout.dance](https://reinout.dance), blending a React Router front-end with a small Node API, Prisma, and PostgreSQL. The API focuses on storytelling-friendly content models so you can grow the site over time without redesigning the data layer.

## Stack Overview
- **Frontend:** React Router (SSG/SSR) + Tailwind CSS
- **API:** Express + Prisma Client
- **Database:** PostgreSQL (via Docker Compose)
- **Background:** TensorFlow playgrounds, reinforcement-learning workers, and other demos that surface through the portfolio

## Initial Setup
1. **Install dependencies**
   ```bash
   npm install
   npm install --prefix api
   ```
2. **Copy environment config**
   ```bash
   cp .env.example .env
   # optional: customise api/.env for running the API outside Docker
   ```
   Update the credentials to suit your setup. The API will fall back to the root `.env` if `api/.env` is absent.
3. **Prepare the database**
   ```bash
   npm run --prefix api prisma:generate
   npm run --prefix api prisma:migrate
   npm run --prefix api db:seed
   ```

## Running the App
- **Frontend dev server**
  ```bash
  npm run dev
  ```
  Available at `http://localhost:5173`.
- **API dev server**
  ```bash
  npm run --prefix api dev
  ```
  Listens on `http://localhost:4000` by default. Endpoints: `/healthz`, `/users`, `/projects`, `/sessions`.

## Docker Compose Workflow
1. Populate `.env` with production-friendly credentials.
2. Start the full stack (frontend, API, PostgreSQL, pgAdmin, nightly backups):
   ```bash
   docker compose up --build
   ```
3. The API container runs with automated Prisma client generation and production build. Postgres data is persisted under `db/`.

## Prisma Data Model
- **User** – primary identity for the portfolio author or collaborators. Includes profile metadata (`bio`, `avatarUrl`, `websiteUrl`) and drives project ownership.
- **Session** – login/access tokens with audit fields (`ipAddress`, `userAgent`, `expiresAt`) so you can plug in passwordless auth or admin dashboards later.
- **Project** – rich case-study records with status tracking (`draft`, `in_progress`, `published`, `archived`), highlight flags, timelines, and arrays for `techStack` and `keywords`.
- **ProjectContribution** – join table capturing collaborators per project, their role (`lead`, `maintainer`, etc.), ordering, and custom descriptions.

## Helpful Commands
```bash
npm run --prefix api prisma:generate   # regenerate Prisma Client after schema changes
npm run --prefix api prisma:migrate    # apply migrations in the container or locally
npm run --prefix api db:seed           # seed baseline portfolio content
npm run --prefix api build             # compile the API for production
```

## Next Steps
- Connect the Remix/React Router loaders and actions to the new API endpoints.
- Extend the Prisma schema with content blocks (blog posts, talks) or analytics tables as you grow the site.
- Wire up authentication to issue and revoke `Session` tokens and lock down write endpoints.
