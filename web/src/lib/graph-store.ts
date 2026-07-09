import type {
  AtlasNode,
  AtlasEdge,
  SearchRoute,
  AtlasGraph,
} from "@/lib/analyze-repo";
import { KIND_META, indexingSteps } from "@/lib/kind-meta";

export type { AtlasNode, AtlasEdge, SearchRoute, AtlasGraph };
export { KIND_META, indexingSteps };

const STORAGE_KEY = "codeatlas:graph";

export function saveGraph(graph: AtlasGraph): void {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify(graph);
  try {
    sessionStorage.setItem(STORAGE_KEY, payload);
  } catch {
    const slim: AtlasGraph = {
      ...graph,
      nodes: graph.nodes
        .filter((n) => (n.level ?? 0) <= 1)
        .map((n) => ({
          ...n,
          functions: n.functions.slice(0, 5),
          description: n.description.slice(0, 160),
          childIds: n.childIds?.slice(0, 20),
        })),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
  }
}

export function loadGraph(): AtlasGraph | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AtlasGraph;
  } catch {
    return null;
  }
}

export function clearGraph(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}

export function findRoute(
  routes: SearchRoute[],
  query: string
): SearchRoute | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  return (
    routes.find(
      (r) =>
        r.query === q ||
        r.label.toLowerCase().includes(q) ||
        r.query.includes(q) ||
        q.includes(r.query)
    ) ?? null
  );
}