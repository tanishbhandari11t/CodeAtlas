"use client";

import {
  X,
  FileCode,
  Users,
  AlertTriangle,
  Trash2,
  Navigation,
  ZoomIn,
  ExternalLink,
} from "lucide-react";
import type { AtlasNode } from "@/lib/graph-store";
import { KIND_META } from "@/lib/graph-store";

type Props = {
  node: AtlasNode;
  repo?: string;
  onClose: () => void;
  onSimulateDelete: () => void;
  onNavigateFrom?: () => void;
  onNavigateTo?: () => void;
  onZoomInto?: () => void;
};

/** Absolute Windows/Unix path that VS Code can open */
function isAbsolutePath(file: string) {
  return /^([a-zA-Z]:[\\/]|\/)/.test(file);
}

/** Repo-relative source file (not an npm package name) */
function isRepoRelativeFile(file: string) {
  if (!file || file === ".") return false;
  if (isAbsolutePath(file)) return false;
  // External packages look like "react", "@scope/pkg", "typescript-eslint"
  if (!file.includes("/") && !file.includes("\\") && !file.includes(".")) {
    return false;
  }
  if (file.startsWith("@") && !file.includes("/src") && !file.includes(".")) {
    return false;
  }
  return true;
}

function githubBlobUrl(repo: string, file: string) {
  const cleanRepo = repo.replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/, "");
  const cleanFile = file.replace(/\\/g, "/").replace(/^\.\//, "");
  return `https://github.com/${cleanRepo}/blob/HEAD/${cleanFile}`;
}

export function NodeDetailPanel({
  node,
  repo,
  onClose,
  onSimulateDelete,
  onNavigateFrom,
  onNavigateTo,
  onZoomInto,
}: Props) {
  const meta = KIND_META[node.kind] || KIND_META.module;
  const canOpenGithub =
    Boolean(repo) &&
    node.kind !== "external" &&
    node.file &&
    isRepoRelativeFile(node.file);
  const canOpenVscode = node.file && isAbsolutePath(node.file);

  return (
    <aside className="absolute right-0 top-0 z-20 flex h-full w-full max-w-sm flex-col border-l border-line bg-white shadow-xl">
      <div className="flex items-start justify-between border-b border-line px-5 py-4">
        <div>
          <span
            className="mb-1 inline-block font-mono text-[10px] uppercase tracking-wider"
            style={{ color: meta.color }}
          >
            {meta.label}
          </span>
          <h2 className="font-display text-xl font-bold text-ink">{node.label}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-muted hover:bg-fog hover:text-ink"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <p className="mb-5 text-sm leading-relaxed text-muted">
          {node.description}
        </p>

        <div className="mb-5 flex flex-col gap-2">
          {onNavigateFrom && (
            <button
              type="button"
              onClick={onNavigateFrom}
              className="flex items-center justify-center gap-2 rounded-md bg-teal px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-bright"
            >
              <Navigation className="h-4 w-4" />
              Navigate from here
            </button>
          )}
          {onNavigateTo && (
            <button
              type="button"
              onClick={onNavigateTo}
              className="flex items-center justify-center gap-2 rounded-md border border-teal px-4 py-2.5 text-sm font-medium text-teal hover:bg-teal/5"
            >
              <Navigation className="h-4 w-4" />
              Navigate to here
            </button>
          )}
          {onZoomInto &&
            (node.kind === "district" ||
              (node.level === 1 && node.functions.length > 0)) && (
            <button
              type="button"
              onClick={onZoomInto}
              className="flex items-center justify-center gap-2 rounded-md border border-line px-4 py-2.5 text-sm font-medium text-ink hover:border-teal"
            >
              <ZoomIn className="h-4 w-4" />
              {node.kind === "district"
                ? `Enter district (${node.childIds?.length || 0} modules)`
                : `Zoom into streets (${node.functions.length} functions)`}
            </button>
          )}
        </div>

        <dl className="mb-6 grid grid-cols-2 gap-3">
          {[
            { k: "Lines", v: String(node.lines || "—") },
            { k: "Complexity", v: node.complexity },
            { k: "Tests", v: String(node.tests) },
            { k: "Coverage", v: node.coverage ? `${node.coverage}%` : "—" },
          ].map((row) => (
            <div key={row.k} className="border border-line bg-paper/80 px-3 py-2">
              <dt className="font-mono text-[10px] uppercase tracking-wider text-muted">
                {row.k}
              </dt>
              <dd className="text-sm font-semibold text-ink">{row.v}</dd>
            </div>
          ))}
        </dl>

        {node.file && (
          <div className="mb-5">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">
              <FileCode className="h-3.5 w-3.5" />
              {node.kind === "external" ? "Package" : "Path in repo"}
            </div>
            <code className="block break-all rounded bg-fog px-2 py-1.5 font-mono text-xs text-ink-soft">
              {node.file}
            </code>
            {node.label !== node.file.split(/[/\\]/).pop() && (
              <p className="mt-1 text-[11px] text-muted">
                Map label:{" "}
                <span className="font-mono text-ink">{node.label}</span>
              </p>
            )}
            <div className="mt-2 flex flex-col gap-1.5">
              {canOpenGithub && repo && (
                <a
                  href={githubBlobUrl(repo, node.file)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-teal hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open on GitHub
                </a>
              )}
              {canOpenVscode && (
                <a
                  href={`vscode://file/${node.file.replace(/\\/g, "/")}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-teal hover:underline"
                >
                  Open in VS Code
                </a>
              )}
              {!canOpenGithub && !canOpenVscode && node.kind === "external" && (
                <p className="text-[11px] text-muted">
                  External dependency — not a file on your disk. Open the
                  package on npm/GitHub separately.
                </p>
              )}
              {!canOpenGithub && !canOpenVscode && node.kind !== "external" && (
                <p className="text-[11px] text-muted">
                  CodeAtlas only stores the repo-relative path, so VS Code
                  can&apos;t open it as a local file. Use GitHub after
                  re-importing, or open the file from your local clone.
                </p>
              )}
            </div>
          </div>
        )}

        {node.functions.length > 0 && (
          <div className="mb-5">
            <div className="mb-1.5 text-xs font-medium text-muted">
              Streets (functions)
            </div>
            <ul className="space-y-1">
              {node.functions.map((f) => (
                <li
                  key={f}
                  className="font-mono text-xs text-ink-soft before:mr-1.5 before:text-teal before:content-['→']"
                >
                  {f}()
                </li>
              ))}
            </ul>
          </div>
        )}

        {node.uses.length > 0 && (
          <div className="mb-5">
            <div className="mb-1.5 text-xs font-medium text-muted">Roads out</div>
            <div className="flex flex-wrap gap-1.5">
              {node.uses.map((u) => (
                <span
                  key={u}
                  className="rounded border border-line bg-paper px-2 py-0.5 text-xs text-ink"
                >
                  {u}
                </span>
              ))}
            </div>
          </div>
        )}

        {node.usedBy.length > 0 && (
          <div className="mb-5">
            <div className="mb-1.5 text-xs font-medium text-muted">Roads in</div>
            <div className="flex flex-wrap gap-1.5">
              {node.usedBy.map((u) => (
                <span
                  key={u}
                  className="rounded border border-line bg-paper px-2 py-0.5 text-xs text-ink"
                >
                  {u}
                </span>
              ))}
            </div>
          </div>
        )}

        {node.contributors.length > 0 && (
          <div className="mb-5">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">
              <Users className="h-3.5 w-3.5" />
              Contributors
            </div>
            <p className="text-sm text-ink">{node.contributors.join(" · ")}</p>
          </div>
        )}

        {node.complexity === "High" && (
          <div className="mb-4 flex gap-2 rounded border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Heavy traffic — high coupling. Strong refactor candidate.
          </div>
        )}
      </div>

      <div className="border-t border-line p-4">
        <button
          type="button"
          onClick={onSimulateDelete}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-danger/40 bg-white px-4 py-2.5 text-sm font-medium text-danger hover:bg-danger/5 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          What if this bridge disappears?
        </button>
        <p className="mt-2 text-center text-[11px] text-muted">
          Impact simulation — nothing is deleted
        </p>
      </div>
    </aside>
  );
}
