# Candy Sort 3D

A 3D candy-sorting puzzle game that runs in the browser. Sort the candies so each jar holds four of one kind. There are 100 levels, and the generator checks every one with a solver to make sure it can be solved. All visuals are built in code and all sound is synthesised, so the game ships no image or audio files.

Built with React 18, TypeScript, Vite, Three.js (React Three Fiber and Drei), Tailwind CSS, Framer Motion, Zustand and Vitest.

## Getting started

Requires Node 22.12 or later (`.nvmrc` pins 22; Vitest 5 needs at least 22.12).

```bash
npm install
npm run dev        # http://localhost:5173
```

| Script              | What it does                                                                      |
| ------------------- | --------------------------------------------------------------------------------- |
| `npm run dev`       | Starts the dev server with hot reload                                             |
| `npm run build`     | Type-checks, then writes the production build to `dist/`                          |
| `npm run preview`   | Serves the production build locally                                               |
| `npm test`          | Runs the unit and store tests, including the solvability check for all 100 levels |
| `npm run lint`      | Runs ESLint, including the rule that keeps game logic pure                        |
| `npm run typecheck` | Runs `tsc` with no output                                                         |
| `npm run format`    | Formats the codebase with Prettier                                                |
| `npm run check`     | Runs everything CI runs: typecheck, lint, format check, tests and build           |

CI (`.github/workflows/ci.yml`) runs the same steps as `npm run check` on every push to `main` and every pull request, with read-only permissions.

## Contributing

1. Branch from `main`.
2. Run `npm run check` before pushing; it must pass for CI to pass.
3. Put game rules in `src/game` and cover them with tests there. The scene and UI should only read state and dispatch store actions.

## How to play

- **Tap:** tap a jar to lift its top candy, tap it again to put the candy back, or tap another jar to move the candy there.
- **Drag:** press a jar and drag its top candy to another jar. A valid target glows; an invalid one turns red.
- **Valid moves:** a candy can go into an empty jar, or onto a candy of the same kind in a jar with space.
- **Winning:** a jar holding four candies of one kind gets a lid. You win when every jar is either lidded or empty.
- **Help:** Undo is free and unlimited. Hints cost 20 coins. Add Jar costs 50 coins and can be used once per level.
- **Keyboard:** `Esc` pauses, and `Ctrl/Cmd+Z` or `U` undoes.

## Architecture

```
src/
  game/    Pure TypeScript rules. No React, Three.js or store imports (enforced by ESLint).
           rules, solver, seeded generator, economy, themes, achievements, layout,
           level.worker.ts (level generation and hints off the main thread)
  store/   Zustand stores. gameStore runs a level; progressStore and settingsStore persist;
           uiStore holds screens, popups and toasts. levelClient talks to the worker.
  scene/   React Three Fiber components: environment, jars, candies, effects, camera fit,
           drag controller. They read state and dispatch actions; they hold no game rules.
  ui/      HUD, menu, level map and popups (Tailwind and Framer Motion).
  audio/   Web Audio sound effects and generative music, wired to game events.
```

Key decisions:

- **One move path.** Tapping and drag and drop both call the same store function, which uses `applyMove` from `src/game`. Win, jar-complete and stuck checks therefore can't drift apart.
- **Deterministic levels.** The level number seeds the generator. It deals the candies, runs the solver (depth-first search with state hashing, an admissible lower bound and a node limit), rejects deals that are trivial or unsolvable, and ranks the rest by solution length so difficulty rises through each range. If no deal works, it scrambles a solved board by playing legal moves backwards.
- **Smooth frames.** Animation and drag positions update in `useFrame` and read mutable state rather than React state. Components subscribe to narrow store selectors. Geometry and materials are shared, particles are instanced, and Drei's `PerformanceMonitor` lowers the pixel ratio when the frame rate drops (capped at 2).
- **Saved data.** Progress is stored in localStorage under `candy-sort-3d:progress:v1` and settings under `candy-sort-3d:settings:v1`. Each carries a persist `version` and a `migrate` hook. When the save format changes, bump the version and transform old data in `migrate`, so players keep their progress.
- **Fails gracefully.** Storage goes through `safeStorage`, so private browsing or a full quota disables saving instead of crashing. A browser without WebGL gets a clear message, and an error boundary replaces a blank page with a reload prompt.

## Deploying

`npm run build` produces a static site in `dist/` that any static host can serve (GitHub Pages, Netlify, Vercel, S3 or Cloudflare Pages). Asset paths are relative (`base: './'`), so the same build works at a domain root or under a subpath such as `/<repo>/` on GitHub Pages. The level worker is emitted as a separate file, so serve the whole `dist/` folder. Fonts load from Google Fonts; without a network connection the game falls back to system fonts. In dev builds only, the stores are exposed as `window.__candy` for debugging; production builds strip this.
