"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { InteractiveRouteBar } from "@/components/InteractiveRouteBar";

type Place = {
  id: string;
  label: string;
  x: number;
  y: number;
  emoji: string;
};

const PLACES: Place[] = [
  { id: "auth", label: "Authentication", x: 48, y: 16, emoji: "🔐" },
  { id: "user", label: "User Service", x: 18, y: 40, emoji: "👤" },
  { id: "pay", label: "Payment", x: 78, y: 38, emoji: "💳" },
  { id: "orders", label: "Orders", x: 38, y: 62, emoji: "📦" },
  { id: "inv", label: "Inventory", x: 68, y: 68, emoji: "🏭" },
  { id: "notif", label: "Notifications", x: 32, y: 86, emoji: "🔔" },
];

const ROADS: [string, string][] = [
  ["auth", "user"],
  ["auth", "pay"],
  ["user", "orders"],
  ["pay", "orders"],
  ["pay", "inv"],
  ["orders", "notif"],
];

const JOURNEYS: { from: string; to: string; path: string[]; label: string }[] = [
  {
    from: "pay",
    to: "orders",
    path: ["pay", "orders"],
    label: "Payment → Orders",
  },
  {
    from: "auth",
    to: "notif",
    path: ["auth", "user", "orders", "notif"],
    label: "Auth → Notifications",
  },
  {
    from: "user",
    to: "inv",
    path: ["user", "orders", "pay", "inv"],
    label: "User → Inventory",
  },
];

function pos(id: string) {
  return PLACES.find((p) => p.id === id)!;
}

function edgeKey(a: string, b: string) {
  return [a, b].sort().join("-");
}

/** BFS shortest path on the demo road graph */
function findPath(from: string, to: string): string[] | null {
  if (from === to) return [from];
  const adj = new Map<string, string[]>();
  for (const [a, b] of ROADS) {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push(b);
    adj.get(b)!.push(a);
  }
  const queue = [from];
  const prev = new Map<string, string | null>([[from, null]]);
  while (queue.length) {
    const cur = queue.shift()!;
    for (const n of adj.get(cur) || []) {
      if (prev.has(n)) continue;
      prev.set(n, cur);
      if (n === to) {
        const path: string[] = [];
        let x: string | null = to;
        while (x) {
          path.unshift(x);
          x = prev.get(x) ?? null;
        }
        return path;
      }
      queue.push(n);
    }
  }
  return null;
}

export function InteractiveHeroMap() {
  const [selected, setSelected] = useState<string | null>("pay");
  const [pinFrom, setPinFrom] = useState<string | null>(null);
  const [activePath, setActivePath] = useState<string[]>(JOURNEYS[0].path);
  const [step, setStep] = useState(-1);
  const [traveling, setTraveling] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const routeSet = useMemo(() => {
    if (step < 0) {
      return {
        ids: new Set<string>(),
        edges: new Set<string>(),
        current: null as string | null,
      };
    }
    const ids = new Set(activePath.slice(0, step + 1));
    const edges = new Set<string>();
    for (let i = 0; i < Math.min(step, activePath.length - 1); i++) {
      edges.add(edgeKey(activePath[i], activePath[i + 1]));
    }
    return {
      ids,
      edges,
      current: activePath[Math.min(step, activePath.length - 1)],
    };
  }, [activePath, step]);

  const startTravel = useCallback((path: string[]) => {
    if (!path.length) return;
    setActivePath(path);
    setTraveling(true);
    setStep(0);
    setSelected(path[0]);
    setPinFrom(null);
  }, []);

  useEffect(() => {
    if (!traveling || step < 0) return;
    if (step >= activePath.length - 1) {
      const t = setTimeout(() => {
        setTraveling(false);
        setSelected(activePath[activePath.length - 1]);
      }, 900);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s + 1), 700);
    return () => clearTimeout(t);
  }, [traveling, step, activePath]);

  function onPinClick(id: string) {
    if (traveling) return;
    if (!pinFrom) {
      setPinFrom(id);
      setSelected(id);
      setStep(-1);
      return;
    }
    if (pinFrom === id) {
      setPinFrom(null);
      return;
    }
    const path = findPath(pinFrom, id);
    if (path) startTravel(path);
    else {
      setSelected(id);
      setPinFrom(null);
    }
  }

  const nowLabel =
    traveling && step >= 0
      ? PLACES.find(
          (p) => p.id === activePath[Math.min(step, activePath.length - 1)]
        )?.label
      : null;

  const traveler =
    traveling && step >= 0
      ? pos(activePath[Math.min(step, activePath.length - 1)])
      : null;

  return (
    <div className="atlas-hero-map relative h-[440px] w-full overflow-hidden rounded-2xl border border-black/5 shadow-[0_8px_30px_rgba(60,64,67,0.15)] lg:h-[540px] select-none">
      {/* Biomes */}
      <div
        className="pointer-events-none absolute rounded-full opacity-80"
        style={{
          left: "62%",
          top: "26%",
          width: "32%",
          height: "30%",
          background:
            "radial-gradient(circle, rgba(13,122,111,0.2) 0%, transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute rounded-full opacity-90"
        style={{
          left: "24%",
          top: "50%",
          width: "28%",
          height: "24%",
          background:
            "radial-gradient(circle, rgba(165,200,140,0.55) 0%, transparent 70%)",
        }}
      />

      {/* Roads */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        {ROADS.map(([a, b]) => {
          const from = pos(a);
          const to = pos(b);
          const onRoute = routeSet.edges.has(edgeKey(a, b));
          return (
            <g key={`${a}-${b}`}>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="#ffffff"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={onRoute ? "#0d7a6f" : "#12a394"}
                strokeWidth={onRoute ? 0.85 : 0.4}
                strokeLinecap="round"
                opacity={onRoute ? 1 : 0.75}
                strokeDasharray={onRoute ? "2.2 1.6" : undefined}
                className={onRoute ? "hero-route-dash" : undefined}
              />
            </g>
          );
        })}
      </svg>

      {/* Traveler */}
      <AnimatePresence>
        {traveler && (
          <motion.div
            key="gps-dot"
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2"
            initial={false}
            animate={{
              left: `${traveler.x}%`,
              top: `${traveler.y}%`,
              scale: [1, 1.25, 1],
            }}
            transition={{
              left: { type: "spring", stiffness: 120, damping: 18 },
              top: { type: "spring", stiffness: 120, damping: 18 },
              scale: { duration: 0.45 },
            }}
          >
            <div className="relative">
              <div className="absolute inset-0 -m-2 animate-ping rounded-full bg-[#0d7a6f]/40" />
              <div className="h-4 w-4 rounded-full bg-[#0d7a6f] shadow-[0_0_0_6px_rgba(13,122,111,0.28)] ring-2 ring-white" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pins */}
      {PLACES.map((n, i) => {
        const isSel = selected === n.id || hoverId === n.id;
        const isFrom = pinFrom === n.id;
        const onPath = routeSet.ids.has(n.id);
        const isCurrent = routeSet.current === n.id;
        return (
          <motion.button
            key={n.id}
            type="button"
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-pointer outline-none"
            style={{ left: `${n.x}%`, top: `${n.y}%` }}
            initial={{ opacity: 0, y: -12 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: isCurrent || isSel ? 1.08 : 1,
            }}
            transition={{
              delay: 0.12 + i * 0.06,
              type: "spring",
              stiffness: 240,
            }}
            onClick={() => onPinClick(n.id)}
            onMouseEnter={() => setHoverId(n.id)}
            onMouseLeave={() => setHoverId(null)}
            aria-label={n.label}
          >
            <div className="flex flex-col items-center">
              <div
                className="relative mb-1 flex h-9 w-9 items-center justify-center rounded-full text-sm text-white shadow-md transition-shadow"
                style={{
                  background:
                    isCurrent || isFrom
                      ? "#0d7a6f"
                      : onPath
                        ? "#4285f4"
                        : "#0d7a6f",
                  boxShadow:
                    isCurrent || isFrom
                      ? "0 4px 18px rgba(13,122,111,0.5)"
                      : "0 2px 8px rgba(0,0,0,0.18)",
                }}
              >
                <span className="leading-none">{n.emoji}</span>
                <span
                  className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45"
                  style={{
                    background: isCurrent || isFrom ? "#0d7a6f" : "#0d7a6f",
                  }}
                />
              </div>
              <div
                className="whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm transition-colors"
                style={{
                  background:
                    isCurrent || isFrom
                      ? "#0d7a6f"
                      : "rgba(255,255,255,0.95)",
                  color: isCurrent || isFrom ? "white" : "#202124",
                  border:
                    isCurrent || isFrom
                      ? "none"
                      : "1px solid rgba(0,0,0,0.06)",
                }}
              >
                {n.label}
              </div>
            </div>
          </motion.button>
        );
      })}

      {/* Interactive route pill (the white card with dashes) */}
      <div className="absolute left-3 top-3 z-30">
        <InteractiveRouteBar
          places={PLACES}
          journeys={JOURNEYS}
          traveling={traveling}
          step={Math.max(step, 0)}
          activePath={activePath}
          onNavigate={(from, to) => {
            const path = findPath(from, to);
            if (path) startTravel(path);
          }}
          onPickJourney={(index) => {
            const j = JOURNEYS[index];
            startTravel(j.path);
          }}
          onReset={() => {
            setStep(-1);
            setPinFrom(null);
            setTraveling(false);
            setSelected("pay");
            setActivePath(JOURNEYS[0].path);
          }}
        />
      </div>

      {/* Now-passing HUD while traveling */}
      {traveling && nowLabel && (
        <div className="absolute bottom-16 left-1/2 z-30 w-[min(100%-1.5rem,280px)] -translate-x-1/2 rounded-2xl border border-black/5 bg-white/95 px-4 py-3 text-center shadow-lg backdrop-blur">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#0d7a6f]">
            Now passing
          </p>
          <p className="font-brand text-lg font-extrabold text-[#202124]">
            {nowLabel}
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-[#5f6368]">
            Step {Math.min(step + 1, activePath.length)} / {activePath.length}
          </p>
        </div>
      )}

      {!traveling && pinFrom && (
        <div className="absolute bottom-16 left-1/2 z-30 -translate-x-1/2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-[#202124] shadow-md">
          From {pos(pinFrom).label} — tap a destination
        </div>
      )}

      {/* Footer chrome */}
      <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-20 flex items-end justify-between">
        <div className="rounded-lg bg-white/90 px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wider text-[#5f6368] shadow-sm">
          Architecture · not folders
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-white/90 px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wider text-[#5f6368] shadow-sm">
            Pan · zoom · navigate
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-xs font-bold text-[#202124] shadow-md">
            N
          </div>
        </div>
      </div>
    </div>
  );
}
