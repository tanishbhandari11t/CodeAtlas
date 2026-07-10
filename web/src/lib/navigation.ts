import type { AtlasEdge, AtlasGraph, AtlasNode } from "@/lib/analyze-repo";
import { KIND_META } from "@/lib/kind-meta";

export type NavPath = {
  id: string;
  label: string;
  nodeIds: string[];
  edgeIds: string[];
  hops: number;
  /** Relative "cost" — lower is preferred (like travel time) */
  cost: number;
  summary: string;
};

export type ZoomLevel = 0 | 1 | 2;

/** Every navigable landmark in the city — any kind */
export function allLandmarks(graph: AtlasGraph): AtlasNode[] {
  return [...graph.nodes].sort((a, b) => {
    const order = (n: AtlasNode) =>
      n.kind === "district"
        ? 0
        : n.kind === "function"
          ? 3
          : n.kind === "external"
            ? 2
            : 1;
    const d = order(a) - order(b);
    if (d !== 0) return d;
    return a.label.localeCompare(b.label);
  });
}

function kindBadge(n: AtlasNode): string {
  return KIND_META[n.kind]?.label || n.kind;
}

/**
 * Edges used for GPS — include hierarchy so you can go
 * function ↔ module ↔ district ↔ module ↔ external
 */
function navigationEdges(graph: AtlasGraph): AtlasEdge[] {
  const edges = [...graph.edges];
  const seen = new Set(edges.map((e) => `${e.source}|${e.target}|${e.label}`));

  const add = (source: string, target: string, label: string) => {
    const key = `${source}|${target}|${label}`;
    const rev = `${target}|${source}|${label}`;
    if (seen.has(key) || seen.has(rev)) return;
    seen.add(key);
    edges.push({
      id: `nav-${source}-${target}-${label}`,
      source,
      target,
      label,
    });
  };

  // Ensure parent↔child links exist for every hierarchical node
  for (const n of graph.nodes) {
    if (n.parentId) {
      add(n.parentId, n.id, "contains");
    }
    for (const childId of n.childIds || []) {
      add(n.id, childId, "contains");
    }
  }

  return edges;
}

/** Build adjacency (undirected for city navigation) */
export function buildAdjacency(
  edges: AtlasEdge[],
  directed = true
): Map<string, { to: string; edgeId: string; weight: number }[]> {
  const adj = new Map<string, { to: string; edgeId: string; weight: number }[]>();
  const add = (from: string, to: string, edgeId: string) => {
    if (!adj.has(from)) adj.set(from, []);
    adj.get(from)!.push({ to, edgeId, weight: 1 });
  };
  for (const e of edges) {
    add(e.source, e.target, e.id);
    if (!directed) add(e.target, e.source, e.id);
  }
  return adj;
}

/** Resolve typed text → node id (any kind) — prefers exact GitHub filenames */
export function resolveLandmark(
  graph: AtlasGraph,
  query: string,
  preferredId?: string
): AtlasNode | null {
  if (preferredId) {
    const exact = graph.nodes.find((n) => n.id === preferredId);
    if (exact) return exact;
  }
  const q = query.trim().toLowerCase().replace(/\(\)$/, "");
  if (!q) return null;

  // Exact filename / path first
  const exactFile = graph.nodes.find((n) => {
    const base = (n.file || "").replace(/\\/g, "/").split("/").pop()?.toLowerCase();
    return (
      n.label.toLowerCase() === q ||
      base === q ||
      (n.file || "").toLowerCase().replace(/\\/g, "/") === q ||
      (n.aliases || []).some((a) => a.toLowerCase() === q)
    );
  });
  if (exactFile) return exactFile;

  const hits = findLandmarks(graph, q);
  if (hits.length) return hits[0];

  return (
    graph.nodes.find((n) => n.label.toLowerCase().replace(/\(\)$/, "") === q) ||
    graph.nodes.find((n) => n.functions.some((f) => f.toLowerCase() === q)) ||
    null
  );
}

/** BFS shortest path across the full city graph */
export function shortestPath(
  graph: AtlasGraph,
  fromId: string,
  toId: string,
  directed = false
): NavPath | null {
  if (fromId === toId) {
    const label = graph.nodes.find((n) => n.id === fromId)?.label || fromId;
    return {
      id: "same",
      label: "Same place",
      nodeIds: [fromId],
      edgeIds: [],
      hops: 0,
      cost: 0,
      summary: label,
    };
  }

  const edges = navigationEdges(graph);
  const adj = buildAdjacency(edges, directed);
  const prev = new Map<string, { node: string; edgeId: string } | null>();
  const q: string[] = [fromId];
  prev.set(fromId, null);

  while (q.length) {
    const cur = q.shift()!;
    if (cur === toId) break;
    for (const n of adj.get(cur) || []) {
      if (prev.has(n.to)) continue;
      prev.set(n.to, { node: cur, edgeId: n.edgeId });
      q.push(n.to);
    }
  }

  if (!prev.has(toId)) return null;

  const nodeIds: string[] = [];
  const edgeIds: string[] = [];
  let walk: string | undefined = toId;
  while (walk) {
    nodeIds.unshift(walk);
    const p = prev.get(walk);
    if (!p) break;
    edgeIds.unshift(p.edgeId);
    walk = p.node;
  }

  const labels = nodeIds.map(
    (id) => graph.nodes.find((n) => n.id === id)?.label || id
  );

  return {
    id: `path-${fromId}-${toId}`,
    label: `${labels[0]} → ${labels[labels.length - 1]}`,
    nodeIds,
    edgeIds,
    hops: edgeIds.length,
    cost: edgeIds.length,
    summary: labels.join(" → "),
  };
}

/**
 * If direct BFS fails, climb to parents and try again
 * (function → module → district bridges).
 */
function pathViaHierarchy(
  graph: AtlasGraph,
  fromId: string,
  toId: string
): NavPath | null {
  const direct = shortestPath(graph, fromId, toId, false);
  if (direct) return direct;

  const ancestors = (id: string): string[] => {
    const chain = [id];
    let cur = graph.nodes.find((n) => n.id === id);
    const guard = new Set<string>([id]);
    while (cur?.parentId && !guard.has(cur.parentId)) {
      chain.push(cur.parentId);
      guard.add(cur.parentId);
      cur = graph.nodes.find((n) => n.id === cur!.parentId!);
    }
    return chain;
  };

  const fromChain = ancestors(fromId);
  const toChain = ancestors(toId);

  // Try every pair of ancestors (closest first)
  for (const a of fromChain) {
    for (const b of toChain) {
      if (a === fromId && b === toId) continue;
      const mid = shortestPath(graph, a, b, false);
      if (!mid) continue;

      // Stitch: fromId → … → a → … → b → … → toId
      const up = shortestPath(graph, fromId, a, false);
      const down = shortestPath(graph, b, toId, false);
      const nodeIds: string[] = [];
      const edgeIds: string[] = [];

      const append = (p: NavPath | null, skipFirst: boolean) => {
        if (!p) return;
        const ns = skipFirst ? p.nodeIds.slice(1) : p.nodeIds;
        const es = p.edgeIds;
        nodeIds.push(...ns);
        edgeIds.push(...es);
      };

      if (up) {
        nodeIds.push(...up.nodeIds);
        edgeIds.push(...up.edgeIds);
      } else {
        nodeIds.push(fromId);
      }
      append(mid, nodeIds[nodeIds.length - 1] === mid.nodeIds[0]);
      append(down, nodeIds[nodeIds.length - 1] === down?.nodeIds[0]);

      // Dedupe consecutive
      const dedupNodes: string[] = [];
      const dedupEdges: string[] = [];
      for (let i = 0; i < nodeIds.length; i++) {
        if (dedupNodes[dedupNodes.length - 1] === nodeIds[i]) continue;
        if (i > 0 && dedupNodes.length) {
          // keep edge alignment best-effort
        }
        dedupNodes.push(nodeIds[i]);
      }
      // Rebuild edges between consecutive nodes if needed
      const nav = navigationEdges(graph);
      for (let i = 0; i < dedupNodes.length - 1; i++) {
        const s = dedupNodes[i];
        const t = dedupNodes[i + 1];
        const e =
          nav.find(
            (x) =>
              (x.source === s && x.target === t) ||
              (x.source === t && x.target === s)
          ) || null;
        if (e) dedupEdges.push(e.id);
        else dedupEdges.push(`virtual-${s}-${t}`);
      }

      const labels = dedupNodes.map(
        (id) => graph.nodes.find((n) => n.id === id)?.label || id
      );
      return {
        id: `path-hier-${fromId}-${toId}`,
        label: `${labels[0]} → ${labels[labels.length - 1]}`,
        nodeIds: dedupNodes,
        edgeIds: dedupEdges,
        hops: dedupEdges.length,
        cost: dedupEdges.length + 2,
        summary: labels.join(" → "),
      };
    }
  }

  return null;
}

/**
 * Find up to `limit` alternate routes between ANY two landmarks.
 */
export function findRoutes(
  graph: AtlasGraph,
  fromId: string,
  toId: string,
  limit = 3
): NavPath[] {
  const routes: NavPath[] = [];
  const blocked = new Set<string>();
  const baseEdges = navigationEdges(graph);

  for (let i = 0; i < limit; i++) {
    const filtered: AtlasGraph = {
      ...graph,
      edges: baseEdges.filter((e) => !blocked.has(e.id)),
    };

    const path =
      shortestPath(filtered, fromId, toId, false) ||
      (i === 0 ? pathViaHierarchy(graph, fromId, toId) : null);

    if (!path || path.nodeIds.length < 1) break;
    if (path.nodeIds.length === 1 && fromId !== toId) break;

    const sig = path.nodeIds.join(">");
    if (routes.some((r) => r.nodeIds.join(">") === sig)) {
      if (path.edgeIds[0]) blocked.add(path.edgeIds[0]);
      else break;
      continue;
    }

    const letter = String.fromCharCode(65 + routes.length);
    routes.push({
      ...path,
      id: `route-${letter.toLowerCase()}`,
      label: `Route ${letter}`,
      cost: path.hops * 5 + path.nodeIds.length,
      summary: path.summary,
    });

    const mid = path.edgeIds[Math.floor(path.edgeIds.length / 2)];
    if (mid && !mid.startsWith("virtual-")) blocked.add(mid);
    else if (path.edgeIds[0] && !path.edgeIds[0].startsWith("virtual-"))
      blocked.add(path.edgeIds[0]);
    else break;
  }

  return routes;
}

/** Search landmarks of every kind — matches exact GitHub filenames */
export function findLandmarks(graph: AtlasGraph, query: string): AtlasNode[] {
  const q = query.trim().toLowerCase().replace(/\(\)$/, "");
  if (!q) return allLandmarks(graph).slice(0, 16);

  const scored = graph.nodes
    .map((n) => {
      const label = n.label.toLowerCase();
      const labelBare = label.replace(/\(\)$/, "");
      const file = (n.file || "").toLowerCase().replace(/\\/g, "/");
      const fileBase = file.split("/").pop() || "";
      const aliases = (n.aliases || []).map((a) => a.toLowerCase());

      let score = 0;

      // Exact filename wins (TEST.properties)
      if (label === q || fileBase === q) score += 300;
      else if (aliases.some((a) => a === q)) score += 280;
      else if (label.startsWith(q) || fileBase.startsWith(q)) score += 150;
      else if (label.includes(q) || labelBare.includes(q)) score += 90;
      else if (file.includes(q)) score += 100;
      else if (aliases.some((a) => a.includes(q))) score += 85;

      if (n.kind.toLowerCase().includes(q)) score += 20;
      if (n.functions.some((f) => f.toLowerCase() === q)) score += 150;
      else if (n.functions.some((f) => f.toLowerCase().includes(q))) score += 50;
      if (n.description.toLowerCase().includes(q)) score += 8;

      if (n.kind === "district") score += 5;
      return { n, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 20).map((s) => s.n);
}

/** Suggest destinations of any kind (reachable preferred) */
export function suggestDestinations(
  graph: AtlasGraph,
  fromId: string
): AtlasNode[] {
  const from = graph.nodes.find((n) => n.id === fromId);
  if (!from) return allLandmarks(graph).slice(0, 12);

  const preferred = [
    "district",
    "database",
    "external",
    "infra",
    "service",
    "controller",
    "module",
    "ui",
    "function",
  ];

  const scored = graph.nodes
    .filter((n) => n.id !== fromId)
    .map((n) => {
      let score = 0;
      const ki = preferred.indexOf(n.kind);
      if (ki >= 0) score += (preferred.length - ki) * 3;
      const path = shortestPath(graph, fromId, n.id, false);
      if (path && path.hops > 0) score += 40 - Math.min(path.hops, 15);
      else score -= 20;
      // Diversity: don't only suggest same kind
      if (n.kind !== from.kind) score += 5;
      return { n, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 12).map((s) => s.n);
}

export function districtNodes(graph: AtlasGraph, max = 12): Set<string> {
  const districts = graph.nodes
    .filter((n) => n.kind === "district")
    .slice(0, max);
  if (districts.length) return new Set(districts.map((n) => n.id));

  const degree = new Map<string, number>();
  graph.edges.forEach((e) => {
    degree.set(e.source, (degree.get(e.source) || 0) + 1);
    degree.set(e.target, (degree.get(e.target) || 0) + 1);
  });
  const ranked = [...graph.nodes]
    .filter((n) => !n.id.startsWith("ext:") || (degree.get(n.id) || 0) > 2)
    .sort((a, b) => {
      const da = degree.get(a.id) || 0;
      const db = degree.get(b.id) || 0;
      if (db !== da) return db - da;
      return b.lines - a.lines;
    });
  return new Set(ranked.slice(0, max).map((n) => n.id));
}

/** Children revealed when zooming into a node (functions as street-level) */
export function expandNodeStreets(node: AtlasNode): {
  id: string;
  label: string;
  parentId: string;
}[] {
  return node.functions.slice(0, 8).map((fn) => ({
    id: `fn:${node.id}:${fn}`,
    label: `${fn}()`,
    parentId: node.id,
  }));
}

export function nodeLabel(graph: AtlasGraph, id: string): string {
  if (id.startsWith("fn:")) {
    const parts = id.split(":");
    return `${parts[parts.length - 1]}()`;
  }
  return graph.nodes.find((n) => n.id === id)?.label || id;
}

export { kindBadge };
