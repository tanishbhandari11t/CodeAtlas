"use client";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  GitBranch,
  Link2,
  Lock,
  LogOut,
  Upload,
} from "lucide-react";
import { demoRepos } from "@/lib/graph-store";

type Mode = "github" | "url" | "zip" | null;

type GhUser = {
  login: string;
  name: string | null;
  avatar_url: string;
};

type GhRepo = {
  id: number;
  full_name: string;
  name: string;
  private: boolean;
  language: string | null;
  description: string | null;
};

function ImportContent() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = (params.get("mode") as Mode) || null;
  const [mode, setMode] = useState<Mode>(initial);
  const [url, setUrl] = useState("https://github.com/expressjs/express");
  const [zipName, setZipName] = useState<string | null>(null);
  const [zipBusy, setZipBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [oauthConfigured, setOauthConfigured] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<GhUser | null>(null);
  const [repos, setRepos] = useState<GhRepo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);

  const title = useMemo(() => {
    if (mode === "github") return "Your repositories";
    if (mode === "url") return "Clone public repository";
    if (mode === "zip") return "Upload ZIP";
    return "Open a codebase";
  }, [mode]);

  const refreshSession = useCallback(async () => {
    try {
      const me = await fetch("/api/auth/me");
      const data = await me.json();
      setOauthConfigured(Boolean(data.configured));
      setAuthenticated(Boolean(data.authenticated));
      setUser(data.user || null);
      return Boolean(data.authenticated);
    } catch {
      setAuthenticated(false);
      setUser(null);
      return false;
    }
  }, []);

  const loadRepos = useCallback(async () => {
    setReposLoading(true);
    try {
      const res = await fetch("/api/github/repos");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load repositories");
      setRepos(data.repos || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load repositories");
      setRepos([]);
    } finally {
      setReposLoading(false);
    }
  }, []);

  useEffect(() => {
    const oauthError = params.get("error");
    if (oauthError) {
      const friendly: Record<string, string> = {
        oauth_not_configured:
          "GitHub OAuth is not configured. Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to web/.env.local",
        invalid_oauth_state: "OAuth state mismatch — try Connect GitHub again.",
        access_denied: "GitHub authorization was cancelled.",
      };
      setError(friendly[oauthError] || decodeURIComponent(oauthError));
    }

    void (async () => {
      const ok = await refreshSession();
      if (ok && (initial === "github" || params.get("connected") === "1")) {
        setMode("github");
        await loadRepos();
      }
    })();
  }, [params, initial, refreshSession, loadRepos]);

  function startIndexing(repoName: string) {
    setError(null);
    router.push(
      `/indexing?repo=${encodeURIComponent(repoName)}&mode=github`
    );
  }

  function connectGitHub() {
    setError(null);
    if (authenticated) {
      setMode("github");
      void loadRepos();
      return;
    }
    if (!oauthConfigured) {
      setMode("github");
      setError(
        "Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to web/.env.local, then restart the dev server. You can still pick a public demo repo below."
      );
      return;
    }
    window.location.href = "/api/auth/github";
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuthenticated(false);
    setUser(null);
    setRepos([]);
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

  const listRepos: Array<{
    id: string | number;
    name: string;
    language: string;
    private: boolean;
  }> = authenticated && repos.length
    ? repos.map((r) => ({
        id: r.id,
        name: r.full_name,
        language: r.language || "—",
        private: r.private,
      }))
    : demoRepos.map((r) => ({
        id: r.id,
        name: r.name,
        language: r.language,
        private: r.private,
      }));

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
        {authenticated && user && (
          <div className="ml-auto flex items-center gap-2 text-sm text-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={user.avatar_url}
              alt=""
              className="h-7 w-7 rounded-full border border-line"
            />
            <span className="font-medium text-ink">@{user.login}</span>
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-white hover:text-ink"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 pb-20">
        <h1 className="font-display mb-2 text-3xl font-bold text-ink">{title}</h1>
        <p className="mb-4 text-muted">
          {mode === null
            ? "Choose how you want to bring code in. We clone and parse the real repo."
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
              onClick={connectGitHub}
              className="flex items-center gap-4 border border-line bg-white px-5 py-4 text-left transition-colors hover:border-teal"
            >
              <GitBranch className="h-5 w-5 shrink-0 text-teal" />
              <div>
                <div className="font-semibold text-ink">
                  {authenticated ? "Browse your GitHub repos" : "Connect GitHub"}
                </div>
                <div className="text-sm text-muted">
                  {authenticated
                    ? `Signed in as @${user?.login} — private & public repos`
                    : oauthConfigured
                      ? "OAuth — access private and public repositories"
                      : "Sign in with GitHub OAuth (set env keys to enable)"}
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setMode("url")}
              className="flex items-center gap-4 border border-line bg-white px-5 py-4 text-left transition-colors hover:border-teal"
            >
              <Link2 className="h-5 w-5 shrink-0 text-teal" />
              <div>
                <div className="font-semibold text-ink">
                  Clone public repository
                </div>
                <div className="text-sm text-muted">
                  Paste any public GitHub URL — no login required
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

        {mode === "github" && (
          <div>
            {!authenticated ? (
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={connectGitHub}
                  className="rounded-md bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-ink-soft"
                >
                  {oauthConfigured
                    ? "Sign in with GitHub"
                    : "Sign in with GitHub (configure env)"}
                </button>
                <p className="text-sm text-muted">
                  Or browse public demo repos below without signing in.
                </p>
              </div>
            ) : (
              <p className="mb-6 text-sm text-teal">
                Signed in as <strong>@{user?.login}</strong>
                {reposLoading
                  ? " — loading your repositories…"
                  : ` — ${repos.length} repos`}
              </p>
            )}
            <ul className="divide-y divide-line border border-line bg-white">
              {reposLoading && authenticated ? (
                <li className="px-5 py-8 text-center text-sm text-muted">
                  Loading repositories from GitHub…
                </li>
              ) : (
                listRepos.map((repo) => (
                  <li key={repo.id}>
                    <button
                      type="button"
                      onClick={() => startIndexing(repo.name)}
                      className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-fog/50 transition-colors"
                    >
                      <div>
                        <div className="font-medium text-ink">{repo.name}</div>
                        <div className="text-xs text-muted">{repo.language}</div>
                      </div>
                      {repo.private ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted">
                          <Lock className="h-3 w-3" /> Private
                        </span>
                      ) : (
                        <span className="text-xs text-muted">Public</span>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
            {!authenticated && (
              <p className="mt-3 text-xs text-muted">
                Private repos require GitHub OAuth. Create a GitHub OAuth App and
                set <code>GITHUB_CLIENT_ID</code> /{" "}
                <code>GITHUB_CLIENT_SECRET</code> in <code>web/.env.local</code>.
              </p>
            )}
            <button
              type="button"
              onClick={() => setMode(null)}
              className="mt-4 text-sm text-muted hover:text-ink"
            >
              ← Other import methods
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
