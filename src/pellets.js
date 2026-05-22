import {
  PELLET_CONFIG,
  WORLD_WIDTH,
  WORLD_HEIGHT
} from "./config.js";
import { isInsideObstacle } from "./arena.js";
import { playPickupFlash } from "./fx.js";

export function createPellets(scene) {
  scene.pellets = scene.add.group();

  for (let index = 0; index < PELLET_CONFIG.targetCount; index += 1) {
    spawnPellet(scene);
  }
}

export function spawnPellet(scene, x, y, options = {}) {
  const padding = PELLET_CONFIG.spawnPadding;
  const isDrop = options.isDrop ?? false;
  const isGold = options.isGold ?? (!isDrop && Math.random() < PELLET_CONFIG.goldChance);
  const frames = options.frames ?? (isGold ? PELLET_CONFIG.goldFrames : PELLET_CONFIG.frames);
  const value = options.value ?? (isGold ? PELLET_CONFIG.goldValue : PELLET_CONFIG.value);
  const point = x === undefined || y === undefined
    ? getSafePelletPoint(scene)
    : { x, y };
  const pellet = scene.add.sprite(
    Phaser.Math.Clamp(point.x, padding, WORLD_WIDTH - padding),
    Phaser.Math.Clamp(point.y, padding, WORLD_HEIGHT - padding),
    "gems",
    Phaser.Utils.Array.GetRandom(frames)
  );

  pellet.setScale(options.scale ?? (isDrop ? 1.5 : 1.35));
  pellet.setDepth(isDrop ? 3 : 2);
  pellet.setData("value", value);
  pellet.setData("isDrop", isDrop);
  scene.pellets.add(pellet);

  scene.tweens.add({
    targets: pellet,
    scale: (options.scale ?? (isDrop ? 1.5 : 1.35)) + 0.18,
    duration: Phaser.Math.Between(520, 820),
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut"
  });

  return pellet;
}

export function getSafePelletPoint(scene) {
  const padding = PELLET_CONFIG.spawnPadding;
  const minWormDistance = PELLET_CONFIG.spawnWormMinDistance;
  const worms = scene.worms ?? [];

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const point = {
      x: Phaser.Math.Between(padding, WORLD_WIDTH - padding),
      y: Phaser.Math.Between(padding, WORLD_HEIGHT - padding)
    };

    if (isInsideObstacle(scene, point.x, point.y, 30)) {
      continue;
    }

    const tooCloseToWorm = worms.some((worm) => {
      if (!worm.alive) {
        return false;
      }
      return Phaser.Math.Distance.Between(point.x, point.y, worm.x, worm.y) < minWormDistance;
    });

    if (!tooCloseToWorm) {
      return point;
    }
  }

  return {
    x: Phaser.Math.Between(padding, WORLD_WIDTH - padding),
    y: Phaser.Math.Between(padding, WORLD_HEIGHT - padding)
  };
}

export function spawnDroppedSegment(scene, x, y, tint) {
  const padding = PELLET_CONFIG.spawnPadding;
  const segment = scene.add.sprite(
    Phaser.Math.Clamp(x, padding, WORLD_WIDTH - padding),
    Phaser.Math.Clamp(y, padding, WORLD_HEIGHT - padding),
    "worm-body"
  );
  segment.setTint(tint ?? 0xffffff);
  segment.setScale(0.95);
  segment.setDepth(3);
  segment.setData("value", PELLET_CONFIG.dropValue);
  segment.setData("isDrop", true);
  scene.pellets.add(segment);
  return segment;
}

export function dropTailFood(scene, positions) {
  positions.forEach((point) => {
    spawnDroppedSegment(
      scene,
      point.x + Phaser.Math.Between(-4, 4),
      point.y + Phaser.Math.Between(-4, 4),
      point.tint
    );
  });
}

export function updatePellets(scene, delta) {
  const aliveWorms = scene.worms.filter((worm) => worm.alive);
  if (aliveWorms.length === 0) {
    return;
  }

  const attractStep = PELLET_CONFIG.attractSpeed * (delta / 1000);
  const toCollect = [];

  scene.pellets.children.each((pellet) => {
    let nearest = null;
    let nearestDistance = Infinity;

    aliveWorms.forEach((worm) => {
      const distance = Phaser.Math.Distance.Between(worm.x, worm.y, pellet.x, pellet.y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = worm;
      }
    });

    if (!nearest) {
      return;
    }

    if (nearestDistance <= PELLET_CONFIG.pickupRadius) {
      toCollect.push({ worm: nearest, pellet });
      return;
    }

    if (nearestDistance <= PELLET_CONFIG.attractRadius) {
      const angle = Phaser.Math.Angle.Between(pellet.x, pellet.y, nearest.x, nearest.y);
      pellet.x += Math.cos(angle) * attractStep;
      pellet.y += Math.sin(angle) * attractStep;
    }
  });

  toCollect.forEach(({ worm, pellet }) => collectPellet(scene, worm, pellet));
}

export function collectPellet(scene, worm, pellet) {
  if (!worm.alive || !pellet.active) {
    return;
  }

  const value = pellet.getData("value");
  const isDrop = pellet.getData("isDrop");
  const x = pellet.x;
  const y = pellet.y;

  scene.tweens.killTweensOf(pellet);
  pellet.destroy();
  worm.addGrowth(value);
  playPickupFlash(scene, x, y);

  if (!isDrop) {
    spawnPellet(scene);
  }
}
