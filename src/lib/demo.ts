import { MUSCLES } from "@/lib/data/muscles";
import type { MuscleStatusOnDate } from "@/lib/types";

/** Sample day for previews (?demo=1). Not saved. */
export function demoStatuses(date: string): MuscleStatusOnDate[] {
  const worked = new Set(["pec_upper", "pec_lower", "deltoid_anterior", "deltoid_lateral", "triceps_brachii", "serratus_anterior"]);
  const recent = new Set(["quadriceps", "gluteus_maximus", "hamstrings", "hip_adductors", "erector_spinae"]);
  const sore = new Set(["hamstrings", "gluteus_maximus"]);
  const tight = new Set(["hip_flexors", "trapezius_upper"]);
  return MUSCLES.map((m) => {
    const isWorked = worked.has(m.id);
    const isRecent = recent.has(m.id);
    return {
      muscle_id: m.id,
      name: m.name,
      group: m.group,
      view: m.view,
      status_date: isWorked ? date : isRecent || tight.has(m.id) ? shift(date, -1) : undefined,
      days_since_status: isWorked ? 0 : isRecent || tight.has(m.id) ? 1 : undefined,
      trained_on_date: isWorked,
      working_sets: isWorked ? 12 : isRecent ? 10 : 0,
      soreness: sore.has(m.id) ? 3 : isRecent ? 1 : 0,
      tightness: tight.has(m.id) ? 3 : 0,
      mind_muscle_connection: isWorked ? 4 : undefined,
      note: isWorked ? "Push day. Felt strong on incline." : undefined,
      source: isWorked || isRecent ? "auto" : "manual",
      last_trained_on: isWorked ? date : isRecent ? shift(date, -1) : undefined,
    };
  });
}

function shift(date: string, days: number) {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
