# SynapticAI

AI-powered evidence-based recruiting platform for enterprise campus hiring.

## Portals
- Recruiter: post jobs, rank candidates, analytics, AI tools
- Student: browse jobs, apply, AI self-assessment, interview simulation
- Admin: platform management

## Tech Stack
Vite + React 18 + TypeScript + shadcn/ui + Tailwind + Supabase (Postgres, Auth, Storage, Realtime) + 13 Deno Edge Functions + Gemini AI

## Setup

### 1. Clone and install
```bash
npm install
```

### 2. Create your own Supabase project
Go to supabase.com → New Project. Copy Project URL, anon key, project ref.

### 3. Configure environment
```bash
cp .env.example .env
# Fill in VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PROJECT_ID
```

### 4. Apply database schema
```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

### 5. Set edge function secrets
```bash
supabase secrets set AI_PROVIDER_API_KEY=<your-gemini-api-key>
supabase secrets set SEED_SECRET=<any-random-string>
```

### 6. Deploy edge functions
```bash
supabase functions deploy
```

### 7. Seed demo accounts (optional)
```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/seed-users \
  -H "x-seed-secret: <your-SEED_SECRET>"
```

### 8. Run locally
```bash
npm run dev
```

## Scripts
| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint check |
| `npm run test` | Run tests (vitest) |

## Demo accounts (after seeding)
Password for all: `Demo@1234`
- Student: aarav.kumar86@iit.ac.in
- Recruiter: priya.sharma@tcs.com
- Admin: admin@hirehub.com
