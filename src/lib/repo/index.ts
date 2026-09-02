import { LocalRepo } from "./local";
import type { MuscleMapRepo } from "./types";

export type { MuscleMapRepo } from "./types";

let repo: MuscleMapRepo | null = null;

/** Returns the active data layer. Supabase is used when its keys are set; else browser storage. */
export function getRepo(): MuscleMapRepo {
  if (repo) return repo;
  // TODO(phase 3): return new SupabaseRepo() when NEXT_PUBLIC_SUPABASE_URL is set.
  repo = new LocalRepo();
  return repo;
}
