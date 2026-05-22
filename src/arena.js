import { WORLD_WIDTH, WORLD_HEIGHT, WORM_CONFIG, OBSTACLE_CONFIG } from "./config.js";
import { playBumpFx } from "./fx.js";

export function createArena(scene) {
  scene.add.tileSprite(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH, WORLD_HEIGHT, "forest-preview")
    .setAlpha(0.86)
    .setDepth(-20);

  const overlay = scene.add.graphics();
  overlay.setDepth(-15);
  overlay.fillStyle(0x17351f, 0.16);
  overlay.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  const border = scene.add.graphics();
  border.setDepth(5);
  border.lineStyle(8, 0x132413, 0.95);
  border.strokeRect(4, 4, WORLD_WIDTH - 8, WORLD_HEIGHT - 8);
  border.lineStyle(2, 0x86d06f, 0.5);
  border.strokeRect(12, 12, WORLD_WIDTH - 24, WORLD_HEIGHT - 24);
}

export function createObstacles(scene) {
  const obstacles = OBSTACLE_CONFIG.map((obstacle) => ({ ...obstacle }));

  obstacles.forEach((obstacle, index) => {
    const graphics = scene.add.graphics({ x: obstacle.x, y: obstacle.y });
    graphics.setDepth(4);
    graphics.fillStyle(0x1b321e, 0.72);
    graphics.fillCircle(0, 0, obstacle.radius);
    graphics.fillStyle(0x244f2a, 0.9);
    graphics.fillCircle(-obstacle.radius * 0.24, -obstacle.radius * 0.12, obstacle.radius * 0.62);
    graphics.fillStyle(0x335d35, 0.78);
    graphics.fillCircle(obstacle.radius * 0.2, obstacle.radius * 0.16, obstacle.radius * 0.52);
    graphics.lineStyle(3, 0x89d67e, 0.35);
    graphics.strokeCircle(0, 0, obstacle.radius);

    if (index % 2 === 0) {
      graphics.fillStyle(0x5d6f67, 0.9);
      graphics.fillCircle(obstacle.radius * 0.26, -obstacle.radius * 0.2, obstacle.radius * 0.22);
      graphics.fillStyle(0x9ba8a0, 0.72);
      graphics.fillCircle(obstacle.radius * 0.16, -obstacle.radius * 0.28, obstacle.radius * 0.08);
    }

    obstacle.visual = graphics;
  });

  return obstacles;
}

export function isInsideObstacle(scene, x, y, extraRadius = 0) {
  return scene.obstacles.some((obstacle) => {
    const distance = Phaser.Math.Distance.Between(x, y, obstacle.x, obstacle.y);
    return distance < obstacle.radius + extraRadius;
  });
}

export function resolveObstacleCollision(scene, worm) {
  scene.obstacles.forEach((obstacle) => {
    const distance = Phaser.Math.Distance.Between(worm.x, worm.y, obstacle.x, obstacle.y);
    const minDistance = obstacle.radius + WORM_CONFIG.headHitRadius;

    if (distance >= minDistance) {
      return;
    }

    const angle = distance === 0
      ? Phaser.Math.FloatBetween(-Math.PI, Math.PI)
      : Phaser.Math.Angle.Between(obstacle.x, obstacle.y, worm.x, worm.y);

    worm.x = obstacle.x + Math.cos(angle) * minDistance;
    worm.y = obstacle.y + Math.sin(angle) * minDistance;
    worm.angle = angle;

    if (worm.ai) {
      worm.ai.targetAngle = angle;
    }

    worm.recordHistory();
    worm.render(scene.time.now);

    if ((worm.bumpFxAt ?? 0) < scene.time.now) {
      worm.bumpFxAt = scene.time.now + 280;
      playBumpFx(scene, worm.x, worm.y);
    }
  });
}

export function findSafeSpawn(scene) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const spawn = {
      x: Phaser.Math.Between(130, WORLD_WIDTH - 130),
      y: Phaser.Math.Between(130, WORLD_HEIGHT - 130),
      angle: Phaser.Math.FloatBetween(-Math.PI, Math.PI)
    };

    const safe = scene.worms.every((worm) => {
      if (!worm.alive) {
        return true;
      }
      return Phaser.Math.Distance.Between(spawn.x, spawn.y, worm.x, worm.y) > 230;
    }) && !isInsideObstacle(scene, spawn.x, spawn.y, 90);

    if (safe) {
      return spawn;
    }
  }

  return {
    x: WORLD_WIDTH / 2,
    y: WORLD_HEIGHT / 2,
    angle: Phaser.Math.FloatBetween(-Math.PI, Math.PI)
  };
}
