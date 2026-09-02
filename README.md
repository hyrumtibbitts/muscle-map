# Muscle Map

Daily muscle-tracking app with an interactive 3D body map.

- Log a workout (exercises, sets, reps).
- The app highlights the muscles that workout trained.
- Tap a muscle to add soreness, tightness, mind-muscle connection, and a note.
- Muscles you did not train keep their last known state.

Stack: Next.js (static export) · Tailwind · Supabase · React Three Fiber.
Deploys to GitHub Pages at `https://hyrumtibbitts.github.io/muscle-map`.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no Supabase keys set, data is stored in the browser (localStorage).

## Project layout

| Path | What it is |
|------|-----------|
| `data/muscles.json` | 31 muscle zones. Each `id` is one tap zone on the body map. |
| `data/exercises.json` | 96 exercises with `primary_muscles`, `secondary_muscles`, and `aliases`. |
| `supabase/migrations/0001_init.sql` | Tables, RLS policies, `muscle_status_on()` carry-forward function. |
| `supabase/seed.sql` | Generated from the JSON. Safe to run more than once. |
| `scripts/validate-data.mjs` | Checks the JSON for bad ids and duplicates. |
| `scripts/generate-seed.mjs` | Rebuilds `seed.sql` from the JSON. |
| `src/lib/types.ts` | TypeScript types that match the database tables. |
| `src/lib/data/` | Loads the JSON and matches exercise names to ids. |
| `src/lib/repo/` | Data access. `LocalRepo` (browser storage) now, `SupabaseRepo` later. |

## Database tables

- `muscles` — reference data, read-only for users.
- `exercises` — seeded rows are global. Users can add their own rows.
- `exercise_muscles` — one row per (exercise, muscle, role). Role is `primary` or `secondary`.
- `workout_logs` — one row per workout session.
- `workout_sets` — one row per set: exercise, reps, weight, RPE.
- `daily_muscle_status` — one row per (user, muscle, date).

`select * from muscle_status_on('2026-09-02')` returns all 31 muscles with the newest status on or before that date.

## Connect Supabase (later)

1. Create a Supabase project.
2. Run `supabase/migrations/0001_init.sql`, then `supabase/seed.sql`, in the SQL editor.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local` and to the GitHub repo secrets.

## Edit the exercise data

1. Edit `data/muscles.json` or `data/exercises.json`.
2. `node scripts/validate-data.mjs`
3. `node scripts/generate-seed.mjs`

## Deploy

Push to `main`. The workflow in `.github/workflows/deploy.yml` builds and publishes to GitHub Pages.
In the repo settings, set Pages → Source to **GitHub Actions** once.

## Roadmap

- Phase 1 (done): exercise-to-muscle data, Supabase schema, local data layer.
- Phase 2: 3D body map from open anatomy meshes (BodyParts3D / Z-Anatomy) in React Three Fiber. Zone color = status.
- Phase 3: logging a workout auto-updates muscle status; tap a zone to open the detail panel.
