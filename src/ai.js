import {
  AI_CONFIG,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORM_CONFIG
} from "./config.js";

export function getAiTargetAngle(scene, worm, time) {
  if (time < worm.ai.nextThinkAt) {
    return worm.ai.targetAngle;
  }

  worm.ai.nextThinkAt = time + Phaser.Math.Between(AI_CONFIG.thinkDelay[0], AI_CONFIG.thinkDelay[1]);

  const edgeAngle = getEdgeAvoidanceAngle(worm);
  if (edgeAngle !== null) {
    worm.ai.state = "EDGE";
    worm.ai.targetAngle = edgeAngle;
    return worm.ai.targetAngle;
  }

  const obstacleAngle = getObstacleAvoidanceAngle(scene, worm);
  if (obstacleAngle !== null) {
    worm.ai.state = "AVOID";
    worm.ai.targetAngle = obstacleAngle;
    return worm.ai.targetAngle;
  }

  const threat = findThreateningHead(scene, worm);
  if (threat) {
    worm.ai.state = "FLEE";
    worm.ai.targetAngle = Phaser.Math.Angle.Between(threat.x, threat.y, worm.x, worm.y);
    return worm.ai.targetAngle;
  }

  const huntTarget = findHuntTarget(scene, worm);
  if (huntTarget) {
    worm.ai.state = "HUNT";
    worm.ai.targetAngle = Phaser.Math.Angle.Between(worm.x, worm.y, huntTarget.x, huntTarget.y);
    return worm.ai.targetAngle;
  }

  const biteTarget = findBiteTarget(scene, worm);
  if (biteTarget) {
    worm.ai.state = "BITE";
    worm.ai.targetAngle = Phaser.Math.Angle.Between(worm.x, worm.y, biteTarget.x, biteTarget.y);
    return worm.ai.targetAngle;
  }

  const pellet = findNearestPellet(scene, worm, AI_CONFIG.foodVision);
  if (pellet) {
    worm.ai.state = "FOOD";
    worm.ai.targetAngle = Phaser.Math.Angle.Between(worm.x, worm.y, pellet.x, pellet.y);
    return worm.ai.targetAngle;
  }

  worm.ai.state = "ROAM";
  worm.ai.targetAngle = Phaser.Math.Angle.Wrap(
    worm.ai.targetAngle + Phaser.Math.FloatBetween(-AI_CONFIG.wanderTurn, AI_CONFIG.wanderTurn)
  );
  return worm.ai.targetAngle;
}

function getEdgeAvoidanceAngle(worm) {
  const edge = AI_CONFIG.edgeDistance;
  const nearLeft = worm.x < edge;
  const nearRight = worm.x > WORLD_WIDTH - edge;
  const nearTop = worm.y < edge;
  const nearBottom = worm.y > WORLD_HEIGHT - edge;

  if (!nearLeft && !nearRight && !nearTop && !nearBottom) {
    return null;
  }

  return Phaser.Math.Angle.Between(worm.x, worm.y, WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
}

function getObstacleAvoidanceAngle(scene, worm) {
  let nearest = null;
  let nearestDistance = Infinity;

  scene.obstacles.forEach((obstacle) => {
    const distance = Phaser.Math.Distance.Between(worm.x, worm.y, obstacle.x, obstacle.y);
    const avoidDistance = obstacle.radius + AI_CONFIG.obstacleDistance;

    if (distance < avoidDistance && distance < nearestDistance) {
      nearest = obstacle;
      nearestDistance = distance;
    }
  });

  if (!nearest) {
    return null;
  }

  return Phaser.Math.Angle.Between(nearest.x, nearest.y, worm.x, worm.y);
}

function findThreateningHead(scene, worm) {
  let nearest = null;
  let nearestDistance = Infinity;

  scene.worms.forEach((other) => {
    if (other === worm || !other.alive || other.isInvulnerable) {
      return;
    }

    if (other.segmentCount < worm.segmentCount * WORM_CONFIG.untouchableRatio) {
      return;
    }

    const distance = Phaser.Math.Distance.Between(worm.x, worm.y, other.x, other.y);
    if (distance < AI_CONFIG.dangerDistance && distance < nearestDistance) {
      nearest = other;
      nearestDistance = distance;
    }
  });

  return nearest;
}

function findHuntTarget(scene, worm) {
  let best = null;
  let bestDistance = Infinity;

  scene.worms.forEach((victim) => {
    if (victim === worm || !victim.alive || victim.isInvulnerable) {
      return;
    }

    if (worm.segmentCount < victim.segmentCount * WORM_CONFIG.untouchableRatio) {
      return;
    }

    const distance = Phaser.Math.Distance.Between(worm.x, worm.y, victim.x, victim.y);
    if (distance < AI_CONFIG.attackVision && distance < bestDistance) {
      best = victim;
      bestDistance = distance;
    }
  });

  return best;
}

function findBiteTarget(scene, worm) {
  let best = null;
  let bestDistance = Infinity;

  scene.worms.forEach((victim) => {
    if (victim === worm || !victim.alive || victim.isInvulnerable) {
      return;
    }

    if (victim.segmentCount >= worm.segmentCount * WORM_CONFIG.untouchableRatio) {
      return;
    }

    for (let index = 2; index < victim.segmentSprites.length; index += 1) {
      const segment = victim.segmentSprites[index];
      const distance = Phaser.Math.Distance.Between(worm.x, worm.y, segment.x, segment.y);

      if (distance < AI_CONFIG.attackVision && distance < bestDistance) {
        best = segment;
        bestDistance = distance;
      }
    }
  });

  return best;
}

function findNearestPellet(scene, worm, maxDistance) {
  let nearest = null;
  let nearestDistance = maxDistance;

  scene.pellets.children.each((pellet) => {
    const distance = Phaser.Math.Distance.Between(worm.x, worm.y, pellet.x, pellet.y);
    if (distance < nearestDistance) {
      nearest = pellet;
      nearestDistance = distance;
    }
  });

  return nearest;
}
