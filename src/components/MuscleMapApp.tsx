"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { BodyView } from "@/components/body-map/BodyMap";
import { ZONE_COLORS, ZONE_LABELS, zoneState, type ZoneState } from "@/components/body-map/status-colors";
import { todayLocal } from "@/lib/date";
import { demoStatuses } from "@/lib/demo";
import { getRepo } from "@/lib/repo";
import type { MuscleStatusOnDate } from "@/lib/types";

const BodyMap = dynamic(() => import("@/components/body-map/BodyMap"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-zinc-500">Loading body…</div>,
});

const LEGEND: ZoneState[] = ["worked", "recent", "sore", "tight", "fresh"];

export default function MuscleMapApp() {
  const [date, setDate] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<MuscleStatusOnDate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<BodyView>("front");
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const today = todayLocal();
      const isDemo = new URLSearchParams(window.location.search).get("demo") === "1";
      const rows = await (isDemo ? Promise.resolve(demoStatuses(today)) : getRepo().muscleStatusOn(today));
      if (cancelled) return;
      setDate(today);
      setDemo(isDemo);
      setStatuses(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(() => statuses.find((s) => s.muscle_id === selectedId) ?? null, [statuses, selectedId]);

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-zinc-800 px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Muscle Map</h1>
          <p className="text-xs text-zinc-500">
            {date ?? "…"}
            {demo && " · demo data"}
          </p>
        </div>
        <div className="flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5 text-sm">
          {(["front", "back"] as BodyView[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 capitalize transition ${
                view === v ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <BodyMap
          statuses={statuses}
          selectedId={selectedId}
          onSelect={setSelectedId}
          view={view}
          className="h-full w-full touch-none"
        />

        <ul className="pointer-events-none absolute left-4 top-4 space-y-1.5 text-xs">
          {LEGEND.map((s) => (
            <li key={s} className="flex items-center gap-2 text-zinc-300">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: ZONE_COLORS[s] }} />
              {ZONE_LABELS[s]}
            </li>
          ))}
        </ul>

        {selected && (
          <aside className="absolute bottom-4 left-4 right-4 rounded-xl border border-zinc-800 bg-zinc-900/95 p-4 shadow-xl backdrop-blur sm:left-auto sm:w-80">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-medium">{selected.name}</h2>
                <p className="text-xs capitalize text-zinc-500">
                  {selected.group} · {ZONE_LABELS[zoneState(selected)]}
                </p>
              </div>
              <button onClick={() => setSelectedId(null)} className="text-zinc-500 hover:text-zinc-200" aria-label="Close">
                ✕
              </button>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
              <Stat label="Soreness" value={selected.soreness} />
              <Stat label="Tightness" value={selected.tightness} />
              <Stat label="Mind–muscle" value={selected.mind_muscle_connection} />
            </dl>
            {selected.note && <p className="mt-3 text-sm text-zinc-300">{selected.note}</p>}
            {selected.last_trained_on && (
              <p className="mt-2 text-xs text-zinc-500">Last trained {selected.last_trained_on}</p>
            )}
            <p className="mt-3 text-xs text-zinc-600">Editing comes in Phase 3.</p>
          </aside>
        )}
      </div>

      <footer className="border-t border-zinc-800 px-4 py-1.5 text-[10px] text-zinc-600">
        Model: BodyParts3D © The Database Center for Life Science (CC BY-SA 2.1 JP) · Z-Anatomy (CC BY-SA) · prepared via BodyExplorer
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-lg bg-zinc-800/70 py-2">
      <dt className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className="text-base tabular-nums">{value ?? "–"}</dd>
    </div>
  );
}
