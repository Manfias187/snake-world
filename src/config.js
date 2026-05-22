export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 640;
export const WORLD_WIDTH = 1600;
export const WORLD_HEIGHT = 1120;
export const ASSET_ROOT = "assets";
export const POINTER_DEAD_ZONE = 42;
export const TAIL_SCALES = [0.6, 0.7, 0.9];

export const WORM_CONFIG = {
  speed: 172,
  speedPerSegment: 1.05,
  maxSpeed: 230,
  sizePerSegment: 0.015,
  maxSizeMultiplier: 1.3,
  turnRate: 4.6,
  aiTurnRate: 3.35,
  spacing: 16,
  initialSegments: 4,
  minSegments: 4,
  minHistoryDistance: 0.5,
  growthPerSegment: 10,
  boundsPadding: 34,
  bodyHitRadius: 18,
  headHitRadius: 18,
  combatCooldown: 760,
  spawnInvulnerability: 1700,
  respawnDelay: 2400,
  cutGrowthPerSegment: 1,
  untouchableRatio: 2
};

export const PELLET_CONFIG = {
  targetCount: 80,
  pickupRadius: 22,
  attractRadius: 54,
  attractSpeed: 320,
  spawnPadding: 72,
  spawnWormMinDistance: 140,
  value: 1,
  goldValue: 5,
  goldChance: 0.05,
  dropValue: 10,
  frames: [110, 111, 112, 113],
  goldFrames: [134, 135, 136, 137]
};

export const ROUND_CONFIG = {
  duration: 90000,
  countdown: 3000,
  warningTime: 15000
};

export const AI_CONFIG = {
  thinkDelay: [150, 350],
  foodVision: 620,
  attackVision: 720,
  dangerDistance: 130,
  edgeDistance: 155,
  obstacleDistance: 86,
  wanderTurn: 0.78
};

export const ASSETS = {
  forestPreview: `${ASSET_ROOT}/reference/top-down-forest-preview.png`,
  forestTiles: `${ASSET_ROOT}/tiles/top-down-forest-tileset.png`,
  gems: `${ASSET_ROOT}/pickups/gems-spritesheet.png`,
  hit: `${ASSET_ROOT}/fx/hit.png`,
  slash: `${ASSET_ROOT}/fx/slash-horizontal.png`,
  death: `${ASSET_ROOT}/fx/enemy-death.png`
};

export const BOT_ROSTER = [
  { name: "Vine", tint: 0xff6157, accentTint: 0xffd46a },
  { name: "Amber", tint: 0xffc247, accentTint: 0xfff08f },
  { name: "Violet", tint: 0xb96cff, accentTint: 0xf3a6ff },
  { name: "Azure", tint: 0x5aa8ff, accentTint: 0x9ff9ff },
  { name: "Moss", tint: 0xa8d957, accentTint: 0xf5ff90 }
];

export const OBSTACLE_CONFIG = [
  { x: 440, y: 360, radius: 58 },
  { x: 805, y: 300, radius: 50 },
  { x: 1110, y: 500, radius: 62 },
  { x: 585, y: 790, radius: 54 },
  { x: 1040, y: 850, radius: 50 },
  { x: 1320, y: 735, radius: 56 }
];
