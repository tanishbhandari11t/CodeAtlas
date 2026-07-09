# CodeAtlas

**We're not building a graph visualization tool — we're building the first navigation system for software.**

## The pipeline (what actually runs)

```
GitHub / ZIP
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

### GitHub OAuth (Connect GitHub)

1. Create an OAuth App at [GitHub Developer Settings](https://github.com/settings/developers)
2. Set **Authorization callback URL** to:
   `http://localhost:3000/api/auth/github/callback`
3. Copy `web/.env.example` → `web/.env.local` and fill in:

```env
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. Restart `npm run dev`, then open **Import → Connect GitHub**

Without OAuth you can still clone public repos by URL or use the demo list.

**Re-import your repo** after analyzer updates (old session graphs lack districts).

1. Open map → you see **districts** (city view)
2. Click a district → modules appear
3. Double-click a module → function streets
4. Use **Directions** for From → To navigation between landmarks

## Stack

- `src/lib/analyze-repo.ts` — clone + parse
- `src/lib/semantic-layer.ts` — architecture extraction ⭐
- `src/lib/navigation.ts` — pathfinding / routes
- `src/lib/github-auth.ts` — GitHub OAuth + repo listing
- React Flow map — districts-first UI
