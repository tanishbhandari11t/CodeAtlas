"use client";

import { useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Link2, Upload } from "lucide-react";

type Mode = "url" | "zip" | null;

function ImportContent() {
  const router = useRouter();
  const params = useSearchParams();
  const initialParam = params.get("mode");
  const initial: Mode =
    initialParam === "url" || initialParam === "zip" ? initialParam : null;
  const [mode, setMode] = useState<Mode>(initial);
  const [url, setUrl] = useState("https://github.com/expressjs/express");
  const [zipName, setZipName] = useState<string | null>(null);
  const [zipBusy, setZipBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => {
    if (mode === "url") return "Clone public repository";
    if (mode === "zip") return "Upload ZIP";
    return "Open a codebase";
  }, [mode]);

  function startIndexing(repoName: string) {
    setError(null);
    router.push(
      `/indexing?repo=${encodeURIComponent(repoName)}&mode=github`
    );
  }

  async function onZipSelected(file: File) {
    setError(null);
    setZipBusy(true);
    setZipName(file.name);
    try {
      if (file.size > 40 * 1024 * 1024) {
        throw new Error("ZIP must be under 40MB for browser upload in this demo");
      }
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      sessionStorage.setItem(
        "codeatlas:zip",
        JSON.stringify({ name: file.name, base64: btoa(binary) })
      );
    } catch (e) {
      setZipName(null);
      setError(e instanceof Error ? e.message : "Could not read ZIP");
    } finally {
      setZipBusy(false);
    }
  }

  return (
    <div className="atlas-grid min-h-screen">
      <header className="mx-auto flex w-full max-w-3xl items-center gap-4 px-6 py-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="font-brand font-extrabold">CodeAtlas</span>
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 pb-20">
        <h1 className="font-display mb-2 text-3xl font-bold text-ink">{title}</h1>
        <p className="mb-4 text-muted">
          {mode === null
            ? "Paste a public GitHub URL or upload a ZIP. We clone/unpack and build the map."
            : "CodeAtlas will git-clone (or unpack) the code, parse imports, and build a map of that repository — not a demo graph."}
        </p>
        {error && (
          <p className="mb-6 border border-danger/30 bg-white px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        {mode === null && (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setMode("url")}
              className="flex items-center gap-4 border border-line bg-white px-5 py-4 text-left transition-colors hover:border-teal"
            >
              <Link2 className="h-5 w-5 shrink-0 text-teal" />
              <div>
                <div className="font-semibold text-ink">
                  Public repository URL
                </div>
                <div className="text-sm text-muted">
                  Paste any public GitHub link — no login required
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setMode("zip")}
              className="flex items-center gap-4 border border-line bg-white px-5 py-4 text-left transition-colors hover:border-teal"
            >
              <Upload className="h-5 w-5 shrink-0 text-teal" />
              <div>
                <div className="font-semibold text-ink">Upload ZIP</div>
                <div className="text-sm text-muted">
                  For codebases that aren&apos;t on GitHub
                </div>
              </div>
            </button>
          </div>
        )}

        {mode === "url" && (
          <div>
            <label className="mb-2 block text-sm font-medium text-ink">
              GitHub URL or owner/name
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/facebook/react"
              className="mb-4 w-full border border-line bg-white px-4 py-3 text-sm outline-none focus:border-teal"
            />
            <button
              type="button"
              onClick={() => {
                const name =
                  url
                    .trim()
                    .replace(/^https?:\/\/github\.com\//i, "")
                    .replace(/\.git$/, "")
                    .replace(/\/$/, "") || "";
                if (!name.includes("/")) {
                  setError("Use owner/name, e.g. facebook/react");
                  return;
                }
                startIndexing(name);
              }}
              className="rounded-md bg-teal px-5 py-3 text-sm font-semibold text-white hover:bg-teal-bright"
            >
              Clone &amp; build map
            </button>
            <button
              type="button"
              onClick={() => setMode(null)}
              className="ml-4 text-sm text-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
        )}

        {mode === "zip" && (
          <div>
            <label
              htmlFor="zip"
              className="flex cursor-pointer flex-col items-center justify-center border border-dashed border-line bg-white px-6 py-16 transition-colors hover:border-teal"
            >
              <Upload className="mb-3 h-8 w-8 text-muted" />
              <span className="text-sm font-medium text-ink">
                {zipBusy
                  ? "Reading file…"
                  : zipName ?? "Drop a .zip here or click to browse"}
              </span>
              <span className="mt-1 text-xs text-muted">
                We unpack and parse your files — max ~40MB in the browser
              </span>
              <input
                id="zip"
                type="file"
                accept=".zip,application/zip"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onZipSelected(f);
                }}
              />
            </label>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!zipName || zipBusy}
                onClick={() => {
                  if (!zipName) return;
                  router.push(
                    `/indexing?repo=${encodeURIComponent(
                      zipName.replace(/\.zip$/i, "")
                    )}&mode=zip`
                  );
                }}
                className="rounded-md bg-teal px-5 py-3 text-sm font-semibold text-white hover:bg-teal-bright disabled:opacity-40"
              >
                Build map from ZIP
              </button>
              <button
                type="button"
                onClick={() => setMode(null)}
                className="text-sm text-muted hover:text-ink"
              >
                ← Other import methods
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function ImportPage() {
  return (
    <Suspense
      fallback={
        <div className="atlas-grid flex min-h-screen items-center justify-center text-muted">
          Loading…
        </div>
      }
    >
      <ImportContent />
    </Suspense>
  );
}
