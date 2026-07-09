# CodeAtlas

### Google Maps for Software Systems

**CodeAtlas** is a navigation system for codebases — not another IDE, AI chat, or dependency-graph toy.

When you open an unfamiliar repository, you usually get a wall of folders. CodeAtlas does the opposite: it shows you the **architecture first** (districts → modules → functions), then lets you **navigate** between landmarks with GPS-style directions.

> VS Code is where you *edit*. CodeAtlas is where you *understand*.

---

## Why it exists

Joining a new team, reviewing a PR, or debugging across services often starts with the same question:

> *“Where does this flow actually go?”*

File trees and search don’t answer that well. Static graphs dump every import at once. AI assistants explain snippets — they don’t give you a map of the system.

CodeAtlas is built for that gap:

| Without CodeAtlas | With CodeAtlas |
|-------------------|----------------|
| Open `src/` and guess | Land on **districts** (Auth, Payments, API…) |
| Grep for `login` across 200 files | **Navigate** Login → Database and watch the path |
| Flat dependency spaghetti | Semantic zoom: City → District → Streets |
| “What breaks if I delete this?” | Impact simulation on a landmark |

---

## What it actually does

1. **Import** a public GitHub repo (URL / `owner/name`) or a **ZIP**
2. **Clone / unpack** the code on the server
3. **Parse** files, imports, and symbols
4. Build a **semantic architecture layer** — districts and hierarchy, not raw AST dump
5. Open an interactive **system map** you can pan, zoom, search, and navigate

### Architecture-first zoom

| Level | What you see |
|-------|----------------|
| **City** | High-level districts only (e.g. Inference, Environment, Auth) |
| **District** | Modules / files inside that concept |
| **Streets** | Functions — revealed only when you zoom in |

You should never land on `main()` or `run()` as the first screen.

### Killer feature: Directions

Pick **From** and **To** landmarks → hit **Navigate** → the route animates across the map like GPS traffic, with turn-by-turn steps and alternate routes when available.

---

## Features

- Interactive architecture map (pan · zoom · search)
- Semantic districts instead of folder dumps
- From → To pathfinding with animated travel
- Impact simulation (“what if this bridge disappears?”)
- Open source files on GitHub from the detail panel
- Public repo URL or ZIP upload — no login required

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Framework | **Next.js 16** (App Router) |
| UI | **React 19**, **Tailwind CSS 4**, **Framer Motion** |
| Map canvas | **React Flow** (`@xyflow/react`) |
| Language | **TypeScript** |
| Analysis | Node.js `git clone`, filesystem walk, import/symbol parsing |
| Archives | **JSZip** |
| Icons | **Lucide React** |

### Core modules (`web/src`)

| Path | Role |
|------|------|
| `lib/analyze-repo.ts` | Clone / unpack + parse the repository |
| `lib/semantic-layer.ts` | Districts, hierarchy, architecture labels |
| `lib/navigation.ts` | Pathfinding, landmarks, routes |
| `components/SystemMap.tsx` | Interactive map UI |
| `app/api/analyze` | Analysis API endpoint |

---

## Quick start

```bash
git clone https://github.com/tanishbhandari11t/CodeAtlas.git
cd CodeAtlas/web
npm install
npm run dev
```

Open [https://code-atlas-2gtw.onrender.com/](https://code-atlas-2gtw.onrender.com/)

### Import a codebase

1. Go to **Import**
2. Paste a **public GitHub URL** (e.g. `https://github.com/expressjs/express`) **or** upload a **ZIP**
3. Wait for indexing → explore the map

> Tip: after analyzer updates, **re-import** the repo — older session maps may be stale.

### Deploy note

Analysis runs `git clone` and can take up to ~2 minutes. Prefer a Node host with **git** available (e.g. **Railway** or **Render**). Set root directory to `web`.

---

## Product principle

> Never show code or folders first — show **understanding** first.

CodeAtlas is intentionally *not*:

- An AI coding assistant  
- A replacement for VS Code  
- A raw AST / dependency-graph visualizer  

It *is* a **navigation layer** on top of real repositories.

---

## Roadmap (honest)

- Richer call-graph / runtime path demos  
- Stronger semantic district heuristics  
- Optional local workspace deep-links into the editor  
- Journey replay / street-level code preview  

---

## License

Private / personal project unless otherwise stated.

---

**Built to make large codebases feel like cities you can actually navigate.**
