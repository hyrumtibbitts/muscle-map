import { EXERCISES } from "@/lib/data/exercises";
import { MUSCLES } from "@/lib/data/muscles";
import type { DailyMuscleStatus, MuscleStatusOnDate, WorkoutLog, WorkoutSet } from "@/lib/types";
import type { MuscleMapRepo, MuscleStatusInput, NewWorkoutLog, NewWorkoutSet } from "./types";

const KEY = "muscle-map:v1";

interface Store {
  workout_logs: WorkoutLog[];
  workout_sets: WorkoutSet[];
  daily_muscle_status: DailyMuscleStatus[];
}

const empty = (): Store => ({ workout_logs: [], workout_sets: [], daily_muscle_status: [] });

function read(): Store {
  if (typeof window === "undefined") return empty();
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...empty(), ...JSON.parse(raw) } : empty();
  } catch {
    return empty();
  }
}

function write(store: Store) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Storage may be blocked. Keep the app usable.
  }
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

/** Browser-storage implementation. Same rules as the SQL schema. */
export class LocalRepo implements MuscleMapRepo {
  async listMuscles() {
    return MUSCLES;
  }

  async listExercises() {
    return EXERCISES;
  }

  async listWorkoutLogs() {
    return read().workout_logs.sort((a, b) => b.logged_on.localeCompare(a.logged_on));
  }

  async getWorkoutLog(id: string) {
    const s = read();
    const log = s.workout_logs.find((l) => l.id === id);
    if (!log) return null;
    const sets = s.workout_sets
      .filter((x) => x.workout_log_id === id)
      .sort((a, b) => a.set_index - b.set_index);
    return { log, sets };
  }

  async saveWorkoutLog(input: NewWorkoutLog, sets: NewWorkoutSet[]) {
    const s = read();
    const now = new Date().toISOString();
    const existing = input.id ? s.workout_logs.find((l) => l.id === input.id) : undefined;
    const log: WorkoutLog = existing
      ? { ...existing, ...input, updated_at: now }
      : { ...input, id: input.id ?? uid(), created_at: now, updated_at: now };

    s.workout_logs = [...s.workout_logs.filter((l) => l.id !== log.id), log];
    s.workout_sets = [
      ...s.workout_sets.filter((x) => x.workout_log_id !== log.id),
      ...sets.map((x) => ({ ...x, id: uid(), workout_log_id: log.id })),
    ];
    write(s);
    return log;
  }

  async deleteWorkoutLog(id: string) {
    const s = read();
    s.workout_logs = s.workout_logs.filter((l) => l.id !== id);
    s.workout_sets = s.workout_sets.filter((x) => x.workout_log_id !== id);
    write(s);
  }

  async upsertMuscleStatus(input: MuscleStatusInput) {
    const s = read();
    const now = new Date().toISOString();
    const i = s.daily_muscle_status.findIndex(
      (r) => r.muscle_id === input.muscle_id && r.status_date === input.status_date,
    );
    const base: DailyMuscleStatus =
      i >= 0
        ? s.daily_muscle_status[i]
        : {
            id: uid(),
            muscle_id: input.muscle_id,
            status_date: input.status_date,
            trained: false,
            working_sets: 0,
            source: "manual",
            updated_at: now,
          };
    const row: DailyMuscleStatus = { ...base, ...input, updated_at: now };
    if (i >= 0) s.daily_muscle_status[i] = row;
    else s.daily_muscle_status.push(row);
    write(s);
    return row;
  }

  async muscleStatusOn(date: string): Promise<MuscleStatusOnDate[]> {
    const rows = read().daily_muscle_status;
    return MUSCLES.map((m) => {
      const latest = rows
        .filter((r) => r.muscle_id === m.id && r.status_date <= date)
        .sort((a, b) => b.status_date.localeCompare(a.status_date))[0];
      if (!latest) {
        return { muscle_id: m.id, name: m.name, group: m.group, view: m.view, trained_on_date: false };
      }
      return {
        muscle_id: m.id,
        name: m.name,
        group: m.group,
        view: m.view,
        status_date: latest.status_date,
        days_since_status: daysBetween(latest.status_date, date),
        trained_on_date: latest.trained && latest.status_date === date,
        working_sets: latest.working_sets,
        mind_muscle_connection: latest.mind_muscle_connection,
        soreness: latest.soreness,
        tightness: latest.tightness,
        note: latest.note,
        source: latest.source,
        last_trained_on: latest.last_trained_on,
      };
    });
  }
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}
