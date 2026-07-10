"use client";

import { useMemo, useState } from "react";
import {
  Navigation,
  ArrowRight,
  X,
  MapPin,
  Flag,
  Route,
} from "lucide-react";
import type { AtlasGraph } from "@/lib/graph-store";
import { KIND_META } from "@/lib/graph-store";
import {
  allLandmarks,
  findLandmarks,
  findRoutes,
  resolveLandmark,
  suggestDestinations,
  type NavPath,
} from "@/lib/navigation";

type Props = {
  graph: AtlasGraph;
  activePath: NavPath | null;
  alternateRoutes: NavPath[];
  animating: boolean;
  animStep: number;
  initialFromId?: string | null;
  initialToId?: string | null;
  onNavigate: (path: NavPath, all: NavPath[]) => void;
  onSelectRoute: (path: NavPath) => void;
  onClear: () => void;
};

function SuggestionRow({
  n,
  onPick,
}: {
  n: AtlasGraph["nodes"][number];
  onPick: () => void;
}) {
  const meta = KIND_META[n.kind] || KIND_META.module;
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-fog"
      onClick={onPick}
    >
      <span className="shrink-0 text-sm leading-none">
        {n.emoji || meta.icon}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium text-ink">
        {n.label}
      </span>
      <span
        className="shrink-0 font-mono text-[9px] uppercase tracking-wider"
        style={{ color: meta.color }}
      >
        {meta.label}
      </span>
    </button>
  );
}

export function DirectionsPanel({
  graph,
  activePath,
  alternateRoutes,
  animating,
  animStep,
  initialFromId,
  initialToId,
  onNavigate,
  onSelectRoute,
  onClear,
}: Props) {
  const [fromId, setFromId] = useState(initialFromId || "");
  const [toId, setToId] = useState(initialToId || "");
  const [fromQuery, setFromQuery] = useState(() => {
    if (!initialFromId) return "";
    return graph.nodes.find((n) => n.id === initialFromId)?.label || "";
  });
  const [toQuery, setToQuery] = useState(() => {
    if (!initialToId) return "";
    return graph.nodes.find((n) => n.id === initialToId)?.label || "";
  });
  const [error, setError] = useState<string | null>(null);

  const fromSuggestions = useMemo(() => {
    if (fromQuery.trim().length < 1) return allLandmarks(graph).slice(0, 12);
    return findLandmarks(graph, fromQuery);
  }, [graph, fromQuery]);

  const toSuggestions = useMemo(() => {
    if (toQuery.trim().length >= 1) return findLandmarks(graph, toQuery);
    if (fromId) return suggestDestinations(graph, fromId);
    return allLandmarks(graph).slice(0, 12);
  }, [graph, fromId, toQuery]);

  function go() {
    setError(null);
    const fromNode = resolveLandmark(graph, fromQuery, fromId || undefined);
    const toNode = resolveLandmark(graph, toQuery, toId || undefined);

    if (!fromNode || !toNode) {
      setError(
        "Pick any landmark — district, module, library, or function."
      );
      return;
    }

    setFromId(fromNode.id);
    setToId(toNode.id);
    setFromQuery(fromNode.label);
    setToQuery(toNode.label);

    const routes = findRoutes(graph, fromNode.id, toNode.id, 3);
    if (!routes.length) {
      setError(
        `No route between ${fromNode.label} and ${toNode.label} yet.`
      );
      return;
    }
    onNavigate(routes[0], routes);
  }

  const stepLabels =
    activePath?.nodeIds.map(
      (id) => graph.nodes.find((n) => n.id === id)?.label || id
    ) ?? [];

  return (
    <aside className="absolute left-4 top-4 z-20 flex w-[min(100%-2rem,340px)] flex-col border border-line bg-white/95 shadow-lg backdrop-blur">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-teal" />
          <span className="font-display text-sm font-bold text-ink">
            Directions
          </span>
        </div>
        {activePath && (
          <button
            type="button"
            onClick={onClear}
            className="text-muted hover:text-ink"
            aria-label="Clear route"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <p className="border-b border-line px-4 py-2 text-[11px] text-muted">
        Use real GitHub names — e.g. <code>TEST.properties</code>, not renamed
        labels.
      </p>

      <div className="space-y-3 px-4 py-3">
        <div>
          <label className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted">
            <MapPin className="h-3 w-3" /> From
          </label>
          <input
            value={fromQuery}
            onChange={(e) => {
              setFromQuery(e.target.value);
              setFromId("");
            }}
            placeholder="TEST.properties, Login.tsx, run()…"
            className="w-full border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-teal"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                go();
              }
            }}
          />
          {!fromId && (
            <ul className="mt-1 max-h-36 overflow-y-auto border border-line bg-white">
              {fromSuggestions.map((n) => (
                <li key={n.id}>
                  <SuggestionRow
                    n={n}
                    onPick={() => {
                      setFromId(n.id);
                      setFromQuery(n.label);
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted">
            <Flag className="h-3 w-3" /> To
          </label>
          <input
            value={toQuery}
            onChange={(e) => {
              setToQuery(e.target.value);
              setToId("");
            }}
            placeholder="Module, library, function…"
            className="w-full border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-teal"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                go();
              }
            }}
          />
          {!toId && (
            <ul className="mt-1 max-h-36 overflow-y-auto border border-line bg-white">
              {toSuggestions.map((n) => (
                <li key={n.id}>
                  <SuggestionRow
                    n={n}
                    onPick={() => {
                      setToId(n.id);
                      setToQuery(n.label);
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}

        <button
          type="button"
          onClick={go}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-teal px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-bright"
        >
          Navigate
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {alternateRoutes.length > 0 && (
        <div className="border-t border-line px-4 py-3">
          <div className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted">
            <Route className="h-3 w-3" /> Routes
          </div>
          <div className="space-y-1.5">
            {alternateRoutes.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onSelectRoute(r)}
                className={`flex w-full items-center justify-between border px-3 py-2 text-left text-xs transition-colors ${
                  activePath?.id === r.id
                    ? "border-route bg-route/10 text-ink"
                    : "border-line hover:border-teal"
                }`}
              >
                <span className="font-medium">{r.label}</span>
                <span className="font-mono text-muted">
                  {r.hops} hops · ~{r.cost + 5}ms
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {activePath && stepLabels.length > 0 && (
        <div className="max-h-48 overflow-y-auto border-t border-line px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted">
            {animating ? "Navigating…" : "Turn-by-turn"}
          </p>
          <ol className="space-y-0">
            {stepLabels.map((label, i) => {
              const lit = animating ? i <= animStep : true;
              const current = animating && i === animStep;
              const nodeId = activePath.nodeIds[i];
              const kind = graph.nodes.find((n) => n.id === nodeId)?.kind;
              const meta = kind ? KIND_META[kind] : null;
              return (
                <li key={`${label}-${i}`} className="flex gap-2">
                  <div className="flex w-4 flex-col items-center">
                    <span
                      className={`mt-1 h-2 w-2 rounded-full ${
                        current
                          ? "bg-route ring-2 ring-route/40"
                          : lit
                            ? "bg-teal"
                            : "bg-line"
                      }`}
                    />
                    {i < stepLabels.length - 1 && (
                      <span
                        className={`w-px flex-1 ${
                          lit ? "bg-teal/40" : "bg-line"
                        }`}
                      />
                    )}
                  </div>
                  <div className="pb-3">
                    <span
                      className={`text-sm ${
                        current
                          ? "font-semibold text-ink"
                          : lit
                            ? "text-ink-soft"
                            : "text-muted/50"
                      }`}
                    >
                      {label}
                    </span>
                    {meta && (
                      <span
                        className="ml-2 font-mono text-[9px] uppercase"
                        style={{ color: meta.color }}
                      >
                        {meta.label}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </aside>
  );
}
