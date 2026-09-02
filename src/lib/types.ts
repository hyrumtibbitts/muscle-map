// Types that mirror supabase/migrations/0001_init.sql.

export type MuscleGroup = "chest" | "back" | "shoulders" | "arms" | "core" | "legs" | "neck";
export type BodyView = "front" | "back" | "both";

export interface Muscle {
  id: string;
  name: string;
  group: MuscleGroup;
  view: BodyView;
  bilateral: boolean;
  external_ids: { biodigital?: string[] };
}

export type ExerciseCategory = "compound" | "isolation";

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  pattern: string;
  equipment: string;
  aliases: string[];
  primary_muscles: string[];
  secondary_muscles: string[];
}

export interface WorkoutLog {
  id: string;
  logged_on: string; // YYYY-MM-DD
  title?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkoutSet {
  id: string;
  workout_log_id: string;
  exercise_id: string;
  set_index: number;
  reps?: number;
  weight_kg?: number;
  rpe?: number;
  is_warmup: boolean;
}

export type MuscleStatusSource = "auto" | "manual" | "carry_forward";

export interface DailyMuscleStatus {
  id: string;
  muscle_id: string;
  status_date: string; // YYYY-MM-DD
  trained: boolean;
  working_sets: number;
  mind_muscle_connection?: number; // 1-5
  soreness?: number; // 0-5
  tightness?: number; // 0-5
  note?: string;
  source: MuscleStatusSource;
  last_trained_on?: string;
  updated_at: string;
}

/** One row per muscle. Mirrors the muscle_status_on() SQL function. */
export interface MuscleStatusOnDate {
  muscle_id: string;
  name: string;
  group: MuscleGroup;
  view: BodyView;
  status_date?: string;
  days_since_status?: number;
  trained_on_date: boolean;
  working_sets?: number;
  mind_muscle_connection?: number;
  soreness?: number;
  tightness?: number;
  note?: string;
  source?: MuscleStatusSource;
  last_trained_on?: string;
}
