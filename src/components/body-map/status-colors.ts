import type { MuscleStatusOnDate } from "@/lib/types";

export type ZoneState = "sore" | "tight" | "worked" | "recent" | "fresh";

export const ZONE_COLORS: Record<ZoneState, string> = {
  sore: "#ef4444",
  tight: "#eab308",
  worked: "#f97316",
  recent: "#9a3412",
  fresh: "#52525b",
};

export const ZONE_LABELS: Record<ZoneState, string> = {
  sore: "Sore",
  tight: "Tight",
  worked: "Worked today",
  recent: "Worked 1–2 days ago",
  fresh: "Fresh",
};

/** Priority: sore > tight > worked today > recent > fresh. */
export function zoneState(s: MuscleStatusOnDate | undefined): ZoneState {
  if (!s) return "fresh";
  if ((s.soreness ?? 0) >= 3) return "sore";
  if ((s.tightness ?? 0) >= 3) return "tight";
  if (s.trained_on_date) return "worked";
  if (s.last_trained_on && s.status_date) {
    const days = daysBetween(s.last_trained_on, s.status_date) + (s.days_since_status ?? 0);
    if (days >= 1 && days <= 2) return "recent";
  } else if (s.days_since_status !== undefined && s.days_since_status >= 1 && s.days_since_status <= 2 && s.working_sets) {
    return "recent";
  }
  return "fresh";
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}
