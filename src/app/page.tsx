import { EXERCISES } from "@/lib/data/exercises";
import { MUSCLES } from "@/lib/data/muscles";

const GROUPS = ["chest", "back", "shoulders", "arms", "core", "legs"] as const;

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Muscle Map</h1>
      <p className="mt-2 text-zinc-400">
        Phase 1: {MUSCLES.length} muscle zones · {EXERCISES.length} exercises mapped. Body map comes in Phase 2.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {GROUPS.map((g) => {
          const muscles = MUSCLES.filter((m) => m.group === g);
          return (
            <section key={g} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
              <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400">{g}</h2>
              <ul className="mt-3 space-y-1.5">
                {muscles.map((m) => {
                  const n = EXERCISES.filter((e) => e.primary_muscles.includes(m.id)).length;
                  return (
                    <li key={m.id} className="flex items-center justify-between text-sm">
                      <span>{m.name}</span>
                      <span className="tabular-nums text-zinc-500">{n} primary</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}
