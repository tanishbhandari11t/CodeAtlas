"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { indexingSteps, saveGraph } from "@/lib/graph-store";
import type { AtlasGraph } from "@/lib/analyze-repo";

/** Share one in-flight analyze across React Strict Mode remounts */
const inflight = new Map<string, Promise<AtlasGraph>>();

async function analyzeRepo(repo: string, mode: string): Promise<AtlasGraph> {
  const key = `${mode}:${repo || "zip"}`;
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    if (mode === "zip") {
      const raw = sessionStorage.getItem("codeatlas:zip");
      if (!raw) {
        throw new Error(
          "ZIP data missing. Go back and upload the file again."
        );
      }
      const { name, base64 } = JSON.parse(raw) as {
        name: string;
        base64: string;
      };
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const form = new FormData();
      form.append(
        "file",
        new Blob([bytes], { type: "application/zip" }),
        name
      );
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      sessionStorage.removeItem("codeatlas:zip");
      return data.graph as AtlasGraph;
    }

    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Analysis failed");
    return data.graph as AtlasGraph;
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}

function IndexingContent() {
  const params = useSearchParams();
  const repo = params.get("repo") || "";
  const mode = params.get("mode") || "github";
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState("Starting…");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!repo && mode !== "zip") {
      setError("No repository specified. Go back and choose a repo.");
      return;
    }

    let alive = true;

    const stepTimer = setInterval(() => {
      if (alive) setStep((s) => Math.min(s + 1, indexingSteps.length - 1));
    }, 900);

    setStatus(
      mode === "zip" ? "Reading uploaded ZIP…" : `git clone --depth 1 ${repo}`
    );

    analyzeRepo(repo, mode)
      .then((graph) => {
        if (!alive) return;
        clearInterval(stepTimer);
        try {
          saveGraph(graph);
        } catch (storageErr) {
          throw new Error(
            storageErr instanceof Error
              ? `Could not store map: ${storageErr.message}`
              : "Could not store map (storage full)"
          );
        }
        setStep(indexingSteps.length);
        setDone(true);
        setStatus(
          `Mapped ${graph.nodes.length} modules · ${graph.edges.length} relationships`
        );
        window.setTimeout(() => {
          window.location.assign(
            `/map?repo=${encodeURIComponent(graph.repo)}`
          );
        }, 400);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        clearInterval(stepTimer);
        setError(
          e instanceof Error ? e.message : "Failed to analyze repository"
        );
        setStatus("Failed");
      });

    return () => {
      alive = false;
      clearInterval(stepTimer);
      // Do NOT abort the shared request — Strict Mode remounts must reuse it
    };
  }, [repo, mode]);

  const progress = Math.min(
    100,
    Math.round(
      ((done ? indexingSteps.length : step) / indexingSteps.length) * 100
    )
  );

  return (
    <div className="atlas-grid flex min-h-screen flex-col">
      <header className="px-6 py-6">
        <Link href="/" className="font-brand text-xl font-extrabold text-ink">
          CodeAtlas
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 pb-24">
        <p className="mb-1 font-mono text-xs uppercase tracking-widest text-teal">
          {error ? "Indexing failed" : "Indexing repository"}
        </p>
        <h1 className="font-display mb-2 text-2xl font-bold text-ink">
          {repo || "Uploaded archive"}
        </h1>
        <p className="mb-2 text-sm text-muted">
          Generating your atlas — like Google Maps preparing a city.
        </p>
        <p className="mb-8 font-mono text-xs text-teal">{status}</p>

        {!error && (
          <div className="relative mb-8 h-1 overflow-hidden rounded-full bg-line index-scan">
            <div
              className="absolute inset-y-0 left-0 bg-teal transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {error ? (
          <div className="border border-danger/40 bg-white p-4">
            <p className="mb-3 text-sm text-danger">{error}</p>
            <p className="mb-4 text-xs text-muted">
              Common causes: private repo, typo in owner/name, or network
              issues. Try <code>expressjs/express</code> to verify.
            </p>
            <Link
              href="/import"
              className="text-sm font-medium text-teal hover:underline"
            >
              ← Try another repository
            </Link>
          </div>
        ) : (
          <ol className="space-y-4">
            {indexingSteps.map((s, i) => {
              const isDone = i < step || done;
              const active = i === step && !done;
              return (
                <li
                  key={s.id}
                  className={`flex gap-4 transition-opacity ${
                    isDone || active ? "opacity-100" : "opacity-30"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-mono ${
                      isDone
                        ? "bg-teal text-white"
                        : active
                          ? "border-2 border-teal text-teal"
                          : "border border-line text-muted"
                    }`}
                  >
                    {isDone ? "✓" : i + 1}
                  </span>
                  <div>
                    <div
                      className={`text-sm font-medium ${
                        active ? "text-ink" : "text-ink-soft"
                      }`}
                    >
                      {s.label}
                      {active && (
                        <span className="ml-2 inline-block animate-pulse text-teal">
                          …
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-xs text-muted">{s.detail}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {done && (
          <div className="mt-8 space-y-3">
            <p className="text-sm text-teal">Map ready — opening…</p>
            <a
              href={`/map?repo=${encodeURIComponent(repo)}`}
              className="inline-block text-sm font-medium text-ink underline"
            >
              Click here if it doesn&apos;t redirect
            </a>
          </div>
        )}
      </main>
    </div>
  );
}

export default function IndexingPage() {
  return (
    <Suspense
      fallback={
        <div className="atlas-grid flex min-h-screen items-center justify-center text-muted">
          Preparing…
        </div>
      }
    >
      <IndexingContent />
    </Suspense>
  );
}
