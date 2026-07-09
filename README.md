# CodeAtlas

**We're not building a graph visualization tool — we're building the first navigation system for software.**

## The pipeline (what actually runs)

```
Public GitHub URL / ZIP
    → clone / unpack
    → parse files + imports + symbols
    → ⭐ semantic layer (districts / hierarchy / labels)
    → navigation map
```

### Architecture first (not AST first)

| Zoom | What you see |
|------|----------------|
| **City** | Districts only — Inference, Environment, Evaluation, Deployment… |
| **District** | Modules inside that concept |
| **Streets** | Functions — only after you choose to zoom in |

You should **never** land on `run()` / `main()` as the first screen.

## Run

```bash
cd web
npm install
npm run dev
```

### Import a codebase

1. Open **Import**
2. Paste a **public GitHub URL** (e.g. `facebook/react`) **or** upload a **ZIP**
3. Wait for indexing → open the map

**Re-import your repo** after analyzer updates (old session graphs lack districts).

1. Open map → you see **districts** (city view)
2. Click a district → modules appear
3. Double-click a module → function streets
4. Use **Directions** for From → To navigation between landmarks

## Stack

- `src/lib/analyze-repo.ts` — clone + parse
- `src/lib/semantic-layer.ts` — architecture extraction ⭐
- `src/lib/navigation.ts` — pathfinding / routes
- React Flow map — districts-first UI
