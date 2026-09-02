import musclesJson from "../../../data/muscles.json";
import type { Muscle } from "@/lib/types";

export const MUSCLES: Muscle[] = musclesJson.muscles as Muscle[];

const byId = new Map(MUSCLES.map((m) => [m.id, m]));

export function getMuscle(id: string): Muscle | undefined {
  return byId.get(id);
}
