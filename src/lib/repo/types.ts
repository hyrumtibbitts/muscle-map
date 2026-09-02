import type {
  DailyMuscleStatus,
  Exercise,
  Muscle,
  MuscleStatusOnDate,
  WorkoutLog,
  WorkoutSet,
} from "@/lib/types";

export type NewWorkoutLog = Omit<WorkoutLog, "id" | "created_at" | "updated_at"> & { id?: string };
export type NewWorkoutSet = Omit<WorkoutSet, "id" | "workout_log_id">;
export type MuscleStatusInput = Pick<DailyMuscleStatus, "muscle_id" | "status_date"> &
  Partial<Omit<DailyMuscleStatus, "id" | "muscle_id" | "status_date" | "updated_at">>;

/** Data access contract. LocalRepo now; SupabaseRepo later. Both keep this shape. */
export interface MuscleMapRepo {
  listMuscles(): Promise<Muscle[]>;
  listExercises(): Promise<Exercise[]>;

  listWorkoutLogs(): Promise<WorkoutLog[]>;
  getWorkoutLog(id: string): Promise<{ log: WorkoutLog; sets: WorkoutSet[] } | null>;
  saveWorkoutLog(log: NewWorkoutLog, sets: NewWorkoutSet[]): Promise<WorkoutLog>;
  deleteWorkoutLog(id: string): Promise<void>;

  upsertMuscleStatus(input: MuscleStatusInput): Promise<DailyMuscleStatus>;
  /** All muscles with their newest status on or before `date` (carry-forward). */
  muscleStatusOn(date: string): Promise<MuscleStatusOnDate[]>;
}
