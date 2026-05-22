# Snake World

A 2D Phaser 3 worm-arena game. The player controls one worm; 5 AI worms compete in the same arena. Worms collect pellets to grow, and bite each other's bodies to cut tails. The biggest worm at round end wins.

## Stack

- Phaser 3 (loaded via CDN in `index.html`)
- Vanilla ES modules (no bundler, no transpile step) — `package.json` has `"type": "module"` and HTML loads the entry as `<script type="module">`.
- Static-server delivery — `python3 -m http.server 5175` via `npm run dev`. Any other static server works as long as it serves `.js` with a JS MIME type.

## Run

```
npm run dev
# then open http://localhost:5175
```

## File layout

```
snake-world/
  index.html            # Phaser CDN + canvas mount + entry <script type="module">
  package.json          # "type": "module", dev script
  PLAN.md               # Original design/milestone plan (historical)
  plan.md               # Active bug/feature log (template + open/in-progress/fixed)
  CLAUDE.md             # This file
  assets/
    fx/                 # hit.png, slash-horizontal.png, enemy-death.png
    pickups/            # gems-spritesheet.png (16x16 frames)
    tiles/              # top-down-forest-tileset.png
    reference/          # preview images
  src/
    main.js             # Entry: Phaser game config + boot
    config.js           # All gameplay constants, asset paths, rosters
    utils.js            # rotateToward (shared math helpers)
    worm.js             # Worm class (sprites, history trail, growth, AI state)
    arena.js            # Arena background, obstacles, safe spawn, obstacle collision
    ai.js               # AI behavior (think delay, edge/obstacle/threat/bite/food)
    pellets.js          # Pellet spawn, attract, collect, dropped worm-segment chunks
    combat.js           # Body cuts, head crashes, self-collisions, combat cooldowns
    hud.js              # HUD elements, overlay, countdown, standings, leaderboard
    fx.js               # Visual effects (pickup flash, bump, cut slash, death pop, growth pulse)
    scene.js            # SnakeWorldScene: orchestrates setup + update loop + state machine
```

## Module responsibilities

Helper modules export pure functions that take the `scene` as the first parameter and read/mutate scene properties as needed. The `SnakeWorldScene` class owns mutable state (`worms`, `pellets`, `obstacles`, `combatCooldowns`, round timers, HUD/overlay refs) and orchestrates per-frame calls in `update()`.

The `Worm` class is self-contained: it owns its head/body/tail sprites and history trail. It imports `playGrowthPulse` from `fx.js` directly so it doesn't depend on the scene exposing fx methods.

## Core gameplay

- World: 1600x1120, viewport 960x640, camera follows player and zooms out as player grows.
- Starting size: 4 body segments + 1 head = 5 visible parts. Death threshold = 3 body segments + head (`segmentCount < minSegments`).
- Score = `max(0, (segmentCount - initialSegments) * 10 + growthPoints)` — measures growth **above** starting size, so worms start at 0.
- Bigger worms move faster (`min(maxSpeed, speed + speedPerSegment * extra)`, currently capped at **230 px/s** at ~60 segments) and are visually larger (`min(maxSizeMultiplier, 1 + sizePerSegment * extra)`, currently capped at **1.3×**).
- 5 AI worms: `Vine, Amber, Violet, Azure, Moss`. All start at the same size and score (0) as the player.
- **Pellet tiers** (`PELLET_CONFIG`):
  - **Regular green pellets** — frames `[110, 111, 112, 113]`, value **1**, ~95% of spawns.
  - **Gold coins** — frames `[134, 135, 136, 137]`, value **5**, **5%** chance per spawn (`goldChance`).
  - **Dropped worm-segment chunks** — tinted `worm-body` sprites placed when a worm is cut/killed, value **10** each. Each chunk preserves the victim's per-segment tint (primary/accent).
  - All three live in the same `scene.pellets` group and use the same magnet-attraction + pickup logic.
- Combat rules (single 2× threshold via `WORM_CONFIG.untouchableRatio`):
  - Head-on: if `bigger < smaller * 2` → both bounce. Otherwise smaller is eliminated. **No bonus growth for the killer** — they only get what they pick up from the dropped chunks.
  - Body cut: if `victim ≥ attacker * 2` → bite bounces off, no damage. Otherwise: attacker eats only the bitten segment (1 growth); the rest of the tail detaches as chunks.
- Self-collision: head touching own body past segment index 5 → radial bounce; if bounce position is still inside body → worm dies.
- Pellets and dropped chunks both magnet-attract to the nearest head inside `PELLET_CONFIG.attractRadius` (54 px) at `attractSpeed` (320 px/s).
- Pellets never spawn within `PELLET_CONFIG.spawnWormMinDistance` (140 px) of any alive worm.
- Elimination: worm below `minSegments` dies and drops its remaining body as chunks; respawns after `respawnDelay`.
- Round duration: 90s (use `?shortRound` for 6s).

## Key configs (`src/config.js`)

- `WORM_CONFIG` — `speed` (172, base), `speedPerSegment` (1.05), `maxSpeed` (230, cap), `sizePerSegment` (0.015), `maxSizeMultiplier` (1.3), turn rates, segment spacing, `initialSegments` (4), `minSegments` (4, death threshold), hit radii, combat cooldown, spawn invuln, respawn delay, `cutGrowthPerSegment` (1), `untouchableRatio` (2).
- `PELLET_CONFIG` — `targetCount` (80, steady-state gem count), `pickupRadius` (22), `attractRadius` (54), `attractSpeed` (320), `spawnPadding` (72), `spawnWormMinDistance` (140), `value` (1, green), `goldValue` (5, yellow), `goldChance` (0.05), `dropValue` (10, chunks), `frames` (green), `goldFrames` (yellow).
- `ROUND_CONFIG` — duration, countdown, warningTime.
- `AI_CONFIG` — vision distances, think-delay range, wander turn.
- `OBSTACLE_CONFIG` — fixed circle obstacles in the arena.
- `BOT_ROSTER` — AI names + tints.
- `TAIL_SCALES` — `[0.6, 0.7, 0.9]` — taper scales for the last three body segments.
- `POINTER_DEAD_ZONE` — radius around screen center where touch input is ignored (prevents steering jitter on mobile).

Balance changes should land in `config.js`, not inline.

## URL params (dev shortcuts)

- `?autostart` — skip the start overlay.
- `?skipCountdown` — combined with `?autostart`, jumps straight into play.
- `?shortRound` — 6-second round (useful for round-end testing).
- `?results` — jump to the results screen.

## Controls

- Steer: WASD or arrow keys, or hold pointer (touch acts as a virtual joystick offset from screen center with a dead zone, not as a world-space target).
- Start: Enter or click.
- Pause: P (or click on the pause overlay).
- Restart: R, or click on the results overlay.

## Architecture notes

- `Worm` class owns its own head/body sprites and history trail. Body segments are placed along the recorded position trail (not physics-driven), which keeps tail-cut indexes stable.
- The head and all segments use the same procedurally-generated `worm-body` texture (a tinted circle). The last three segments scale down to taper the worm.
- Collision is custom distance checks, not Arcade Physics — required for reliable tail-cut indexing and self-collision detection.
- New segments are placed on the trail immediately inside `Worm#syncSegments` (it calls `render()` at the end) so the self-collision check never sees a fresh sprite stacked on the head.
- Worm tints are propagated **per-segment** to dropped chunks via `sprite.tintTopLeft` so dropped accents survive a cut.

## Conventions

- Add new gameplay logic to the right module (combat → `combat.js`, etc). The scene should stay thin — orchestration + state, not behavior.
- Keep all gameplay constants in `config.js`.
- Default to no comments; let names carry meaning.
- Don't introduce a bundler or framework — the project is deliberately vanilla + CDN. ES modules natively in the browser.
- When a helper needs scene state, take `scene` as the first argument. Don't pull state into a side-effect singleton.
