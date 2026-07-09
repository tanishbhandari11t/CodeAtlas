/**
 * Semantic layer — sits between raw AST/imports and the navigation UI.
 *
 * Raw parse  →  modules + imports + symbols
 * Semantic   →  districts (concepts) → modules → functions
 * UI         →  architecture first, details on demand
 */

import type { AtlasEdge, AtlasNode, NodeKind, SearchRoute } from "./analyze-repo";

export type RawModule = {
  id: string;
  /** Path key e.g. src/inference/environment.py */
  key: string;
  /** Exact GitHub filename e.g. TEST.properties */
  label: string;
  files: string[];
  lines: number;
  functions: string[];
  kindVotes: Record<string, number>;
  isExternal?: boolean;
};

export type DistrictDef = {
  id: string;
  label: string;
  emoji: string;
  kind: NodeKind;
  /** Match against file paths / module names */
  patterns: RegExp[];
};

/** Conceptual districts — architecture vocabulary, not file names */
export const DISTRICT_CATALOG: DistrictDef[] = [
  {
    id: "district:inference",
    label: "Inference",
    emoji: "🧠",
    kind: "service",
    patterns: [
      /infer/i,
      /agent/i,
      /llm/i,
      /model/i,
      /predict/i,
      /prompt/i,
      /openai/i,
      /completion/i,
      /episode/i,
    ],
  },
  {
    id: "district:environment",
    label: "Environment",
    emoji: "🌍",
    kind: "service",
    patterns: [
      /environ/i,
      /openenv/i,
      /scenario/i,
      /simulat/i,
      /world/i,
      /gym/i,
    ],
  },
  {
    id: "district:evaluation",
    label: "Evaluation",
    emoji: "🧪",
    kind: "service",
    patterns: [
      /eval/i,
      /grade/i,
      /score/i,
      /metric/i,
      /benchmark/i,
      /test/i,
      /spec/i,
    ],
  },
  {
    id: "district:deployment",
    label: "Deployment",
    emoji: "🚀",
    kind: "infra",
    patterns: [
      /deploy/i,
      /\bhf\b/i,
      /docker/i,
      /server/i,
      /k8s/i,
      /infra/i,
      /ci/i,
      /github/i,
      /huggingface/i,
    ],
  },
  {
    id: "district:api",
    label: "API & Clients",
    emoji: "🔌",
    kind: "controller",
    patterns: [
      /client/i,
      /api/i,
      /http/i,
      /route/i,
      /endpoint/i,
      /handler/i,
      /controller/i,
      /rpc/i,
    ],
  },
  {
    id: "district:auth",
    label: "Authentication",
    emoji: "🔐",
    kind: "middleware",
    patterns: [/auth/i, /login/i, /jwt/i, /oauth/i, /session/i, /permission/i],
  },
  {
    id: "district:data",
    label: "Data",
    emoji: "🗄️",
    kind: "database",
    patterns: [
      /database/i,
      /db\b/i,
      /repo/i,
      /model/i,
      /schema/i,
      /prisma/i,
      /sql/i,
      /storage/i,
    ],
  },
  {
    id: "district:ui",
    label: "Interface",
    emoji: "🖥️",
    kind: "ui",
    patterns: [
      /component/i,
      /page/i,
      /view/i,
      /ui\b/i,
      /frontend/i,
      /react/i,
      /\.tsx$/i,
    ],
  },
  {
    id: "district:utilities",
    label: "Utilities",
    emoji: "⚙️",
    kind: "module",
    patterns: [/util/i, /helper/i, /common/i, /shared/i, /lib\b/i, /tool/i, /script/i],
  },
];

function displayFileLabel(mod: RawModule): string {
  // Always prefer the real filename from the repo
  if (mod.files[0]) {
    const parts = mod.files[0].replace(/\\/g, "/").split("/");
    return parts[parts.length - 1] || mod.label;
  }
  return mod.label;
}

function fileAliases(mod: RawModule): string[] {
  const aliases = new Set<string>();
  aliases.add(mod.label);
  aliases.add(displayFileLabel(mod));
  for (const f of mod.files) {
    const norm = f.replace(/\\/g, "/");
    aliases.add(norm);
    aliases.add(norm.split("/").pop() || norm);
    // basename without extension for softer search
    const base = (norm.split("/").pop() || "").replace(/\.[^.]+$/, "");
    if (base) aliases.add(base);
  }
  return [...aliases].filter(Boolean);
}

function prettyExternalName(pkg: string): string {
  const known: Record<string, string> = {
    httpx: "HTTPX",
    requests: "Requests",
    flask: "Flask",
    django: "Django",
    fastapi: "FastAPI",
    numpy: "NumPy",
    pandas: "Pandas",
    torch: "PyTorch",
    tensorflow: "TensorFlow",
    react: "React",
    express: "Express",
    lodash: "Lodash",
    axios: "Axios",
    bs4: "BeautifulSoup",
    "beautifulsoup4": "BeautifulSoup",
  };
  const key = pkg.toLowerCase();
  const nice =
    known[key] ||
    pkg
      .replace(/\//g, " ")
      .split(/[\s_-]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  return `${nice} Library`;
}

function matchDistrict(mod: RawModule): DistrictDef | null {
  if (mod.isExternal) return null;
  const hay = `${mod.key} ${mod.label} ${mod.files.join(" ")}`.toLowerCase();
  for (const d of DISTRICT_CATALOG) {
    if (d.patterns.some((p) => p.test(hay))) return d;
  }
  return null;
}

function pickKind(mod: RawModule): NodeKind {
  if (mod.isExternal) return "external";
  const top = Object.entries(mod.kindVotes).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (top && top !== "module") return top as NodeKind;
  return "module";
}

function layoutHierarchy(
  districts: AtlasNode[],
  modules: AtlasNode[],
  functions: AtlasNode[],
  focusDistrictId: string | null
): Record<string, { x: number; y: number }> {
  const layout: Record<string, { x: number; y: number }> = {};
  const n = Math.max(districts.length, 1);
  districts.forEach((d, i) => {
    layout[d.id] = {
      x: i * 320 - ((n - 1) * 320) / 2 + 400,
      y: 40,
    };
  });

  // Modules fan under their district — wide enough for card width
  const byParent = new Map<string, AtlasNode[]>();
  modules.forEach((m) => {
    const p = m.parentId || "";
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p)!.push(m);
  });

  for (const [parentId, kids] of byParent) {
    const parentPos = layout[parentId] || { x: 400, y: 40 };
    kids.forEach((m, i) => {
      const cols = Math.min(kids.length, 3);
      const col = i % cols;
      const row = Math.floor(i / cols);
      layout[m.id] = {
        x: parentPos.x + (col - (cols - 1) / 2) * 280,
        y: parentPos.y + 180 + row * 130,
      };
    });
  }

  // Functions under module — generous grid so cards never collide
  const fnByParent = new Map<string, AtlasNode[]>();
  functions.forEach((f) => {
    const p = f.parentId || "";
    if (!fnByParent.has(p)) fnByParent.set(p, []);
    fnByParent.get(p)!.push(f);
  });
  for (const [parentId, kids] of fnByParent) {
    const parentPos = layout[parentId] || { x: 400, y: 200 };
    const cols = Math.min(Math.max(kids.length, 1), 4);
    kids.forEach((f, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      layout[f.id] = {
        x: parentPos.x + (col - (cols - 1) / 2) * 240,
        y: parentPos.y + 160 + row * 110,
      };
    });
  }

  void focusDistrictId;
  return layout;
}

export type SemanticResult = {
  nodes: AtlasNode[];
  edges: AtlasEdge[];
  routes: SearchRoute[];
  layout: Record<string, { x: number; y: number }>;
  districts: string[];
  rootLabel: string;
};

/**
 * Transform flat modules + import edges into:
 * Districts (concepts) → Modules (files) → Functions (symbols)
 */
export function buildSemanticArchitecture(
  repoName: string,
  rawModules: RawModule[],
  importEdges: { source: string; target: string; count: number }[]
): SemanticResult {
  const internals = rawModules.filter((m) => !m.isExternal);
  const externals = rawModules.filter((m) => m.isExternal);

  // Assign each internal module to a district
  const districtMembers = new Map<string, RawModule[]>();
  const moduleToDistrict = new Map<string, string>();

  for (const mod of internals) {
    const d = matchDistrict(mod);
    const districtId = d?.id || "district:core";
    if (!districtMembers.has(districtId)) districtMembers.set(districtId, []);
    districtMembers.get(districtId)!.push(mod);
    moduleToDistrict.set(mod.id, districtId);
  }

  // Ensure Core district exists for leftovers
  if (districtMembers.has("district:core") || internals.length === 0) {
    /* ok */
  }
  if (![...districtMembers.keys()].length) {
    districtMembers.set("district:core", internals);
    internals.forEach((m) => moduleToDistrict.set(m.id, "district:core"));
  }

  const nodes: AtlasNode[] = [];
  const edges: AtlasEdge[] = [];

  // --- District nodes (level 0) ---
  const districtNodes: AtlasNode[] = [];
  for (const [districtId, members] of districtMembers) {
    if (members.length === 0) continue;
    const catalog =
      DISTRICT_CATALOG.find((d) => d.id === districtId) ||
      ({
        id: "district:core",
        label: "Core",
        emoji: "📦",
        kind: "service" as NodeKind,
        patterns: [],
      } satisfies DistrictDef);

    const lines = members.reduce((s, m) => s + m.lines, 0);
    const allFns = members.flatMap((m) => m.functions).slice(0, 12);
    const district: AtlasNode = {
      id: districtId,
      label: catalog.label,
      kind: "district",
      description: `${catalog.emoji} Architecture district — ${members.length} modules, ${lines} lines. Click to enter.`,
      lines,
      complexity: lines > 2000 ? "High" : lines > 600 ? "Medium" : "Low",
      tests: members.reduce(
        (s, m) => s + m.files.filter((f) => /test|spec/i.test(f)).length,
        0
      ),
      coverage: 0,
      contributors: [],
      file: members[0]?.files[0] || "",
      functions: allFns,
      usedBy: [],
      uses: [],
      parentId: null,
      level: 0,
      emoji: catalog.emoji,
      childIds: members.map((m) => m.id),
    };
    districtNodes.push(district);
    nodes.push(district);
  }

  // --- Module / file nodes (level 1) — labels = exact GitHub filenames ---
  const moduleNodes: AtlasNode[] = [];
  for (const mod of internals) {
    const parentId = moduleToDistrict.get(mod.id) || "district:core";
    const fnIds = mod.functions.slice(0, 8).map((fn) => `fn:${mod.id}:${fn}`);
    const fileLabel = displayFileLabel(mod);
    const relPath = mod.files[0] || mod.key;
    const node: AtlasNode = {
      id: mod.id,
      label: fileLabel,
      kind: pickKind(mod),
      description: `File \`${relPath}\` · ${mod.lines} lines. Part of the ${
        districtNodes.find((d) => d.id === parentId)?.label || "system"
      } district.`,
      lines: mod.lines,
      complexity:
        mod.lines > 800 ? "High" : mod.lines > 250 ? "Medium" : "Low",
      tests: /test|spec/i.test(relPath) ? 1 : 0,
      coverage: 0,
      contributors: [],
      file: relPath,
      functions: mod.functions,
      usedBy: [],
      uses: [],
      parentId,
      level: 1,
      childIds: fnIds,
      aliases: fileAliases(mod),
    };
    moduleNodes.push(node);
    nodes.push(node);
  }

  // --- Function nodes (level 2) — stored, shown only when zoomed ---
  const functionNodes: AtlasNode[] = [];
  for (const mod of internals) {
    const fileLabel = displayFileLabel(mod);
    for (const fn of mod.functions.slice(0, 8)) {
      const id = `fn:${mod.id}:${fn}`;
      const node: AtlasNode = {
        id,
        label: `${fn}()`,
        kind: "function",
        description: `Function in \`${fileLabel}\` (${mod.files[0] || mod.key}).`,
        lines: 0,
        complexity: "Low",
        tests: 0,
        coverage: 0,
        contributors: [],
        file: mod.files[0] || "",
        functions: [fn],
        usedBy: [],
        uses: [],
        parentId: mod.id,
        level: 2,
        childIds: [],
        aliases: [fn, `${fn}()`, fileLabel],
      };
      functionNodes.push(node);
      nodes.push(node);
    }
  }

  // --- External libraries (attach to districts that import them) ---
  const extNodeIds = new Set<string>();
  for (const ext of externals.slice(0, 10)) {
    // Find which districts import this
    const importers = importEdges
      .filter((e) => e.target === ext.id)
      .map((e) => moduleToDistrict.get(e.source))
      .filter(Boolean) as string[];
    const parentId = importers[0] || districtNodes[0]?.id || null;

    const node: AtlasNode = {
      id: ext.id,
      label: prettyExternalName(ext.label),
      kind: "external",
      description: `External library — not defined in this repository.`,
      lines: 0,
      complexity: "Low",
      tests: 0,
      coverage: 100,
      contributors: [],
      file: ext.label,
      functions: [],
      usedBy: [],
      uses: [],
      parentId,
      level: 1,
      childIds: [],
    };
    extNodeIds.add(ext.id);
    nodes.push(node);
    moduleNodes.push(node);
  }

  // --- Edges: lift module imports to district-district + keep module-module ---
  const districtEdgeKey = new Set<string>();
  const usesMap = new Map<string, Set<string>>();
  const usedByMap = new Map<string, Set<string>>();
  const touch = (from: string, to: string) => {
    if (!usesMap.has(from)) usesMap.set(from, new Set());
    if (!usedByMap.has(to)) usedByMap.set(to, new Set());
    usesMap.get(from)!.add(to);
    usedByMap.get(to)!.add(from);
  };

  for (const e of importEdges) {
    const srcDistrict = moduleToDistrict.get(e.source);
    const tgtDistrict = moduleToDistrict.get(e.target);
    const tgtIsExt = extNodeIds.has(e.target);

    // Module → module (or external)
    if (
      (moduleToDistrict.has(e.source) || extNodeIds.has(e.source)) &&
      (moduleToDistrict.has(e.target) || tgtIsExt)
    ) {
      edges.push({
        id: `e-mod-${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        label: "imports",
      });
      touch(e.source, e.target);
    }

    // District → district (architecture highways)
    if (srcDistrict && tgtDistrict && srcDistrict !== tgtDistrict) {
      const key = `${srcDistrict}=>${tgtDistrict}`;
      if (!districtEdgeKey.has(key)) {
        districtEdgeKey.add(key);
        edges.push({
          id: `e-dist-${srcDistrict}-${tgtDistrict}`,
          source: srcDistrict,
          target: tgtDistrict,
          label: "connects",
        });
        touch(srcDistrict, tgtDistrict);
      }
    }

    // District → external (when a district's module imports a library)
    if (srcDistrict && tgtIsExt) {
      const key = `${srcDistrict}=>${e.target}`;
      if (!districtEdgeKey.has(key)) {
        districtEdgeKey.add(key);
        edges.push({
          id: `e-dist-ext-${srcDistrict}-${e.target}`,
          source: srcDistrict,
          target: e.target,
          label: "uses",
        });
        touch(srcDistrict, e.target);
      }
    }

    // Contains edges: district → module
    if (srcDistrict) {
      /* added below */
    }
  }

  // Hierarchy edges: district contains module, module contains function
  for (const m of moduleNodes) {
    if (m.parentId && m.kind !== "external") {
      edges.push({
        id: `e-contains-${m.parentId}-${m.id}`,
        source: m.parentId,
        target: m.id,
        label: "contains",
      });
    }
  }
  for (const f of functionNodes) {
    if (f.parentId) {
      edges.push({
        id: `e-contains-${f.parentId}-${f.id}`,
        source: f.parentId,
        target: f.id,
        label: "defines",
      });
    }
  }

  // Fill uses/usedBy labels on nodes
  const labelOf = (id: string) => nodes.find((n) => n.id === id)?.label || id;
  for (const n of nodes) {
    n.uses = [...(usesMap.get(n.id) || [])].map(labelOf);
    n.usedBy = [...(usedByMap.get(n.id) || [])].map(labelOf);
  }

  const districtIds = districtNodes.map((d) => d.id);
  const layout = layoutHierarchy(
    districtNodes,
    moduleNodes,
    functionNodes,
    null
  );

  // Navigation routes between districts
  const routes: SearchRoute[] = [];
  if (districtNodes.length >= 2) {
    for (let i = 0; i < Math.min(districtNodes.length, 4); i++) {
      for (let j = i + 1; j < Math.min(districtNodes.length, 4); j++) {
        const a = districtNodes[i];
        const b = districtNodes[j];
        const edge = edges.find(
          (e) =>
            (e.source === a.id && e.target === b.id) ||
            (e.source === b.id && e.target === a.id)
        );
        routes.push({
          id: `nav-${a.id}-${b.id}`,
          query: `${a.label} ${b.label}`.toLowerCase(),
          label: `${a.label} → ${b.label}`,
          nodeIds: edge ? [a.id, b.id] : [a.id, b.id],
          edgeIds: edge ? [edge.id] : [],
          description: `Navigate from ${a.label} district to ${b.label}`,
        });
      }
    }
  }
  // Landmark routes for each district
  for (const d of districtNodes) {
    routes.push({
      id: `land-${d.id}`,
      query: d.label.toLowerCase(),
      label: d.label,
      nodeIds: [d.id, ...(d.childIds || [])],
      edgeIds: edges
        .filter(
          (e) =>
            e.source === d.id ||
            e.target === d.id ||
            (d.childIds || []).includes(e.source) ||
            (d.childIds || []).includes(e.target)
        )
        .map((e) => e.id),
      description: `Explore the ${d.label} district`,
    });
  }

  const shortName = repoName.split("/").pop() || repoName;

  return {
    nodes,
    edges,
    routes,
    layout,
    districts: districtIds,
    rootLabel: shortName,
  };
}
