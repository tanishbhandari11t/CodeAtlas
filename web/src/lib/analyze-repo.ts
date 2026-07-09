import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { buildSemanticArchitecture, type RawModule } from "./semantic-layer";

export type NodeKind =
  | "district"
  | "service"
  | "controller"
  | "middleware"
  | "client"
  | "external"
  | "database"
  | "ui"
  | "infra"
  | "module"
  | "package"
  | "function";

export type AtlasNode = {
  id: string;
  label: string;
  kind: NodeKind;
  description: string;
  lines: number;
  complexity: "Low" | "Medium" | "High";
  tests: number;
  coverage: number;
  contributors: string[];
  file: string;
  functions: string[];
  usedBy: string[];
  uses: string[];
  /** Hierarchy: district → module → function */
  parentId?: string | null;
  level?: 0 | 1 | 2;
  emoji?: string;
  childIds?: string[];
  /** Extra search terms: exact path, basename, etc. */
  aliases?: string[];
};

export type AtlasEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
};

export type SearchRoute = {
  id: string;
  query: string;
  label: string;
  nodeIds: string[];
  edgeIds: string[];
  description: string;
};

export type AtlasGraph = {
  repo: string;
  source: "github" | "zip" | "local";
  clonedTo?: string;
  language: string;
  fileCount: number;
  analyzedAt: string;
  nodes: AtlasNode[];
  edges: AtlasEdge[];
  routes: SearchRoute[];
  layout: Record<string, { x: number; y: number }>;
  /** District ids for the architecture-first view */
  districts?: string[];
  rootLabel?: string;
};

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "out",
  "coverage",
  "vendor",
  "__pycache__",
  ".venv",
  "venv",
  "target",
  ".turbo",
  ".cache",
  "Pods",
  "DerivedData",
]);

const SOURCE_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".go",
  ".java",
  ".rs",
  ".kt",
  ".cs",
  ".rb",
  ".php",
  ".vue",
  ".svelte",
  // Config / metadata — must stay findable by exact GitHub name
  ".properties",
  ".xml",
  ".yml",
  ".yaml",
  ".json",
  ".toml",
  ".md",
  ".txt",
  ".cfg",
  ".ini",
  ".conf",
  ".gradle",
  ".kts",
  ".sql",
  ".sh",
  ".bash",
  ".env",
]);

const INFRA_FILES = [
  "dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  "package.json",
  "go.mod",
  "cargo.toml",
  "pom.xml",
  "requirements.txt",
  "pyproject.toml",
  "test.properties",
  "makefile",
  "cmakelists.txt",
  ".github",
];

function isAnalyzableFile(name: string, ext: string): boolean {
  if (SOURCE_EXT.has(ext)) return true;
  if (INFRA_FILES.includes(name.toLowerCase())) return true;
  // Catch TEST.properties, *.properties, etc. even if casing differs
  if (name.toLowerCase().endsWith(".properties")) return true;
  return false;
}

/** Exact GitHub filename — never pretty-print away extensions */
function exactFileName(relPath: string): string {
  const parts = relPath.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || relPath;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function kindFromPath(rel: string): NodeKind {
  const p = rel.toLowerCase().replace(/\\/g, "/");
  if (
    p.includes("controller") ||
    p.includes("/api/") ||
    p.includes("/routes/") ||
    p.includes("/handlers/")
  )
    return "controller";
  if (p.includes("middleware") || p.includes("guard") || p.includes("auth"))
    return p.includes("middleware") || p.includes("guard")
      ? "middleware"
      : "service";
  if (
    p.includes("component") ||
    p.includes("/pages/") ||
    p.includes("/app/") ||
    p.includes("/ui/") ||
    p.includes("/views/") ||
    p.endsWith(".tsx") ||
    p.endsWith(".vue") ||
    p.endsWith(".svelte")
  )
    return "ui";
  if (
    p.includes("repo") ||
    p.includes("model") ||
    p.includes("entity") ||
    p.includes("schema") ||
    p.includes("prisma") ||
    p.includes("migration")
  )
    return "database";
  if (
    p.includes("client") ||
    p.includes("sdk") ||
    p.includes("external") ||
    p.includes("third-party")
  )
    return "client";
  if (
    p.includes("infra") ||
    p.includes("docker") ||
    p.includes("deploy") ||
    p.includes("k8s") ||
    p.includes("terraform") ||
    p.includes(".github")
  )
    return "infra";
  if (
    p.includes("service") ||
    p.includes("/lib/") ||
    p.includes("/core/") ||
    p.includes("/domain/")
  )
    return "service";
  return "module";
}

function moduleKey(relPath: string): string {
  // One node per file — key is the full relative path so names stay unique & real
  return relPath.replace(/\\/g, "/");
}

function extractImports(content: string, filePath: string): string[] {
  const imports: string[] = [];
  const ext = path.extname(filePath).toLowerCase();

  if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte"].includes(ext)) {
    const fromRe =
      /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
    const requireRe = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    const dynRe = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = fromRe.exec(content))) imports.push(m[1]);
    while ((m = requireRe.exec(content))) imports.push(m[1]);
    while ((m = dynRe.exec(content))) imports.push(m[1]);
  } else if (ext === ".py") {
    const re1 = /^\s*import\s+([a-zA-Z0-9_.,\s]+)/gm;
    const re2 = /^\s*from\s+([a-zA-Z0-9_.]+)\s+import/gm;
    let m: RegExpExecArray | null;
    while ((m = re1.exec(content))) {
      m[1].split(",").forEach((p) => imports.push(p.trim().split(" ")[0]));
    }
    while ((m = re2.exec(content))) imports.push(m[1]);
  } else if (ext === ".go") {
    const single = /import\s+"([^"]+)"/g;
    const block = /import\s*\(([^)]+)\)/g;
    let m: RegExpExecArray | null;
    while ((m = single.exec(content))) imports.push(m[1]);
    while ((m = block.exec(content))) {
      m[1].split("\n").forEach((line) => {
        const q = line.match(/"([^"]+)"/);
        if (q) imports.push(q[1]);
      });
    }
  } else if (ext === ".java" || ext === ".kt") {
    const re = /^\s*import\s+(?:static\s+)?([a-zA-Z0-9_.]+)/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content))) imports.push(m[1]);
  } else if (ext === ".rs") {
    const re = /^\s*use\s+([a-zA-Z0-9_:]+)/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content))) imports.push(m[1].split("::")[0]);
  }

  return imports.filter(Boolean);
}

function extractFunctions(content: string, filePath: string): string[] {
  const ext = path.extname(filePath).toLowerCase();
  const names = new Set<string>();
  let re: RegExp | null = null;
  if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
    re =
      /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_][\w]*)|(?:export\s+)?(?:const|let)\s+([A-Za-z_][\w]*)\s*=\s*(?:async\s*)?\(|(?:export\s+)?class\s+([A-Za-z_][\w]*)/g;
  } else if (ext === ".py") {
    re = /^\s*(?:async\s+)?def\s+([A-Za-z_][\w]*)|^\s*class\s+([A-Za-z_][\w]*)/gm;
  } else if (ext === ".go") {
    re = /func\s+(?:\([^)]+\)\s+)?([A-Za-z_][\w]*)/g;
  }
  if (!re) return [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    const name = m[1] || m[2] || m[3];
    if (name && !name.startsWith("_")) names.add(name);
    if (names.size >= 8) break;
  }
  return [...names];
}

async function walkFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string) {
    if (out.length > 800) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (IGNORE_DIRS.has(ent.name)) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        await walk(full);
      } else if (ent.isFile()) {
        const ext = path.extname(ent.name).toLowerCase();
        if (isAnalyzableFile(ent.name, ext)) {
          out.push(full);
        }
      }
    }
  }
  await walk(root);
  return out;
}

function detectLanguage(files: string[]): string {
  const counts: Record<string, number> = {};
  for (const f of files) {
    const ext = path.extname(f).toLowerCase();
    counts[ext] = (counts[ext] || 0) + 1;
  }
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const map: Record<string, string> = {
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".py": "Python",
    ".go": "Go",
    ".java": "Java",
    ".rs": "Rust",
    ".kt": "Kotlin",
    ".cs": "C#",
    ".rb": "Ruby",
    ".php": "PHP",
  };
  for (const [ext] of ranked) {
    if (map[ext]) return map[ext];
  }
  return "Mixed";
}

function resolveImportToModule(
  fromFile: string,
  importPath: string,
  root: string,
  moduleOfFile: Map<string, string>
): string | null {
  // External package
  if (
    !importPath.startsWith(".") &&
    !importPath.startsWith("/") &&
    !importPath.startsWith("@/")
  ) {
    // scoped npm
    const parts = importPath.split("/");
    const pkg =
      importPath.startsWith("@") && parts.length >= 2
        ? `${parts[0]}/${parts[1]}`
        : parts[0];
    if (!pkg || pkg === "react" || pkg === "react-dom" || pkg === "next") {
      // still track popular externals lightly
    }
    return `ext:${pkg}`;
  }

  // Alias @/ → src/ or project root
  let resolved = importPath;
  if (importPath.startsWith("@/")) {
    resolved = path.join(root, "src", importPath.slice(2));
    // try without src
  } else if (importPath.startsWith(".")) {
    resolved = path.resolve(path.dirname(fromFile), importPath);
  } else {
    return null;
  }

  const candidates = [
    resolved,
    resolved + ".ts",
    resolved + ".tsx",
    resolved + ".js",
    resolved + ".jsx",
    resolved + ".py",
    path.join(resolved, "index.ts"),
    path.join(resolved, "index.tsx"),
    path.join(resolved, "index.js"),
    path.join(resolved, "__init__.py"),
  ];
  // also try @/ from root
  if (importPath.startsWith("@/")) {
    const alt = path.join(root, importPath.slice(2));
    candidates.push(
      alt,
      alt + ".ts",
      alt + ".tsx",
      alt + ".js",
      path.join(alt, "index.ts")
    );
  }

  for (const c of candidates) {
    const norm = path.normalize(c);
    const mod = moduleOfFile.get(norm);
    if (mod) return mod;
    // try matching by relative key
    for (const [file, modId] of moduleOfFile) {
      if (file.replace(/\.(tsx?|jsx?|py)$/, "") === norm.replace(/\.(tsx?|jsx?|py)$/, "")) {
        return modId;
      }
    }
  }

  // Fallback: treat as module path from import string
  if (importPath.startsWith("@/")) {
    return moduleKey(importPath.slice(2));
  }
  if (importPath.startsWith(".")) {
    try {
      const rel = path.relative(root, resolved).replace(/\\/g, "/");
      if (!rel.startsWith("..")) return moduleKey(rel);
    } catch {
      /* ignore */
    }
  }
  return null;
}

function complexityFrom(lines: number, deps: number): "Low" | "Medium" | "High" {
  if (lines > 2000 || deps > 8) return "High";
  if (lines > 600 || deps > 4) return "Medium";
  return "Low";
}

function layoutNodes(
  nodeIds: string[],
  edges: AtlasEdge[]
): Record<string, { x: number; y: number }> {
  // Layered layout by dependency depth (sources at top)
  const indeg = new Map<string, number>();
  const outs = new Map<string, string[]>();
  nodeIds.forEach((id) => {
    indeg.set(id, 0);
    outs.set(id, []);
  });
  edges.forEach((e) => {
    if (!indeg.has(e.source) || !indeg.has(e.target)) return;
    indeg.set(e.target, (indeg.get(e.target) || 0) + 1);
    outs.get(e.source)!.push(e.target);
  });

  const depth = new Map<string, number>();
  const queue = nodeIds.filter((id) => (indeg.get(id) || 0) === 0);
  queue.forEach((id) => depth.set(id, 0));
  const seen = new Set(queue);
  while (queue.length) {
    const cur = queue.shift()!;
    const d = depth.get(cur) || 0;
    for (const n of outs.get(cur) || []) {
      const nd = Math.max(depth.get(n) ?? 0, d + 1);
      depth.set(n, nd);
      if (!seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  nodeIds.forEach((id) => {
    if (!depth.has(id)) depth.set(id, 0);
  });

  const layers = new Map<number, string[]>();
  nodeIds.forEach((id) => {
    const d = depth.get(id) || 0;
    if (!layers.has(d)) layers.set(d, []);
    layers.get(d)!.push(id);
  });

  const layout: Record<string, { x: number; y: number }> = {};
  const sortedDepths = [...layers.keys()].sort((a, b) => a - b);
  sortedDepths.forEach((d) => {
    const row = layers.get(d)!.sort();
    const width = Math.max(row.length, 1);
    row.forEach((id, i) => {
      layout[id] = {
        x: i * 220 - ((width - 1) * 220) / 2 + 400,
        y: d * 140,
      };
    });
  });
  return layout;
}

function buildRoutes(
  nodes: AtlasNode[],
  edges: AtlasEdge[]
): SearchRoute[] {
  const routes: SearchRoute[] = [];
  const byKind = (k: NodeKind) => nodes.filter((n) => n.kind === k);

  const auth = nodes.filter(
    (n) =>
      /auth|login|jwt|session|oauth/i.test(n.label) ||
      /auth|login|jwt/i.test(n.file)
  );
  if (auth.length) {
    const ids = new Set(auth.map((n) => n.id));
    // include neighbors
    edges.forEach((e) => {
      if (ids.has(e.source) || ids.has(e.target)) {
        ids.add(e.source);
        ids.add(e.target);
      }
    });
    const idList = [...ids];
    routes.push({
      id: "auth",
      query: "authentication",
      label: "Authentication",
      nodeIds: idList,
      edgeIds: edges
        .filter((e) => ids.has(e.source) && ids.has(e.target))
        .map((e) => e.id),
      description: `Authentication-related modules (${idList.length} nodes)`,
    });
  }

  const api = [...byKind("controller"), ...byKind("service")].slice(0, 12);
  if (api.length >= 2) {
    const ids = new Set(api.map((n) => n.id));
    routes.push({
      id: "api",
      query: "api",
      label: "API / Services",
      nodeIds: [...ids],
      edgeIds: edges
        .filter((e) => ids.has(e.source) && ids.has(e.target))
        .map((e) => e.id),
      description: "Controllers and services",
    });
  }

  const ui = byKind("ui");
  const data = [...byKind("database"), ...byKind("infra")];
  if (ui.length && data.length) {
    // BFS path-ish: all UI + data + connecting modules
    const ids = new Set([...ui, ...data].map((n) => n.id));
    edges.forEach((e) => {
      if (ids.has(e.source) || ids.has(e.target)) {
        ids.add(e.source);
        ids.add(e.target);
      }
    });
    routes.push({
      id: "ui-data",
      query: "ui database",
      label: "UI → Data",
      nodeIds: [...ids],
      edgeIds: edges
        .filter((e) => ids.has(e.source) && ids.has(e.target))
        .map((e) => e.id),
      description: "From UI modules toward data / infra",
    });
  }

  // Top connected module route
  const degree = new Map<string, number>();
  edges.forEach((e) => {
    degree.set(e.source, (degree.get(e.source) || 0) + 1);
    degree.set(e.target, (degree.get(e.target) || 0) + 1);
  });
  const top = [...degree.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top) {
    const hub = top[0];
    const ids = new Set<string>([hub]);
    edges.forEach((e) => {
      if (e.source === hub || e.target === hub) {
        ids.add(e.source);
        ids.add(e.target);
      }
    });
    const label = nodes.find((n) => n.id === hub)?.label || hub;
    routes.push({
      id: "hub",
      query: label.toLowerCase(),
      label: `Hub: ${label}`,
      nodeIds: [...ids],
      edgeIds: edges
        .filter((e) => ids.has(e.source) && ids.has(e.target))
        .map((e) => e.id),
      description: `Most connected module: ${label}`,
    });
  }

  return routes;
}

export async function analyzeDirectory(
  root: string,
  repoName: string,
  source: AtlasGraph["source"]
): Promise<AtlasGraph> {
  const files = await walkFiles(root);
  const language = detectLanguage(files);

  type Acc = {
    id: string;
    key: string;
    label: string;
    files: string[];
    lines: number;
    functions: string[];
    kindVotes: Record<string, number>;
  };

  const modules = new Map<string, Acc>();
  const moduleOfFile = new Map<string, string>();
  const fileContents = new Map<string, string>();

  for (const full of files) {
    const rel = path.relative(root, full).replace(/\\/g, "/");
    const base = exactFileName(rel);
    const ext = path.extname(base).toLowerCase();
    if (!isAnalyzableFile(base, ext)) continue;

    let content = "";
    try {
      const buf = await fs.readFile(full);
      if (buf.length > 400_000) continue;
      // Skip binary-ish
      if (buf.includes(0)) continue;
      content = buf.toString("utf8");
    } catch {
      continue;
    }

    fileContents.set(full, content);
    const key = moduleKey(rel);
    const id = `file:${slug(key) || "root"}`;
    if (!modules.has(id)) {
      modules.set(id, {
        id,
        key,
        // Exact GitHub name — TEST.properties stays TEST.properties
        label: base,
        files: [],
        lines: 0,
        functions: [],
        kindVotes: {},
      });
    }
    const acc = modules.get(id)!;
    if (!acc.files.includes(rel)) acc.files.push(rel);
    acc.lines += content.split("\n").length;
    // Only extract symbols from real source languages
    const CODE_EXT = new Set([
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
      ".mjs",
      ".cjs",
      ".py",
      ".go",
      ".java",
      ".rs",
      ".kt",
      ".cs",
      ".rb",
      ".php",
      ".vue",
      ".svelte",
    ]);
    if (CODE_EXT.has(ext)) {
      const fns = extractFunctions(content, full);
      for (const f of fns) {
        if (acc.functions.length < 12 && !acc.functions.includes(f)) {
          acc.functions.push(f);
        }
      }
    }
    const k = kindFromPath(rel);
    acc.kindVotes[k] = (acc.kindVotes[k] || 0) + 1;
    moduleOfFile.set(path.normalize(full), id);
  }

  const extCounts = new Map<string, number>();
  const edgeWeights = new Map<
    string,
    { source: string; target: string; count: number }
  >();

  for (const [full, content] of fileContents) {
    const fromMod = moduleOfFile.get(path.normalize(full));
    if (!fromMod) continue;
    const imports = extractImports(content, full);
    for (const imp of imports) {
      const target = resolveImportToModule(full, imp, root, moduleOfFile);
      if (!target || target === fromMod) continue;

      if (target.startsWith("ext:")) {
        const pkg = target.slice(4);
        if (!pkg || pkg.startsWith(".")) continue;
        extCounts.set(pkg, (extCounts.get(pkg) || 0) + 1);
        continue;
      }

      if (!modules.has(target)) continue;
      const ek = `${fromMod}=>${target}`;
      const prev = edgeWeights.get(ek);
      if (prev) prev.count += 1;
      else edgeWeights.set(ek, { source: fromMod, target, count: 1 });
    }
  }

  const SKIP_EXT = new Set([
    "react",
    "react-dom",
    "next",
    "fs",
    "path",
    "os",
    "sys",
    "re",
    "json",
    "typing",
    "collections",
    "functools",
    "itertools",
    "dataclasses",
    "abc",
    "enum",
    "asyncio",
    "__future__",
  ]);

  const topExt = [...extCounts.entries()]
    .filter(([pkg]) => !SKIP_EXT.has(pkg.split("/")[0] || pkg))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  for (const [pkg] of topExt) {
    const id = `ext:${slug(pkg)}`;
    if (!modules.has(id)) {
      modules.set(id, {
        id,
        key: pkg,
        label: pkg,
        files: [],
        lines: 0,
        functions: [],
        kindVotes: { client: 1 },
      });
    }
  }

  for (const [full, content] of fileContents) {
    const fromMod = moduleOfFile.get(path.normalize(full));
    if (!fromMod) continue;
    for (const imp of extractImports(content, full)) {
      if (imp.startsWith(".") || imp.startsWith("/") || imp.startsWith("@/"))
        continue;
      const parts = imp.split("/");
      const pkg =
        imp.startsWith("@") && parts.length >= 2
          ? `${parts[0]}/${parts[1]}`
          : parts[0];
      if (!pkg) continue;
      if (!topExt.some(([p]) => p === pkg)) continue;
      const target = `ext:${slug(pkg)}`;
      if (!modules.has(target)) continue;
      const ek = `${fromMod}=>${target}`;
      const prev = edgeWeights.get(ek);
      if (prev) prev.count += 1;
      else edgeWeights.set(ek, { source: fromMod, target, count: 1 });
    }
  }

  // Cap internal files (large monorepos) — never drop exact-name config files first
  let internalList = [...modules.values()].filter((m) => !m.id.startsWith("ext:"));
  if (internalList.length > 120) {
    const connected = new Set<string>();
    edgeWeights.forEach((e) => {
      connected.add(e.source);
      connected.add(e.target);
    });
    const isKeepName = (m: (typeof internalList)[0]) =>
      /\.(properties|xml|yml|yaml|json|toml|gradle|md)$/i.test(m.label) ||
      /^(dockerfile|makefile|pom\.xml|package\.json)$/i.test(m.label);

    const mustKeep = internalList.filter(isKeepName);
    const rest = internalList
      .filter((m) => !isKeepName(m))
      .sort((a, b) => {
        const ac = connected.has(a.id) ? 1 : 0;
        const bc = connected.has(b.id) ? 1 : 0;
        if (ac !== bc) return bc - ac;
        return b.lines - a.lines;
      })
      .slice(0, Math.max(0, 120 - mustKeep.length));
    internalList = [...mustKeep, ...rest];
  }
  const keep = new Set([
    ...internalList.map((m) => m.id),
    ...topExt.map(([pkg]) => `ext:${slug(pkg)}`),
  ]);

  const rawModules: RawModule[] = [];
  for (const m of modules.values()) {
    if (!keep.has(m.id)) continue;
    rawModules.push({
      id: m.id,
      key: m.key,
      label: m.label,
      files: m.files,
      lines: m.lines,
      functions: m.functions,
      kindVotes: m.kindVotes,
      isExternal: m.id.startsWith("ext:"),
    });
  }

  const importEdges = [...edgeWeights.values()].filter(
    (e) => keep.has(e.source) && keep.has(e.target)
  );

  // ⭐ Semantic layer — architecture first
  const semantic = buildSemanticArchitecture(repoName, rawModules, importEdges);

  return {
    repo: repoName,
    source,
    language,
    fileCount: files.length,
    analyzedAt: new Date().toISOString(),
    nodes: semantic.nodes,
    edges: semantic.edges,
    routes: semantic.routes,
    layout: semantic.layout,
    districts: semantic.districts,
    rootLabel: semantic.rootLabel,
  };
}

function run(cmd: string, args: string[], cwd?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      // Avoid shell:true + args (Windows deprecation / quoting bugs)
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let err = "";
    child.stderr.on("data", (d) => {
      err += d.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(err || `${cmd} exited ${code}`));
    });
  });
}

export function parseGitHubRepo(input: string): { owner: string; name: string } | null {
  const cleaned = input.trim().replace(/\.git$/, "");
  const urlMatch = cleaned.match(
    /github\.com[/:]([^/]+)\/([^/#?\s]+)/i
  );
  if (urlMatch) return { owner: urlMatch[1], name: urlMatch[2] };
  const short = cleaned.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (short) return { owner: short[1], name: short[2] };
  return null;
}

export async function cloneGitHubRepo(
  owner: string,
  name: string,
  accessToken?: string | null
): Promise<{ dir: string; fullName: string }> {
  const fullName = `${owner}/${name}`;
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "codeatlas-"));
  const dir = path.join(base, name);

  // Prefer x-access-token URL for private repos when OAuth token is present
  const cloneUrl = accessToken
    ? `https://x-access-token:${accessToken}@github.com/${owner}/${name}.git`
    : `https://github.com/${owner}/${name}.git`;

  try {
    await run("git", [
      "clone",
      "--depth",
      "1",
      "--single-branch",
      cloneUrl,
      dir,
    ]);
  } catch (e) {
    await fs.rm(base, { recursive: true, force: true }).catch(() => {});
    throw new Error(
      accessToken
        ? `Could not clone ${fullName} with your GitHub account. Check access permissions. ${
            e instanceof Error ? e.message : ""
          }`
        : `Could not clone https://github.com/${fullName}. Make sure the repository is public and the name is correct. ${
            e instanceof Error ? e.message : ""
          }`
    );
  }

  return { dir, fullName };
}

export async function analyzeGitHubRepo(
  repoInput: string,
  accessToken?: string | null
): Promise<AtlasGraph> {
  const parsed = parseGitHubRepo(repoInput);
  if (!parsed) {
    throw new Error(
      `Invalid repository. Use owner/name or a GitHub URL (got: ${repoInput})`
    );
  }
  const { dir, fullName } = await cloneGitHubRepo(
    parsed.owner,
    parsed.name,
    accessToken
  );
  try {
    const graph = await analyzeDirectory(dir, fullName, "github");
    graph.clonedTo = dir;
    return graph;
  } finally {
    // Remove clone after analysis to save disk
    const parent = path.dirname(dir);
    await fs.rm(parent, { recursive: true, force: true }).catch(() => {});
  }
}

export async function analyzeZipBuffer(
  buffer: Buffer,
  zipName: string
): Promise<AtlasGraph> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "codeatlas-zip-"));
  const rootName = zipName.replace(/\.zip$/i, "") || "upload";
  const dir = path.join(base, rootName);
  await fs.mkdir(dir, { recursive: true });

  const entries = Object.keys(zip.files);
  for (const name of entries) {
    const entry = zip.files[name];
    if (!entry || entry.dir) continue;
    // zip slip guard
    const target = path.normalize(path.join(dir, name));
    if (!target.startsWith(path.normalize(dir + path.sep))) continue;
    await fs.mkdir(path.dirname(target), { recursive: true });
    const data = await entry.async("nodebuffer");
    await fs.writeFile(target, data);
  }

  // If zip has a single top folder, analyze that
  const top = await fs.readdir(dir, { withFileTypes: true });
  let analyzeRoot = dir;
  if (top.length === 1 && top[0].isDirectory()) {
    analyzeRoot = path.join(dir, top[0].name);
  }

  try {
    return await analyzeDirectory(analyzeRoot, rootName, "zip");
  } finally {
    await fs.rm(base, { recursive: true, force: true }).catch(() => {});
  }
}
