"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Navigation2,
  MapPin,
  Flag,
  X,
  ChevronRight,
  Play,
} from "lucide-react";

export type RoutePlace = {
  id: string;
  label: string;
  emoji: string;
};

type Props = {
  places: RoutePlace[];
  journeys: { from: string; to: string; path: string[]; label: string }[];
  traveling: boolean;
  step: number;
  activePath: string[];
  onNavigate: (fromId: string, toId: string) => void;
  onPickJourney: (index: number) => void;
  onReset: () => void;
};

export function InteractiveRouteBar({
  places,
  journeys,
  traveling,
  step,
  activePath,
  onNavigate,
  onPickJourney,
  onReset,
}: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"search" | "directions">("directions");
  const [fromId, setFromId] = useState("pay");
  const [toId, setToId] = useState("orders");
  const [fromQ, setFromQ] = useState("");
  const [toQ, setToQ] = useState("");
  const [focusField, setFocusField] = useState<"from" | "to" | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setFocusField(null);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const fromPlace = places.find((p) => p.id === fromId);
  const toPlace = places.find((p) => p.id === toId);

  function filterPlaces(q: string, exclude?: string) {
    const qq = q.trim().toLowerCase();
    return places.filter((p) => {
      if (p.id === exclude) return false;
      if (!qq) return true;
      return p.label.toLowerCase().includes(qq) || p.id.includes(qq);
    });
  }

  const fromSuggestions = filterPlaces(fromQ, toId);
  const toSuggestions = filterPlaces(toQ, fromId);

  const hops = Math.max(activePath.length - 1, 0);
  const dashCount = 4;
  const litDashes =
    traveling && hops > 0
      ? Math.min(dashCount, Math.floor(((step + 1) / activePath.length) * dashCount))
      : traveling
        ? 1
        : 0;

  function go() {
    if (!fromId || !toId || fromId === toId) return;
    onNavigate(fromId, toId);
    setOpen(true);
    setMode("directions");
  }

  const summary =
    fromPlace && toPlace
      ? `${fromPlace.label} → ${toPlace.label}`
      : "Choose a route";

  return (
    <div ref={rootRef} className="pointer-events-auto w-full max-w-[340px]">
      {/* Collapsed Maps pill — the white card with live route dashes */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group flex w-full items-center gap-3 rounded-2xl border border-black/5 bg-white px-3.5 py-3 text-left shadow-[0_2px_12px_rgba(60,64,67,0.18)] transition-shadow hover:shadow-[0_4px_20px_rgba(60,64,67,0.22)]"
        aria-expanded={open}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e6f5f3] text-[#0d7a6f]">
          {mode === "directions" ? (
            <Navigation2 className="h-4 w-4" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-[#202124]">
            {traveling ? "Navigating…" : open ? "Directions" : summary}
          </span>
          <span className="mt-1 flex items-center gap-1">
            {Array.from({ length: dashCount }).map((_, i) => (
              <motion.span
                key={i}
                className="h-1.5 w-4 rounded-sm"
                animate={{
                  backgroundColor:
                    i < litDashes
                      ? "#0d7a6f"
                      : traveling
                        ? "#c5d9b8"
                        : "#0d7a6f",
                  opacity: i < litDashes ? 1 : traveling ? 0.45 : 0.85,
                  scale: traveling && i === litDashes - 1 ? [1, 1.15, 1] : 1,
                }}
                transition={{
                  duration: 0.35,
                  repeat: traveling && i === litDashes - 1 ? Infinity : 0,
                  repeatDelay: 0.4,
                }}
              />
            ))}
            {traveling && activePath.length > 0 && (
              <span className="ml-1 font-mono text-[10px] text-[#5f6368]">
                {Math.min(step + 1, activePath.length)}/{activePath.length}
              </span>
            )}
          </span>
        </span>

        <ChevronRight
          className={`h-4 w-4 shrink-0 text-[#5f6368] transition-transform ${
            open ? "rotate-90" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="overflow-hidden"
          >
            <div className="mt-2 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_4px_24px_rgba(60,64,67,0.2)]">
              {/* Mode tabs */}
              <div className="flex border-b border-[#c5ddd6]">
                <button
                  type="button"
                  onClick={() => setMode("directions")}
                  className={`flex-1 px-3 py-2.5 text-xs font-semibold ${
                    mode === "directions"
                      ? "border-b-2 border-[#0d7a6f] text-[#0d7a6f]"
                      : "text-[#5f6368]"
                  }`}
                >
                  Directions
                </button>
                <button
                  type="button"
                  onClick={() => setMode("search")}
                  className={`flex-1 px-3 py-2.5 text-xs font-semibold ${
                    mode === "search"
                      ? "border-b-2 border-[#0d7a6f] text-[#0d7a6f]"
                      : "text-[#5f6368]"
                  }`}
                >
                  Search place
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onReset();
                  }}
                  className="px-3 text-[#5f6368] hover:text-[#202124]"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {mode === "directions" ? (
                <div className="space-y-2 p-3">
                  {/* From */}
                  <div className="relative">
                    <label className="mb-1 flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-[#5f6368]">
                      <MapPin className="h-3 w-3 text-[#0d7a6f]" /> From
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setFocusField(focusField === "from" ? null : "from");
                        setFromQ("");
                      }}
                      className="flex w-full items-center gap-2 rounded-xl bg-[#f1f3f4] px-3 py-2.5 text-left text-sm font-medium text-[#202124] hover:bg-[#e8eaed]"
                    >
                      <span>{fromPlace?.emoji}</span>
                      <span className="truncate">
                        {fromPlace?.label || "Choose start"}
                      </span>
                    </button>
                    {focusField === "from" && (
                      <ul className="absolute z-20 mt-1 max-h-36 w-full overflow-y-auto rounded-xl border border-[#c5ddd6] bg-white shadow-lg">
                        {fromSuggestions.map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[#f1f3f4]"
                              onClick={() => {
                                setFromId(p.id);
                                setFocusField(null);
                              }}
                            >
                              <span>{p.emoji}</span>
                              {p.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* To */}
                  <div className="relative">
                    <label className="mb-1 flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-[#5f6368]">
                      <Flag className="h-3 w-3 text-[#d93025]" /> To
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setFocusField(focusField === "to" ? null : "to");
                        setToQ("");
                      }}
                      className="flex w-full items-center gap-2 rounded-xl bg-[#f1f3f4] px-3 py-2.5 text-left text-sm font-medium text-[#202124] hover:bg-[#e8eaed]"
                    >
                      <span>{toPlace?.emoji}</span>
                      <span className="truncate">
                        {toPlace?.label || "Choose destination"}
                      </span>
                    </button>
                    {focusField === "to" && (
                      <ul className="absolute z-20 mt-1 max-h-36 w-full overflow-y-auto rounded-xl border border-[#c5ddd6] bg-white shadow-lg">
                        {toSuggestions.map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[#f1f3f4]"
                              onClick={() => {
                                setToId(p.id);
                                setFocusField(null);
                              }}
                            >
                              <span>{p.emoji}</span>
                              {p.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Quick routes */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {journeys.map((j, i) => (
                      <button
                        key={j.label}
                        type="button"
                        disabled={traveling}
                        onClick={() => {
                          setFromId(j.from);
                          setToId(j.to);
                          onPickJourney(i);
                        }}
                        className="rounded-full bg-[#e6f5f3] px-2.5 py-1 text-[10px] font-semibold text-[#0d7a6f] hover:bg-[#d4ebe6] disabled:opacity-50"
                      >
                        {j.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={go}
                    disabled={traveling || fromId === toId}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-[#0d7a6f] py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#0a6b5f] disabled:opacity-50"
                  >
                    <Play className="h-3.5 w-3.5 fill-white" />
                    {traveling ? "On the road…" : "Navigate"}
                  </button>
                </div>
              ) : (
                <div className="p-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0d7a6f]" />
                    <input
                      autoFocus
                      value={toQ}
                      onChange={(e) => setToQ(e.target.value)}
                      placeholder="Search Authentication, Payment…"
                      className="w-full rounded-xl border-0 bg-[#f1f3f4] py-2.5 pl-10 pr-3 text-sm outline-none ring-1 ring-transparent focus:bg-white focus:ring-[#0d7a6f]"
                    />
                  </div>
                  <ul className="mt-2 max-h-44 overflow-y-auto">
                    {filterPlaces(toQ).map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-[#f1f3f4]"
                          onClick={() => {
                            setToId(p.id);
                            setMode("directions");
                            if (!fromId) setFromId("auth");
                          }}
                        >
                          <span className="text-base">{p.emoji}</span>
                          <span className="font-medium text-[#202124]">
                            {p.label}
                          </span>
                          <span className="ml-auto font-mono text-[9px] uppercase text-[#5f6368]">
                            District
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
