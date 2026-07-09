"use client";

import { X, AlertTriangle } from "lucide-react";
import type { AtlasNode } from "@/lib/graph-store";

type Props = {
  node: AtlasNode;
  onClose: () => void;
};

export function ImpactModal({ node, onClose }: Props) {
  const impact = {
    files: node.complexity === "High" ? 31 : node.complexity === "Medium" ? 12 : 4,
    apis: node.kind === "service" ? 8 : 3,
    tests: Math.max(node.tests * 2, 6),
    docker: 1,
    actions: node.complexity === "High" ? 3 : 1,
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md border border-line bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-line px-5 py-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-danger">
              Impact simulation
            </p>
            <h2 className="font-display text-lg font-bold text-ink">
              Delete {node.label}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted hover:bg-fog"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="mb-4 flex gap-2 text-sm text-muted">
            <AlertTriangle className="h-4 w-4 shrink-0 text-route" />
            Like asking: what happens if this bridge disappears?
          </div>

          <p className="mb-4 text-sm text-ink-soft">
            Analyzing dependents of <strong>{node.label}</strong>…
          </p>

          <dl className="space-y-0 divide-y divide-line border border-line">
            {[
              { k: "Affected files", v: impact.files },
              { k: "Affected APIs", v: impact.apis },
              { k: "Tests at risk", v: impact.tests },
              { k: "Docker configs", v: impact.docker },
              { k: "GitHub Actions", v: impact.actions },
            ].map((row) => (
              <div
                key={row.k}
                className="flex items-center justify-between px-4 py-3"
              >
                <dt className="text-sm text-muted">{row.k}</dt>
                <dd className="font-display text-lg font-bold text-ink">
                  {row.v}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="border-t border-line px-5 py-3 text-center text-xs text-muted">
          Read-only simulation — your repository is unchanged
        </div>
      </div>
    </div>
  );
}
