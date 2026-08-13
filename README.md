# Unique Sweets & Bakers POS - Enterprise POS System

An enterprise-grade Point of Sale (POS), Inventory, Kitchen, and Business Management system built with React, Node.js, Express, PostgreSQL, and Prisma.

## Environment Variables

Copy `.env.example` to `.env` or set the following variables in your deployment environment:

| Variable | Description | Default / Example |
| --- | --- | --- |
| `PORT` | Web server port | `3000` |
| `JWT_SECRET` | Secret key for signing authentication tokens | Auto-generated secure fallback |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:password@localhost:5432/unique_pos?schema=public` |
| `POSTGRES_PASSWORD` | PostgreSQL database password | `password` |
| `GEMINI_API_KEY` | Optional API key for AI assistant features | Optional |

## Running the Application

- **Development**: `npm run dev` (Starts backend Express server with Vite middleware on port 3000)
- **Build**: `npm run build` (Builds Vite client and bundles `server.ts` with esbuild)
- **Start**: `npm run start` (Runs bundled server from `dist/server.cjs`)
