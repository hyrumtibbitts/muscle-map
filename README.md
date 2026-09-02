# Muscle Map

Daily muscle-tracking app with an interactive 3D body map.

- Log a workout (exercises, sets, reps).
- The app highlights the muscles that workout trained.
- Tap a muscle to add soreness, tightness, mind-muscle connection, and a note.
- Muscles you did not train keep their last known state.

Stack: Next.js (static export) · Tailwind · Supabase · React Three Fiber.

Add `?demo=1` to the URL to see a sample day without saving anything.
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
| `src/components/body-map/` | React Three Fiber body map. Zone color = status. Tap a zone to select it. |
| `public/models/body.glb` | 31 tappable muscle zones + neutral filler + skeleton. ~1.5 MB, meshopt-compressed. |
| `scripts/build-body-model.py` | Rebuilds `body.glb` from the source meshes (see Body model). |

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

## Body model

The 3D body is built from real anatomy meshes, not a stylised figure.

- Source data: [BodyParts3D](https://lifesciencedb.jp/bp3d/) © The Database Center for Life Science, licensed [CC BY-SA 2.1 JP](https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en), and [Z-Anatomy](https://www.z-anatomy.com/) (CC BY-SA).
- Both were decimated and aligned by [BodyExplorer](https://github.com/JohanBellander/BodyExplorer) (`anatomy.glb`, `skeleton.glb`, `mesh_mapping.json`).
- `scripts/build-body-model.py` groups the 467 muscle meshes into the 31 zones in `data/muscles.json`, decimates each zone, adds a neutral filler layer and the skeleton, converts to metres / Y-up, and writes `public/models/body.glb`.
- `gltfpack -cc -kn` then compresses it with meshopt.

`body.glb` is a derivative of CC BY-SA data. Keep the attribution in the app footer.

To rebuild:

```bash
pip install numpy trimesh fast-simplification
# put anatomy.glb, skeleton.glb, mesh_mapping.json from BodyExplorer/public in ./source-meshes
python3 scripts/build-body-model.py ./source-meshes public/models/body-raw.glb
npx gltfpack -i public/models/body-raw.glb -o public/models/body.glb -cc -kn
```

## Roadmap

- Phase 1 (done): exercise-to-muscle data, Supabase schema, local data layer.
- Phase 2 (done): 3D body map from open anatomy meshes in React Three Fiber. Zone color = status. Tap to select.
- Phase 3: logging a workout auto-updates muscle status; tap a zone to open the detail panel.
