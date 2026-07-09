"use client";

import dynamic from "next/dynamic";

const SystemMap = dynamic(
  () => import("@/components/SystemMap").then((m) => m.SystemMap),
  {
    ssr: false,
    loading: () => (
      <div className="atlas-grid flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="font-brand text-lg font-extrabold text-ink">CodeAtlas</p>
          <p className="mt-1 text-sm text-muted">Loading system map…</p>
        </div>
      </div>
    ),
  }
);

export default function MapPage() {
  return <SystemMap />;
}
