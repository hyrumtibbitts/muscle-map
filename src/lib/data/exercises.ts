import exercisesJson from "../../../data/exercises.json";
import type { Exercise } from "@/lib/types";

export const EXERCISES: Exercise[] = exercisesJson.exercises as Exercise[];

const byId = new Map(EXERCISES.map((e) => [e.id, e]));

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const byAlias = new Map<string, Exercise>();
for (const e of EXERCISES) {
  byAlias.set(normalize(e.name), e);
  for (const a of e.aliases) byAlias.set(normalize(a), e);
}

export function getExercise(id: string): Exercise | undefined {
  return byId.get(id);
}

/** Match a typed exercise name to an exercise. Exact alias first, then substring. */
export function findExerciseByName(name: string): Exercise | undefined {
  const n = normalize(name);
  if (!n) return undefined;
  const exact = byAlias.get(n);
  if (exact) return exact;
  for (const [alias, e] of byAlias) {
    if (n.includes(alias) || alias.includes(n)) return e;
  }
  return undefined;
}

/** Muscle ids trained by a list of exercise ids, split by role. */
export function musclesForExercises(exerciseIds: string[]) {
  const primary = new Set<string>();
  const secondary = new Set<string>();
  for (const id of exerciseIds) {
    const e = byId.get(id);
    if (!e) continue;
    e.primary_muscles.forEach((m) => primary.add(m));
    e.secondary_muscles.forEach((m) => secondary.add(m));
  }
  for (const m of primary) secondary.delete(m);
  return { primary: [...primary], secondary: [...secondary] };
}
