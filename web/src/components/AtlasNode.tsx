"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { KIND_META } from "@/lib/graph-store";

export type AtlasNodeData = {
  label: string;
  kind: string;
  dimmed: boolean;
  onRoute: boolean;
  selected: boolean;
  health: "healthy" | "medium" | "critical";
  emoji?: string;
  subtitle?: string;
};

function AtlasNodeComponent({ data }: NodeProps) {
  const d = data as AtlasNodeData;
  const meta = KIND_META[d.kind] || KIND_META.module;
  const isDistrict = d.kind === "district";
  const isFn = d.kind === "function";
  const isActive = d.onRoute || d.selected;

  return (
    <div
      className={`relative rounded-xl border bg-white transition-all duration-300 ${
        d.onRoute ? "node-route" : ""
      } ${
        isDistrict
          ? "w-[200px] px-4 py-3"
          : isFn
            ? "w-[220px] px-3 py-2"
            : "w-[240px] px-3.5 py-2.5"
      }`}
      style={{
        opacity: d.dimmed ? 0.12 : 1,
        filter: d.dimmed ? "blur(2px)" : "none",
        borderColor: isActive
          ? "var(--teal)"
          : isDistrict
            ? "var(--teal)"
            : "var(--line)",
        borderWidth: isDistrict || isActive ? 2 : 1,
        boxShadow: isActive
          ? "0 0 0 3px rgba(13, 122, 111, 0.2), 0 4px 14px rgba(13, 122, 111, 0.12)"
          : "0 1px 4px rgba(12, 26, 34, 0.06)",
        transform: isActive ? "scale(1.02)" : "scale(1)",
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border-2 !border-white !bg-teal"
      />
      <div className="mb-0.5 flex items-center gap-1.5">
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] leading-none text-white"
          style={{ background: meta.color }}
        >
          {isFn ? "ƒ" : d.emoji || meta.icon}
        </span>
        <span
          className="font-mono text-[9px] uppercase tracking-wider"
          style={{ color: meta.color }}
        >
          {meta.label}
        </span>
      </div>
      <div
        className={`truncate font-semibold text-ink ${
          isDistrict
            ? "font-brand text-base"
            : isFn
              ? "font-mono text-xs"
              : "text-sm"
        }`}
        title={d.label}
      >
        {d.label}
      </div>
      {d.subtitle && (
        <div className="mt-0.5 truncate text-[10px] text-muted" title={d.subtitle}>
          {d.subtitle}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-2 !border-white !bg-teal"
      />
    </div>
  );
}

export const AtlasFlowNode = memo(AtlasNodeComponent);
