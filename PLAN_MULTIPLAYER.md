# Snake World — Multiplayer Plan

This document is the implementation plan to turn the current single-player Phaser game into a real-time multiplayer game playable in the **browser, an iOS app, and an Android app** from the same codebase.

## Goals

1. Multiple human players in the same arena, alongside AI bots that fill empty slots.
2. **One source of truth** on a Node.js server. Clients render what the server says.
3. **Same web build** runs in browsers and inside native iOS/Android shells — no parallel codebases.
4. Latency hidden well enough that touch input feels immediate (no 100 ms steering lag).
5. Tunable, observable, easy to deploy.

Non-goals for the MVP: accounts/login, persistence between rounds, in-app purchases, multiple game modes.

## Architecture overview

```
                 ┌────────────────────────────────┐
                 │  Node.js server                │
                 │  ┌──────────────────────────┐  │
                 │  │ game loop (30 Hz)        │  │
                 │  │   import worm.js         │  │
                 │  │   import combat.js       │  │
                 │  │   import ai.js           │  │
                 │  │   import pellets.js      │  │
                 │  └──────────────────────────┘  │
                 │  ┌──────────────────────────┐  │
                 │  │ WebSocket layer (ws)     │  │
                 │  │   join / leave / input   │  │
                 │  │   snapshot broadcasts    │  │
                 │  └──────────────────────────┘  │
                 └─────────────┬──────────────────┘
                               │ WSS
                ┌──────────────┼─────────────────┐
                │              │                 │
        ┌───────▼───────┐ ┌───▼──────────┐ ┌────▼──────────┐
        │ Browser       │ │ iOS app      │ │ Android app   │
        │ (Phaser)      │ │ (Capacitor   │ │ (Capacitor    │
        │               │ │  wrapping    │ │  wrapping     │
        │               │ │  the same    │ │  the same     │
        │               │ │  web build)  │ │  web build)   │
        └───────────────┘ └──────────────┘ └───────────────┘
```

- The server runs the **authoritative simulation**. It owns every worm position, pellet, chunk, score, and round timer.
- Clients send **inputs** (steering angle) at ~30 Hz and receive **snapshots** at ~20–30 Hz.
- Each client also runs the simulation locally for **the player's own worm only**, for input responsiveness (client-side prediction).
- Mobile apps are the same web bundle wrapped in **Capacitor**. They talk to the server over plain WSS, no platform-specific code paths.

## Tech stack

### Server
- **Node.js 20+** (LTS).
- **`ws`** library for WebSockets. No socket.io — we don't need its fallbacks.
- ES modules natively, so the existing `worm.js` / `combat.js` / `ai.js` / `pellets.js` import unchanged after the headless refactor.
- Zero external state for MVP; single process holds the room in memory.

### Client (web + apps)
- Existing Phaser 3 + vanilla ES modules build, unchanged in shape.
- **Capacitor 6+** for the iOS/Android wrappers. Capacitor copies the static `index.html` + `src/` + `assets/` into a native shell that opens a WKWebView (iOS) or WebView (Android).
- No platform-specific code: same WebSocket URL, same Phaser canvas.

### Transport
- **WSS** (TLS-secured WebSocket). Required by Apple's App Transport Security and Android cleartext rules — plain `ws://` is rejected in production by both platforms.
- Message format: JSON for MVP. Switch to binary (e.g. compact typed-array packing) only if bandwidth becomes a problem.

## Phases of work

### Phase 1 — Decouple game logic from Phaser (~½ day)
The current game modules call `scene.add.sprite(…)`, `scene.tweens.add(…)`, etc. The server cannot run those.

Refactor:
- **`worm.js`** — `Worm` becomes a pure data class: `x, y, angle, history, segmentCount, growthPoints, alive, tint`, plus pure methods (`update`, `recordHistory`, `cutTail`, `eliminate`, `respawn`). No more sprite ownership.
- **`pellets.js`, `combat.js`, `ai.js`, `arena.js`** — return data (added pellets, removed pellets, hit events) instead of mutating Phaser sprites.
- **New `renderer.js`** (client only) — takes the simulation state plus an event stream and creates/updates Phaser sprites + plays fx. Lives where the visual code is today.

This is the only phase that touches existing files significantly. Everything else is new.

### Phase 2 — Node.js server runtime (~½ day)
- New `server/` directory. Top-level `server.js` runs an HTTP+WS server.
- Game loop: `setInterval` at 30 Hz running the same `update()` flow the scene does today (`updatePellets`, `checkWormCombat`, `checkSelfCollisions`, respawns).
- Owns: `worms` array, `pellets` array, `chunks` array, `obstacles`, `combatCooldowns`, round state, tick counter.
- AI bots stay in the simulation; they fill the room until humans join, and slots can be hot-swapped.

### Phase 3 — Protocol + WebSocket layer (~½ day)
- Message types (JSON for MVP):
  - **C→S `join`** — `{ name?, color? }` (server picks a free color if absent).
  - **C→S `input`** — `{ tick, angle }` sent each client frame.
  - **C→S `leave`** — voluntary disconnect.
  - **S→C `welcome`** — `{ yourId, tick, roundEndsAt, world: { width, height, obstacles } }`.
  - **S→C `snapshot`** — `{ tick, worms: [...], pellets: [...], chunks: [...], events: [...] }` at 20–30 Hz.
  - **S→C `bye`** — kicked / room reset.
- **Interest management**: a snapshot only includes pellets/chunks within ~600 px of that client's worm. Cuts payload roughly 5×.
- Server rate-limits inputs (1 angle per tick max), clamps values, and never trusts position data from the client.

### Phase 4 — Client snapshot-driven rendering (~½ day)
- Remove from `scene.js`: the per-frame calls to `playerWorm.update`, `aiWorms.update`, `updatePellets`, `checkWormCombat`, `checkSelfCollisions`.
- Replace with: maintain the last two snapshots; each render frame, interpolate entity positions at `(now − interpDelay)` between those snapshots. Default `interpDelay = 100 ms` (one snapshot's worth of buffer).
- HUD reads its data from the latest snapshot (score, leaderboard, time remaining all come from the server).
- Fx (`playCutFx`, `playDeathFx`, etc.) are triggered by `events[]` in the snapshot, not by local combat detection.

### Phase 5 — Client-side prediction for the local worm (~1 day)
This is the trickiest piece and the one that decides whether the game feels good.

- Maintain a ring buffer of the last ~60 inputs: `[{ tick, angle }, …]`.
- Each client frame: run **the same `Worm#update`** locally on a copy of *your* worm using your latest input. This is what Phaser actually renders for the player.
- When the server snapshot arrives, find the past tick's position for your worm in your local history. Compare to the server-authoritative position.
  - If the delta is small (< ~5 px), smoothly blend toward the server value over a few frames.
  - If the delta is large (teleport, death, big correction), snap.
- Re-apply any inputs the player sent *after* the snapshot tick on top of the corrected position.

Other worms are not predicted — they're pure server interpolation.

### Phase 6 — Lobby, identity, round lifecycle (~½ day)
- **Identity:** server-generated unique id + a free color from the bot palette + a random name (e.g. "Vine-42"). Optional client-supplied name override.
- **Capacity:** one open room, cap 8 human worms; AI bots fill remaining slots up to the original 6-worm density.
- **Reconnect:** if the client reconnects within ~5 s with the same session token, the server re-attaches them to the same worm. Otherwise they get a fresh worm.
- **Round lifecycle:** server owns the timer, broadcasts countdown/start/end as snapshot events, restarts automatically after a few seconds.

### Phase 7 — Production wiring (~½ day)
- **Hosting:** Node app on Fly.io, Render, or a small DigitalOcean droplet. ~$5–10/month for the MVP.
- **TLS (WSS):** required by iOS/Android. Easiest path is a managed cert (Fly/Render do this automatically) or Caddy in front for a VPS.
- **Static client:** serve the `index.html` + `src/` + `assets/` from the same Node process (`express.static` or `serve-handler`). One domain, no CORS.
- **Config:** client reads the WebSocket URL from a build-time constant; for local dev it's `ws://localhost:<port>`, for production it's `wss://yourdomain/ws`.
- **Logs + restarts:** basic stdout logging, process manager (`systemd`, Fly's built-in, etc.) to auto-restart on crash.

### Phase 8 — Mobile app wrappers (~1 day)
- `npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android`.
- `npx cap init "Snake World" com.aptoide.snakeworld --web-dir=.`.
- `npx cap add ios && npx cap add android`.
- Point the wrapped app at the production WSS URL.
- Configure: app icon, launch screen, orientation lock (portrait or landscape — pick one), `viewport` meta tag adjustments for safe-area insets on notched phones.
- iOS: Xcode build, signing, App Store Connect submission flow.
- Android: Gradle build, signed APK/AAB, Play Console submission.
- **No native code written** — Capacitor wraps the same web build that runs in the browser.

### Phase 9 — Testing + tuning (~ongoing, ~2 sessions to feel good)
- Two browser tabs locally, then two phones on the same Wi-Fi, then phones over cellular.
- Use Chrome devtools network throttling to simulate 100 ms / 200 ms / lossy connections.
- Tune the interpolation delay and reconciliation thresholds until movement feels right on a real phone.
- Stress test: spawn N headless bot-clients pointed at the server to find the per-process player cap.
- Sanity: confirm the server clamps inputs, rejects malformed messages, survives sudden disconnects.

## Mobile-specific considerations

- **WSS-only.** Both Apple ATS and Android cleartext rules forbid plain `ws://` in shipped apps. Production must use `wss://`.
- **Background tabs / app backgrounding.** When the player switches apps, the WebSocket will be paused or dropped. The reconnect window in phase 6 handles brief switches; longer absences just respawn the player.
- **Touch only.** The existing pointer-based steering already works; no keyboard fallback needed in the app builds.
- **Battery.** A 30 Hz simulation + 120 Hz rendering on a phone gets warm. We may need to cap rendering to 60 Hz on mobile (Phaser's `fps.target`).
- **Screen sizes.** Phaser FIT mode handles this already, but verify on a notched iPhone and a small Android.
- **Submission gotchas.** App stores reject builds that point at `localhost` or non-TLS endpoints. Verify the WSS URL is correct before each submission.

## Risks / known unknowns

- **Client-side prediction tuning.** Feel comes from numbers we won't know until we test on a real device. Budget extra time here.
- **Cellular jitter.** Mobile connections can spike to 300 ms+ momentarily. Interpolation buffer needs to absorb that without freezing the worm.
- **Single Node process.** Fine for one room of 8 players; if we ever need more rooms, we either spawn multiple processes (one room each) or shard, but that's post-MVP.
- **Cheating.** Anyone can craft WebSocket messages. Server clamping inputs (one angle per tick, no movement data trusted) covers the basics. Don't ever send authoritative state from client.

## Rough total

With the existing modular code as a starting point, the realistic ceiling is **~4–6 dev days of focused work**, paced by mobile-device testing in phases 5 and 9. The bulk of the gameplay logic doesn't get rewritten — it gets moved into a shared place that both sides import.

## Out of scope (deferred)

- Accounts, leaderboards across rounds.
- Spectator mode.
- Voice / text chat.
- In-app purchases, cosmetics.
- Multiple game modes / arenas.
- Server-side anti-cheat beyond input clamping.
- Multiple rooms / matchmaking.
