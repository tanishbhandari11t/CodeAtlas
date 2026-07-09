"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  MarkerType,
  BackgroundVariant,
} from "@xyflow/react";
import {
  Search,
  X,
  Map as MapIcon,
  AlertCircle,
  Compass,
  Eye,
  ChevronRight,
  Home,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  loadGraph,
  KIND_META,
  type AtlasGraph,
  type AtlasNode,
} from "@/lib/graph-store";
import {
  findLandmarks,
  findRoutes,
  type NavPath,
} from "@/lib/navigation";
import { AtlasFlowNode, type AtlasNodeData } from "@/components/AtlasNode";
import { NodeDetailPanel } from "@/components/NodeDetailPanel";
import { ImpactModal } from "@/components/ImpactModal";
import { DirectionsPanel } from "@/components/DirectionsPanel";

const nodeTypes = { atlas: AtlasFlowNode };

type MapMode = "explore" | "directions";
/** 0 = city (districts only), 1 = inside a district (modules), 2 = streets (functions) */
type ZoomLevel = 0 | 1 | 2;

function healthFor(n: AtlasNode): "healthy" | "medium" | "critical" {
  if (n.complexity === "High") return "critical";
  if (n.complexity === "Medium") return "medium";
  return "healthy";
}

/**
 * Journey view: open the whole city enough to see every stop on the route.
 * Includes path nodes + their parent districts so the camera can travel.
 */
function journeySlice(
  graph: AtlasGraph,
  pathNodeIds: string[]
): {
  nodes: AtlasNode[];
  edgeFilter: (e: {
    source: string;
    target: string;
    label: string;
    id: string;
  }) => boolean;
} {
  const pathSet = new Set(pathNodeIds);
  const showIds = new Set<string>(pathNodeIds);

  // Pull in parent districts so the city context is visible
  for (const id of pathNodeIds) {
    const n = graph.nodes.find((x) => x.id === id);
    if (n?.parentId) showIds.add(n.parentId);
    if (n?.kind === "district") {
      // lightly include sibling modules that sit on the path only
    }
  }

  // Always include all districts as faded city backdrop? No — keep focused on route + parents
  // Also include every district the path touches
  for (const id of [...showIds]) {
    const n = graph.nodes.find((x) => x.id === id);
    if (n?.parentId) showIds.add(n.parentId);
  }

  const nodes = graph.nodes.filter((n) => showIds.has(n.id));
  const ids = new Set(nodes.map((n) => n.id));

  return {
    nodes,
    edgeFilter: (e) => {
      if (!ids.has(e.source) || !ids.has(e.target)) return false;
      // Prefer path edges; also show contains between district↔module on path
      if (pathSet.has(e.source) && pathSet.has(e.target)) return true;
      if (e.label === "contains" || e.label === "connects" || e.label === "uses")
        return true;
      return false;
    },
  };
}

function visibleSlice(
  graph: AtlasGraph,
  zoom: ZoomLevel,
  focusDistrictId: string | null,
  focusModuleId: string | null,
  journeyPathIds: string[] | null
): {
  nodes: AtlasNode[];
  edgeFilter: (e: {
    source: string;
    target: string;
    label: string;
    id: string;
  }) => boolean;
} {
  // GPS journey overrides zoom — travel across the city
  if (journeyPathIds && journeyPathIds.length > 0) {
    return journeySlice(graph, journeyPathIds);
  }

  if (zoom === 0) {
    const districts = graph.nodes.filter((n) => n.kind === "district");
    const ids = new Set(districts.map((d) => d.id));
    return {
      nodes: districts,
      edgeFilter: (e) =>
        ids.has(e.source) && ids.has(e.target) && e.label === "connects",
    };
  }

  if (zoom === 1 && focusDistrictId) {
    const district = graph.nodes.find((n) => n.id === focusDistrictId);
    const children = graph.nodes.filter(
      (n) => n.parentId === focusDistrictId && n.level === 1
    );
    const show = district ? [district, ...children] : children;
    const ids = new Set(show.map((n) => n.id));
    return {
      nodes: show,
      edgeFilter: (e) =>
        ids.has(e.source) && ids.has(e.target) && e.label !== "defines",
    };
  }

  if (zoom === 2 && focusModuleId) {
    const mod = graph.nodes.find((n) => n.id === focusModuleId);
    const fns = graph.nodes.filter(
      (n) => n.parentId === focusModuleId && n.kind === "function"
    );
    const show = mod ? [mod, ...fns] : fns;
    const ids = new Set(show.map((n) => n.id));
    return {
      nodes: show,
      edgeFilter: (e) => ids.has(e.source) && ids.has(e.target),
    };
  }

  const districts = graph.nodes.filter((n) => n.kind === "district");
  return {
    nodes: districts,
    edgeFilter: (e) => e.label === "connects",
  };
}

/**
 * Re-layout the *visible* slice so expand never stacks cards on top of each other.
 * Stored graph.layout is only a fallback for city / journey views.
 */
function layoutVisibleNodes(
  atlasNodes: AtlasNode[],
  graph: AtlasGraph,
  zoom: ZoomLevel,
  focusModuleId: string | null
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};

  // Street view: parent on top, functions in a spaced grid below
  if (zoom === 2 && focusModuleId) {
    const parent = atlasNodes.find((n) => n.id === focusModuleId);
    const fns = atlasNodes.filter(
      (n) => n.kind === "function" && n.parentId === focusModuleId
    );
    const COL_W = 260;
    const ROW_H = 120;
    const cols = Math.min(Math.max(fns.length, 1), 4);
    const originX = 400;
    const originY = 40;

    if (parent) {
      positions[parent.id] = { x: originX - 90, y: originY };
    }
    fns.forEach((f, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      positions[f.id] = {
        x: originX + (col - (cols - 1) / 2) * COL_W - 80,
        y: originY + 160 + row * ROW_H,
      };
    });
    return positions;
  }

  // District view: modules in a clean grid
  if (zoom === 1) {
    const districts = atlasNodes.filter((n) => n.kind === "district");
    const modules = atlasNodes.filter(
      (n) => n.kind !== "district" && n.kind !== "function"
    );
    const COL_W = 280;
    const ROW_H = 140;
    const cols = Math.min(Math.max(modules.length, 1), 3);

    districts.forEach((d, i) => {
      positions[d.id] = { x: 200 + i * 320, y: 20 };
    });
    modules.forEach((m, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      positions[m.id] = {
        x: 120 + col * COL_W,
        y: 160 + row * ROW_H,
      };
    });
    // externals / leftovers
    atlasNodes.forEach((n) => {
      if (!positions[n.id]) {
        const fallback = graph.layout[n.id];
        positions[n.id] = fallback ?? { x: 100, y: 100 };
      }
    });
    return positions;
  }

  // City / journey: use stored layout with light de-overlap nudge
  atlasNodes.forEach((n, i) => {
    const base = graph.layout[n.id] ?? {
      x: (i % 5) * 280,
      y: Math.floor(i / 5) * 160,
    };
    positions[n.id] = { ...base };
  });
  return positions;
}

function toFlowNodes(
  atlasNodes: AtlasNode[],
  graph: AtlasGraph,
  zoom: ZoomLevel = 0,
  focusModuleId: string | null = null
): Node[] {
  const positions = layoutVisibleNodes(atlasNodes, graph, zoom, focusModuleId);
  return atlasNodes.map((n) => {
    const pos = positions[n.id] ?? { x: 0, y: 0 };
    const childCount = n.childIds?.length || 0;
    const data: AtlasNodeData = {
      label: n.label,
      kind: n.kind,
      dimmed: false,
      onRoute: false,
      selected: false,
      health: healthFor(n),
      emoji: n.emoji,
      subtitle:
        n.kind === "district"
          ? `${childCount} files · click to enter`
          : n.kind === "function"
            ? n.file
              ? `in ${n.file.split("/").pop()}`
              : undefined
            : n.file && n.file !== n.label
              ? n.file
              : n.functions.length
                ? `${n.functions.length} symbols · double-click streets`
                : undefined,
    };
    return {
      id: n.id,
      type: "atlas",
      position: pos,
      data,
      draggable: true,
    };
  });
}

function toFlowEdges(
  graph: AtlasGraph,
  filter: (e: { source: string; target: string; label: string; id: string }) => boolean
): Edge[] {
  return graph.edges.filter(filter).map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label === "contains" || e.label === "defines" ? undefined : e.label,
    className: "edge-normal",
    animated: false,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 14,
      height: 14,
      color: "#9bbfb4",
    },
    labelStyle: { fontSize: 9, fill: "#5a7380" },
    labelBgStyle: { fill: "#eef6f3", fillOpacity: 0.9 },
  }));
}

function MapCanvas({ graph }: { graph: AtlasGraph }) {
  const { fitView, setCenter, getNode } = useReactFlow();
  const [mode, setMode] = useState<MapMode>("explore");
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(0);
  const [focusDistrictId, setFocusDistrictId] = useState<string | null>(null);
  const [focusModuleId, setFocusModuleId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AtlasNode | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [impactNode, setImpactNode] = useState<AtlasNode | null>(null);
  const [navFromId, setNavFromId] = useState<string | null>(null);
  const [navToId, setNavToId] = useState<string | null>(null);

  const [activePath, setActivePath] = useState<NavPath | null>(null);
  const [alternateRoutes, setAlternateRoutes] = useState<NavPath[]>([]);
  const [animating, setAnimating] = useState(false);
  const [animStep, setAnimStep] = useState(0);
  const [journeyActive, setJourneyActive] = useState(false);
  const [nowPlaying, setNowPlaying] = useState<string | null>(null);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const journeyReady = useRef(false);

  const journeyPathIds = journeyActive && activePath ? activePath.nodeIds : null;

  const slice = useMemo(
    () =>
      visibleSlice(
        graph,
        zoomLevel,
        focusDistrictId,
        focusModuleId,
        journeyPathIds
      ),
    [graph, zoomLevel, focusDistrictId, focusModuleId, journeyPathIds]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(
    toFlowNodes(slice.nodes, graph, zoomLevel, focusModuleId)
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    toFlowEdges(graph, (e) => slice.edgeFilter(e))
  );

  const nodeById = useMemo(() => {
    const m = new Map<string, AtlasNode>();
    graph.nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [graph]);

  // Rebuild graph when zoom / journey changes
  useEffect(() => {
    const s = visibleSlice(
      graph,
      zoomLevel,
      focusDistrictId,
      focusModuleId,
      journeyPathIds
    );
    setNodes(toFlowNodes(s.nodes, graph, zoomLevel, focusModuleId));
    setEdges(toFlowEdges(graph, (e) => s.edgeFilter(e)));

    // When starting a journey: fit the whole route, then mark ready for camera travel
    if (journeyPathIds && journeyPathIds.length) {
      journeyReady.current = false;
      const t = setTimeout(() => {
        fitView({
          padding: 0.35,
          duration: 600,
          nodes: journeyPathIds.map((id) => ({ id })),
        });
        journeyReady.current = true;
      }, 100);
      return () => clearTimeout(t);
    }

    const t = setTimeout(() => fitView({ padding: 0.3, duration: 400 }), 80);
    return () => clearTimeout(t);
  }, [
    graph,
    zoomLevel,
    focusDistrictId,
    focusModuleId,
    journeyPathIds,
    setNodes,
    setEdges,
    fitView,
  ]);

  // Fly camera to current GPS step
  useEffect(() => {
    if (!animating || !activePath) return;
    const id = activePath.nodeIds[animStep];
    if (!id) return;
    setNowPlaying(id);

    const fly = () => {
      const rfNode = getNode(id);
      if (rfNode) {
        const w = rfNode.measured?.width ?? 160;
        const h = rfNode.measured?.height ?? 60;
        setCenter(rfNode.position.x + w / 2, rfNode.position.y + h / 2, {
          zoom: 1.15,
          duration: 550,
        });
      } else {
        const layout = graph.layout[id];
        if (layout) {
          setCenter(layout.x + 80, layout.y + 30, { zoom: 1.15, duration: 550 });
        }
      }
    };

    // Wait a tick so nodes exist after journey slice rebuild
    const t = setTimeout(fly, journeyReady.current ? 50 : 200);
    return () => clearTimeout(t);
  }, [animStep, animating, activePath, getNode, setCenter, graph.layout]);

  // Highlight overlays — current step glows brightest
  useEffect(() => {
    const routeNodeIds = new Set<string>();
    const routeEdgeIds = new Set<string>();
    const currentId =
      animating && activePath ? activePath.nodeIds[animStep] : null;

    if (activePath) {
      const maxNode = animating
        ? Math.min(animStep + 1, activePath.nodeIds.length)
        : activePath.nodeIds.length;
      activePath.nodeIds.slice(0, maxNode).forEach((id) => routeNodeIds.add(id));
      const maxEdge = animating
        ? Math.min(animStep, activePath.edgeIds.length)
        : activePath.edgeIds.length;
      activePath.edgeIds.slice(0, maxEdge).forEach((id) => routeEdgeIds.add(id));
    } else if (hoverId && mode === "explore") {
      routeNodeIds.add(hoverId);
      graph.edges.forEach((e) => {
        if (e.source === hoverId || e.target === hoverId) {
          routeEdgeIds.add(e.id);
          routeNodeIds.add(e.source);
          routeNodeIds.add(e.target);
        }
      });
    }

    const filtering =
      activePath !== null || (mode === "explore" && hoverId !== null);

    setNodes((current) =>
      current.map((node) => {
        const onRoute = routeNodeIds.has(node.id);
        const isCurrent = currentId === node.id;
        const dimmed = filtering && !onRoute;
        const nextSelected = selected?.id === node.id || isCurrent;
        const prev = node.data as AtlasNodeData;
        if (
          prev.dimmed === dimmed &&
          prev.onRoute === onRoute &&
          prev.selected === nextSelected
        ) {
          return node;
        }
        return {
          ...node,
          data: { ...prev, dimmed, onRoute: onRoute || isCurrent, selected: nextSelected },
        };
      })
    );

    setEdges((current) =>
      current.map((edge) => {
        const onRoute = routeEdgeIds.has(edge.id);
        const dimmed = filtering && !onRoute;
        return {
          ...edge,
          className: onRoute ? "edge-route" : dimmed ? "edge-dim" : "edge-normal",
          animated: onRoute,
          style: { opacity: dimmed ? 0.06 : 1 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 14,
            height: 14,
            color: onRoute ? "#0d7a6f" : dimmed ? "#c5ddd6" : "#9bbfb4",
          },
        };
      })
    );
  }, [
    activePath,
    animating,
    animStep,
    hoverId,
    mode,
    selected,
    graph,
    setNodes,
    setEdges,
  ]);

  const stopAnimation = useCallback(() => {
    if (animRef.current) {
      clearInterval(animRef.current);
      animRef.current = null;
    }
    setAnimating(false);
  }, []);

  const startAnimation = useCallback(
    (path: NavPath) => {
      stopAnimation();
      setAnimStep(0);
      setAnimating(true);
      setNowPlaying(path.nodeIds[0] || null);
      let step = 0;
      animRef.current = setInterval(() => {
        step += 1;
        setAnimStep(step);
        if (step >= path.nodeIds.length - 1) {
          stopAnimation();
          setAnimStep(path.nodeIds.length - 1);
          // After arrival: fit the full completed route
          setTimeout(() => {
            fitView({
              padding: 0.3,
              duration: 700,
              nodes: path.nodeIds.map((id) => ({ id })),
            });
          }, 400);
        }
      }, 900);
    },
    [stopAnimation, fitView]
  );

  useEffect(() => () => stopAnimation(), [stopAnimation]);

  const clearRoute = useCallback(() => {
    stopAnimation();
    setActivePath(null);
    setAlternateRoutes([]);
    setAnimStep(0);
    setJourneyActive(false);
    setNowPlaying(null);
  }, [stopAnimation]);

  const enterDistrict = (id: string) => {
    setJourneyActive(false);
    setFocusDistrictId(id);
    setFocusModuleId(null);
    setZoomLevel(1);
    setSelected(nodeById.get(id) || null);
    clearRoute();
  };

  const enterModule = (id: string) => {
    setJourneyActive(false);
    setFocusModuleId(id);
    setZoomLevel(2);
    setSelected(nodeById.get(id) || null);
    clearRoute();
  };

  const goCity = () => {
    setJourneyActive(false);
    setZoomLevel(0);
    setFocusDistrictId(null);
    setFocusModuleId(null);
    setSelected(null);
    clearRoute();
  };

  const goDistrict = () => {
    if (!focusDistrictId) return;
    setJourneyActive(false);
    setZoomLevel(1);
    setFocusModuleId(null);
  };

  /** ⭐ Killer feature: open city + travel the route like GPS */
  const handleNavigate = useCallback(
    (path: NavPath, all: NavPath[]) => {
      setMode("directions");
      setSelected(null);
      setHoverId(null);
      // Leave district drill-down — open the city for travel
      setZoomLevel(0);
      setFocusDistrictId(null);
      setFocusModuleId(null);
      setAlternateRoutes(all);
      setActivePath(path);
      setJourneyActive(true);
      // Start GPS after the journey slice has painted
      setTimeout(() => startAnimation(path), 350);
    },
    [startAnimation]
  );

  const runSearch = () => {
    const hits = findLandmarks(graph, query);
    if (!hits.length) return;
    const hit = hits[0];

    // Search = navigate to landmark (GPS), not a file list
    const dest =
      graph.nodes.find(
        (n) =>
          n.id !== hit.id &&
          (n.kind === "district" ||
            n.kind === "database" ||
            n.kind === "external" ||
            n.kind === "function" ||
            n.level === 1)
      ) || graph.nodes.find((n) => n.id !== hit.id);

    if (dest) {
      const routes = findRoutes(graph, hit.id, dest.id, 3);
      if (routes.length) {
        setQuery(hit.label);
        handleNavigate(routes[0], routes);
        return;
      }
    }

    if (hit.kind === "district") {
      enterDistrict(hit.id);
      return;
    }
    if (hit.level === 1 && hit.parentId) {
      setJourneyActive(false);
      setFocusDistrictId(hit.parentId);
      setZoomLevel(1);
      setSelected(hit);
      return;
    }
    if (hit.kind === "function" && hit.parentId) {
      const mod = nodeById.get(hit.parentId);
      if (mod?.parentId) setFocusDistrictId(mod.parentId);
      setFocusModuleId(hit.parentId);
      setZoomLevel(2);
      setSelected(hit);
    }
  };

  const districtLabel =
    focusDistrictId && nodeById.get(focusDistrictId)?.label;
  const moduleLabel = focusModuleId && nodeById.get(focusModuleId)?.label;
  const districtCount = graph.nodes.filter((n) => n.kind === "district").length;
  const nowLabel = nowPlaying
    ? nodeById.get(nowPlaying)?.label || nowPlaying
    : null;
  const nowDesc = nowPlaying
    ? nodeById.get(nowPlaying)?.description
    : null;

  return (
    <div className="relative flex h-dvh flex-col bg-[#eef6f3]">
      <header className="z-10 flex shrink-0 items-center gap-3 border-b border-line bg-white/95 px-4 py-3 backdrop-blur">
        <Link
          href="/"
          className="font-brand shrink-0 text-xl font-extrabold text-ink"
        >
          CodeAtlas
        </Link>
        <div className="hidden min-w-0 items-center gap-2 border-l border-line pl-3 sm:flex">
          <MapIcon className="h-3.5 w-3.5 shrink-0 text-teal" />
          <span className="truncate font-mono text-xs text-muted">
            {graph.rootLabel || graph.repo}
          </span>
        </div>

        <form
          className="mx-auto flex w-full max-w-md items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            runSearch();
          }}
        >
          <div className="relative flex flex-1 items-center">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a file — TEST.properties, environment.py…"
              className="w-full border border-line bg-paper py-2 pl-9 pr-9 text-sm outline-none focus:border-teal"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 text-muted hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="rounded-md bg-teal px-3 py-2 text-sm font-semibold text-white hover:bg-teal-bright"
          >
            Go
          </button>
        </form>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setMode("directions")}
            className={`rounded px-2 py-1.5 text-xs font-medium ${
              mode === "directions"
                ? "bg-teal/10 text-teal"
                : "text-muted hover:text-ink"
            }`}
            title="Directions"
          >
            <Compass className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              clearRoute();
              setMode("explore");
            }}
            className={`rounded px-2 py-1.5 text-xs font-medium ${
              mode === "explore"
                ? "bg-teal/10 text-teal"
                : "text-muted hover:text-ink"
            }`}
            title="Explore"
          >
            <Eye className="h-4 w-4" />
          </button>
          <Link
            href="/import"
            className="ml-1 hidden text-sm text-muted hover:text-ink sm:block"
          >
            New map
          </Link>
        </div>
      </header>

      {/* Breadcrumb — Google Maps style place hierarchy */}
      <div className="z-10 flex shrink-0 items-center gap-1 border-b border-line bg-white px-4 py-2 text-sm">
        {journeyActive ? (
          <>
            <span className="inline-flex items-center gap-1.5 rounded bg-route/15 px-2 py-1 font-medium text-ink">
              <Compass className="h-3.5 w-3.5 text-route" />
              {animating ? "Traveling…" : "Route"}
            </span>
            {activePath && (
              <span className="truncate text-xs text-muted">
                {activePath.summary}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                clearRoute();
                setZoomLevel(0);
              }}
              className="ml-auto text-xs text-muted underline hover:text-ink"
            >
              Exit journey
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={goCity}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 ${
                zoomLevel === 0
                  ? "bg-ink text-white"
                  : "text-muted hover:bg-fog hover:text-ink"
              }`}
            >
              <Home className="h-3.5 w-3.5" />
              City
            </button>
            {focusDistrictId && (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-muted" />
                <button
                  type="button"
                  onClick={goDistrict}
                  className={`rounded px-2 py-1 ${
                    zoomLevel === 1
                      ? "bg-ink text-white"
                      : "text-muted hover:bg-fog hover:text-ink"
                  }`}
                >
                  {districtLabel}
                </button>
              </>
            )}
            {focusModuleId && (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-muted" />
                <span className="rounded bg-ink px-2 py-1 text-white">
                  {moduleLabel}
                </span>
              </>
            )}
            <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted">
              {zoomLevel === 0
                ? `${districtCount} districts · architecture first`
                : zoomLevel === 1
                  ? "Modules inside district"
                  : "Streets · functions"}
            </span>
          </>
        )}
      </div>

      <div className="relative min-h-0 flex-1 map-terrain">
        {mode === "directions" && (
          <DirectionsPanel
            graph={graph}
            activePath={activePath}
            alternateRoutes={alternateRoutes}
            animating={animating}
            animStep={animStep}
            initialFromId={navFromId}
            initialToId={navToId}
            onNavigate={handleNavigate}
            onSelectRoute={(path) => {
              handleNavigate(
                path,
                alternateRoutes.length ? alternateRoutes : [path]
              );
            }}
            onClear={clearRoute}
          />
        )}

        {/* GPS HUD — current stop while traveling */}
        {journeyActive && nowLabel && (
          <div className="absolute bottom-20 left-1/2 z-20 w-[min(100%-2rem,420px)] -translate-x-1/2 border border-route/40 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
            <p className="font-mono text-[10px] uppercase tracking-widest text-route">
              {animating ? "Now passing" : "Arrived"}
            </p>
            <p className="font-display text-lg font-bold text-ink">{nowLabel}</p>
            {nowDesc && (
              <p className="mt-1 line-clamp-2 text-xs text-muted">{nowDesc}</p>
            )}
            {activePath && (
              <p className="mt-2 font-mono text-[10px] text-muted">
                Step {Math.min(animStep + 1, activePath.nodeIds.length)} of{" "}
                {activePath.nodeIds.length}
              </p>
            )}
          </div>
        )}

        {mode === "explore" && zoomLevel === 0 && !journeyActive && (
          <div className="pointer-events-none absolute left-4 top-4 z-20 max-w-sm border border-line bg-white/95 px-4 py-3 shadow-sm">
            <p className="font-display text-sm font-bold text-ink">
              {graph.rootLabel || graph.repo}
            </p>
            <p className="mt-1 text-xs text-muted">
              You&apos;re looking at <strong className="text-ink">districts</strong> —
              the architecture. Click a district to enter. Functions stay hidden
              until you zoom into streets.
            </p>
          </div>
        )}

        {mode === "explore" && zoomLevel > 0 && (
          <div className="pointer-events-none absolute left-4 top-4 z-20 max-w-xs border border-line bg-white/95 px-3 py-2 text-xs text-muted shadow-sm">
            {zoomLevel === 1
              ? "Click a module for details · double-click for streets (functions)"
              : "Street level — individual functions"}
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.15}
          maxZoom={2.5}
          defaultEdgeOptions={{ type: "smoothstep" }}
          onNodeClick={(_, node) => {
            const n = nodeById.get(node.id);
            if (!n) return;
            if (n.kind === "district" && zoomLevel === 0) {
              enterDistrict(n.id);
              return;
            }
            setSelected(n);
          }}
          onNodeDoubleClick={(_, node) => {
            const n = nodeById.get(node.id);
            if (!n) return;
            if (n.kind === "district") {
              enterDistrict(n.id);
              return;
            }
            if (n.level === 1 && n.kind !== "external" && n.functions.length) {
              enterModule(n.id);
            }
          }}
          onNodeMouseEnter={(_, node) => {
            if (mode === "explore" && !activePath) setHoverId(node.id);
          }}
          onNodeMouseLeave={() => {
            if (mode === "explore") setHoverId(null);
          }}
          onPaneClick={() => setSelected(null)}
          proOptions={{ hideAttribution: true }}
          style={{ width: "100%", height: "100%" }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
            color="rgba(13,122,111,0.12)"
          />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={(n) => {
              const d = n.data as AtlasNodeData;
              if (d?.onRoute) return "#0d7a6f";
              return KIND_META[d?.kind]?.color || "#0d7a6f";
            }}
            maskColor="rgba(238,246,243,0.75)"
            className="!bg-[#eef6f3]"
          />
        </ReactFlow>

        {selected && (
          <NodeDetailPanel
            node={selected}
            onClose={() => setSelected(null)}
            onSimulateDelete={() => setImpactNode(selected)}
            onNavigateFrom={() => {
              setNavFromId(selected.id);
              setNavToId(null);
              setMode("directions");
              setSelected(null);
            }}
            onNavigateTo={() => {
              setNavToId(selected.id);
              if (!navFromId) setNavFromId(null);
              setMode("directions");
              setSelected(null);
            }}
            onZoomInto={() => {
              if (selected.kind === "district") enterDistrict(selected.id);
              else if (selected.level === 1) enterModule(selected.id);
            }}
          />
        )}

        {impactNode && (
          <ImpactModal node={impactNode} onClose={() => setImpactNode(null)} />
        )}

        <div className="pointer-events-none absolute bottom-4 left-4 rounded border border-line bg-white/95 px-3 py-2 text-[10px] text-muted shadow-sm">
          <div className="mb-1 font-mono uppercase tracking-wider text-ink">
            Architecture first — not AST first
          </div>
          <div>
            City → District → Module → Function · Roads = connections · GPS =
            directions
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyMap({ repoHint }: { repoHint: string | null }) {
  return (
    <div className="atlas-grid flex h-dvh flex-col items-center justify-center px-6">
      <AlertCircle className="mb-4 h-8 w-8 text-route" />
      <h1 className="font-display mb-2 text-2xl font-bold text-ink">
        No world to navigate yet
      </h1>
      <p className="mb-6 max-w-md text-center text-sm text-muted">
        {repoHint
          ? `"${repoHint}" wasn't analyzed in this session. Import a repo so CodeAtlas can build districts.`
          : "Import a repository — you'll see architecture districts first, not functions."}
      </p>
      <Link
        href="/import"
        className="rounded-md bg-teal px-5 py-3 text-sm font-semibold text-white hover:bg-teal-bright"
      >
        Open a codebase
      </Link>
    </div>
  );
}

function SystemMapInner() {
  const params = useSearchParams();
  const repoHint = params.get("repo");
  const [graph, setGraph] = useState<AtlasGraph | null | undefined>(undefined);

  useEffect(() => {
    setGraph(loadGraph());
  }, []);

  if (graph === undefined) {
    return (
      <div className="atlas-grid flex h-dvh items-center justify-center">
        <p className="text-sm text-muted">Loading map…</p>
      </div>
    );
  }

  if (!graph) return <EmptyMap repoHint={repoHint} />;

  return (
    <ReactFlowProvider>
      <MapCanvas graph={graph} />
    </ReactFlowProvider>
  );
}

function MapSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="atlas-grid flex h-dvh items-center justify-center">
          <div className="text-center">
            <p className="font-brand text-lg font-extrabold text-ink">CodeAtlas</p>
            <p className="mt-1 text-sm text-muted">Building city map…</p>
          </div>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

export function SystemMap() {
  return (
    <MapSuspense>
      <SystemMapInner />
    </MapSuspense>
  );
}
