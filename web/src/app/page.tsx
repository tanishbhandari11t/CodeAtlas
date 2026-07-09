"use client";

import Link from "next/link";
import { ArrowRight, GitBranch, Upload, Link2, Navigation2 } from "lucide-react";
import { InteractiveHeroMap } from "@/components/InteractiveHeroMap";

export default function HomePage() {
  return (
    <div className="atlas-grid min-h-screen">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link
          href="/"
          className="font-brand text-2xl font-extrabold tracking-tight text-ink"
        >
          CodeAtlas
        </Link>
        <nav className="flex items-center gap-6 text-sm text-muted">
          <a href="#why" className="hover:text-ink transition-colors">
            Why not VS Code?
          </a>
          <Link
            href="/import"
            className="rounded-full bg-[#0d7a6f] px-4 py-2 font-medium text-white shadow-sm hover:bg-[#0a6b5f] transition-colors"
          >
            Open a codebase
          </Link>
        </nav>
      </header>

      <main>
        <section className="relative mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center gap-10 px-6 pb-16 pt-4 lg:grid-cols-2 lg:gap-8">
          <div className="relative z-10">
            <p className="font-brand mb-3 text-5xl font-extrabold tracking-tight text-ink sm:text-6xl lg:text-7xl">
              CodeAtlas
            </p>
            <h1 className="mb-4 max-w-md text-xl font-medium leading-snug text-ink-soft sm:text-2xl">
              Google Maps for Software Systems
            </h1>
            <p className="mb-8 max-w-md text-base leading-relaxed text-muted">
              Navigate a codebase like a city — districts, roads, and GPS
              directions. Understanding before editing.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/import"
                className="inline-flex items-center gap-2 rounded-full bg-[#0d7a6f] px-5 py-3 text-sm font-semibold text-white shadow-md hover:bg-[#0a6b5f] transition-colors"
              >
                <Navigation2 className="h-4 w-4" />
                Start navigating
              </Link>
              <Link
                href="/indexing?repo=expressjs%2Fexpress&mode=github"
                className="inline-flex items-center gap-2 rounded-full border border-[#c5ddd6] bg-white px-5 py-3 text-sm font-medium text-ink shadow-sm hover:bg-[#f7faf8] transition-colors"
              >
                Try expressjs/express
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <InteractiveHeroMap />
        </section>

        <section id="why" className="border-t border-[#c5ddd6] bg-white/70">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="mb-2 font-mono text-xs uppercase tracking-widest text-[#0d7a6f]">
              The real question
            </p>
            <h2 className="font-brand mb-6 max-w-2xl text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              If I&apos;m a developer, why would I open this instead of VS Code?
            </h2>
            <p className="mb-12 max-w-2xl text-lg leading-relaxed text-muted">
              VS Code is where you edit. CodeAtlas is where you{" "}
              <em className="not-italic text-ink">navigate</em>. You never see
              folders first — you see districts of the system, then get
              turn-by-turn directions through the code.
            </p>

            <div className="grid gap-10 sm:grid-cols-3">
              {[
                {
                  q: "Navigate Login → Database",
                  a: "Pick From / To. Hit Navigate. The path animates like GPS — not a list of 217 files.",
                },
                {
                  q: "Semantic zoom",
                  a: "Districts → Modules → Streets (functions). Double-click a landmark to expand it — like Google Maps revealing roads.",
                },
                {
                  q: "Multiple routes",
                  a: "Route A / Route B between two landmarks. Choose the path. Watch traffic flow.",
                },
              ].map((item) => (
                <div key={item.q}>
                  <h3 className="font-brand mb-2 text-lg font-bold text-ink">
                    {item.q}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-[#c5ddd6]">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 className="font-brand mb-2 text-2xl font-extrabold text-ink">
              Understand any codebase in minutes
            </h2>
            <p className="mb-10 text-muted">
              GitHub is optional. Bring a public URL, private repo, or a ZIP.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Link
                href="/import?mode=github"
                className="group flex flex-col gap-3 rounded-2xl border border-[#c5ddd6] bg-white p-6 transition-colors hover:border-[#0d7a6f]"
              >
                <GitBranch className="h-5 w-5 text-[#0d7a6f]" />
                <span className="font-brand font-bold text-ink">
                  Connect GitHub
                </span>
                <span className="text-sm text-muted">
                  OAuth for private repos. Pick from your list.
                </span>
                <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-[#0d7a6f] opacity-0 transition-opacity group-hover:opacity-100">
                  Continue <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
              <Link
                href="/import?mode=url"
                className="group flex flex-col gap-3 rounded-2xl border border-[#c5ddd6] bg-white p-6 transition-colors hover:border-[#0d7a6f]"
              >
                <Link2 className="h-5 w-5 text-[#0d7a6f]" />
                <span className="font-brand font-bold text-ink">
                  Public repository
                </span>
                <span className="text-sm text-muted">
                  Paste github.com/facebook/react — no login required.
                </span>
                <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-[#0d7a6f] opacity-0 transition-opacity group-hover:opacity-100">
                  Continue <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
              <Link
                href="/import?mode=zip"
                className="group flex flex-col gap-3 rounded-2xl border border-[#c5ddd6] bg-white p-6 transition-colors hover:border-[#0d7a6f]"
              >
                <Upload className="h-5 w-5 text-[#0d7a6f]" />
                <span className="font-brand font-bold text-ink">Upload ZIP</span>
                <span className="text-sm text-muted">
                  For companies that don&apos;t use GitHub.
                </span>
                <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-[#0d7a6f] opacity-0 transition-opacity group-hover:opacity-100">
                  Continue <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </div>
          </div>
        </section>

        <footer className="border-t border-[#c5ddd6] py-8 text-center text-sm text-muted">
          <p>
            We&apos;re not building a graph visualization tool — we&apos;re
            building the first navigation system for software.{" "}
            <span className="font-brand font-bold text-ink/70">CodeAtlas</span>
          </p>
        </footer>
      </main>
    </div>
  );
}
