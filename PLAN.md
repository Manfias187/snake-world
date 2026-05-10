# Snake World Development Plan

## Game Vision

Snake World is a 2D Phaser.js arena game inspired by worm/snake survival games. One worm is controlled by the player, while several rival worms are controlled by AI. The player grows by collecting pellets and by attacking other worms. Worm size is the main score signal: every 10 growth points adds 1 new body segment.

The game should feel fast, readable, and slightly chaotic: worms weave through a top-down arena, compete for pellets, cut each other's tails, and try to become the largest worm before the round ends.

## Core Rules

- Player controls one worm with keyboard and/or pointer steering.
- AI controls the remaining worms.
- Each worm has a head, body segments, a tail, score, growth points, speed, turn rate, and alive/dead state.
- Pellets are small pickups scattered around the arena.
- Collecting pellets adds growth points.
- Every 10 growth points adds 1 worm segment.
- Score corresponds to worm size: `score = segmentCount * 10 + growthPoints`.
- A worm can bite another worm's body.
- If a worm head hits another worm's body, the victim loses the tail section after the contact segment.
- The attacker gains growth points from the cut tail.
- Cut segments can either convert into collectible meat pellets or transfer directly into attacker growth, depending on balance.
- If a worm becomes too short, it is eliminated and drops bonus pellets.
- The round winner is the surviving worm with the highest score or the last worm alive.

## Selected Assets

These assets are from `Legacy Collection Original` and should be copied into `snake-world/assets` during Milestone 1.

| Role | Source asset | Proposed destination | Notes |
| --- | --- | --- | --- |
| Main arena tiles | `Legacy Collection Original/Assets/TinyRPG/Environments/Top-Down-Forest/PNG/top-down-forest-tileset.png` | `snake-world/assets/tiles/top-down-forest-tileset.png` | Best fit for an organic worm arena. Grass, dirt, rocks, trees, and bushes read well from top-down view. |
| Arena preview/reference | `Legacy Collection Original/Assets/TinyRPG/Environments/Top-Down-Forest/top-down-forest-preview.png` | `snake-world/assets/reference/top-down-forest-preview.png` | Reference for tile selection and mood, not necessarily loaded by the game. |
| Pellets / food gems | `Legacy Collection Original/Assets/Misc/gems/spritesheets/gems-spritesheet.png` | `snake-world/assets/pickups/gems-spritesheet.png` | Use 16x16 gem frames as bright pellets. Different colors can represent normal food, bonus food, and dropped tail food. |
| Optional pellet floor tiles | `Legacy Collection Original/Assets/Misc/gems/spritesheets/stage-tileset.png` | `snake-world/assets/tiles/stage-tileset.png` | Optional secondary tile source for special arena zones or menus. |
| Bite hit effect | `Legacy Collection Original/Assets/Explosions and Magic/Hit/hit.png` | `snake-world/assets/fx/hit.png` | Small impact flash when a head bites a body segment. |
| Tail cut slash | `Legacy Collection Original/Assets/Explosions and Magic/Grotto-escape-2-FX/spritesheets/slash-horizontal.png` | `snake-world/assets/fx/slash-horizontal.png` | Clear visual feedback for tail cutting. Rotate as needed based on bite direction. |
| Big collision effect | `Legacy Collection Original/Assets/Explosions and Magic/Grotto-escape-2-FX/spritesheets/energy-smack.png` | `snake-world/assets/fx/energy-smack.png` | Use sparingly for head-to-head crashes or elimination. |
| Worm elimination effect | `Legacy Collection Original/Assets/Explosions and Magic/EnemyDeath/spritesheet.png` | `snake-world/assets/fx/enemy-death.png` | Organic pop/death animation when a worm is removed. |
| Organic color reference | `Legacy Collection Original/Assets/TinyRPG/Characters/Battle Sprites/Living Pack 1/Slime/slime-sheet.png` | `snake-world/assets/reference/slime-sheet.png` | Useful visual reference for worm color palettes. Not ideal as the worm sprite because segmented worms need custom body geometry. |

No literal worm or snake sprite was found in the asset collection. Worms should be drawn procedurally in Phaser using generated circle/rounded segment textures. That gives better control over growth, tail cutting, tinting, collision, and AI readability.

## Worm Visual Plan

- Generate worm textures in Phaser using `Phaser.GameObjects.Graphics`.
- Use separate generated textures for head, body, and tail.
- Tint each worm with a distinct palette: player green/cyan, AI red, yellow, purple, blue.
- Add a small eye/face marker on the head so direction is readable.
- Body segments should overlap slightly for a smooth worm shape.
- Tail segments should taper or use smaller scale.
- Use asset effects for bites, cuts, deaths, and pellet drops.

## Milestone 1: Playable Foundation

Goal: establish the Phaser project and make one worm fun to move and grow.

Status: implemented as the first playable slice in `index.html`, `src/main.js`, and `assets/`.

Deliverables:

- Create the `snake-world` Phaser.js app structure.
- Add `index.html`, `src/main.js`, and an asset folder layout.
- Use Phaser 3 through the same simple CDN style already used by `space-shooter`.
- Copy selected Milestone 1 assets into `snake-world/assets`.
- Build a top-down arena using the forest tileset or a generated grass field with tile decoration.
- Implement player worm movement.
- Implement segmented worm rendering.
- Implement pellet spawning and collection.
- Implement growth points: 10 points adds 1 segment.
- Implement HUD with score, segment count, and growth progress.
- Add start, pause, and restart states.

Acceptance criteria:

- The game runs from a local static server.
- The player worm can steer around the arena.
- Pellets spawn, can be collected, and increase growth points.
- Every 10 growth points visibly adds 1 body segment.
- Score updates live and matches worm size.

## Milestone 2: Rival Worms, AI, and Combat

Goal: turn the prototype into the actual competitive worm game.

Status: implemented with AI worms, tail cutting, combat drops, respawns, and leaderboard.

Deliverables:

- Add 3 to 6 AI worms.
- Give AI worms simple behavior states: seek food, avoid walls, avoid larger heads, chase smaller tails, flee danger.
- Add body collision detection between worm heads and all rival segments.
- Implement tail cutting:
  - Identify the contacted segment index.
  - Remove victim segments after that index.
  - Convert removed segments into dropped food pellets or attacker growth.
  - Play slash and hit effects.
- Implement eating enemy segments and bonus scoring.
- Add elimination rules for worms that become too short.
- Add respawn or round-removal behavior.
- Add leaderboard sorted by score.
- Add minimap or directional offscreen indicators only if the arena becomes larger than the viewport.

Acceptance criteria:

- Multiple AI worms move independently and compete for pellets.
- Player can cut another worm's tail.
- AI worms can cut the player and each other.
- Worm score changes after pellet collection and tail cutting.
- Eliminated worms drop visible rewards and are removed or respawned cleanly.

## Milestone 3: Round Flow, Balance, and Polish

Goal: make the game feel complete enough to play repeatedly.

Status: implemented with countdown, timed rounds, final standings, obstacles, safer spawning, camera tuning, and UI polish.

Deliverables:

- Add title, countdown, active round, game over, and results states.
- Add round timer or win condition.
- Add bot difficulty tuning.
- Add arena boundaries, obstacles, and spawn-safe zones.
- Add camera behavior if the arena is larger than the screen.
- Add polished UI: leaderboard, player rank, growth meter, pause overlay, final standings.
- Add juice:
  - pellet sparkle animation,
  - bite flashes,
  - tail-cut slash,
  - screen shake on major collisions,
  - death pop,
  - segment drop effects.
- Add mobile-friendly pointer steering if desired.
- Add basic balancing constants in one config object.
- Add performance checks for many segments and pellets.

Acceptance criteria:

- A full round can be played from start to results.
- Player, AI, pellets, cutting, scoring, and eliminations all work together.
- The largest worm is clearly identifiable.
- UI stays readable during chaotic play.
- The game can be restarted without reloading the page.

## Proposed Project Structure

```text
snake-world/
  index.html
  package.json
  PLAN.md
  assets/
    fx/
    pickups/
    reference/
    tiles/
  src/
    main.js
```

## Implementation Notes

- Use Phaser Arcade Physics only for broad collision helpers; keep worm segment collision logic custom so tail-cut indexes are reliable.
- Store worm segment history as points along the movement path, then place body segments at fixed spacing along that path.
- Keep collision circles smaller than visual segments to avoid unfair cuts.
- Give newly spawned worms a short invulnerability window.
- Avoid instant self-death until self-collision rules are deliberately added.
- Keep all gameplay constants in a single config section for quick balancing.
