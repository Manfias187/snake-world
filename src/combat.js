import { WORM_CONFIG } from "./config.js";
import { dropTailFood } from "./pellets.js";
import { playBumpFx, playCutFx, playDeathFx } from "./fx.js";

export function checkWormCombat(scene, time) {
  const aliveWorms = scene.worms.filter((worm) => worm.alive && !worm.isInvulnerable);

  for (let attackerIndex = 0; attackerIndex < aliveWorms.length; attackerIndex += 1) {
    for (let victimIndex = 0; victimIndex < aliveWorms.length; victimIndex += 1) {
      const attacker = aliveWorms[attackerIndex];
      const victim = aliveWorms[victimIndex];

      if (!attacker.alive || !victim.alive || attacker === victim || victim.isInvulnerable || isCombatOnCooldown(scene, attacker, victim, time)) {
        continue;
      }

      const hit = findBodyHit(attacker, victim);
      if (hit) {
        cutVictimTail(scene, attacker, victim, hit.segmentIndex, hit.x, hit.y, time);
      }
    }
  }

  checkHeadCrashes(scene, aliveWorms, time);
}

function findBodyHit(attacker, victim) {
  for (let index = 1; index < victim.segmentSprites.length; index += 1) {
    const segment = victim.segmentSprites[index];
    const distance = Phaser.Math.Distance.Between(attacker.x, attacker.y, segment.x, segment.y);

    if (distance <= WORM_CONFIG.bodyHitRadius) {
      return { segmentIndex: index, x: segment.x, y: segment.y };
    }
  }

  return null;
}

function cutVictimTail(scene, attacker, victim, segmentIndex, x, y, time) {
  if (victim.segmentCount >= attacker.segmentCount * WORM_CONFIG.untouchableRatio) {
    bounceAttackerOff(scene, attacker, victim, x, y, time);
    return;
  }

  const cutStartIndex = Math.min(segmentIndex, victim.segmentCount);
  const removedPositions = victim.cutTail(cutStartIndex);

  if (removedPositions.length === 0) {
    return;
  }

  setCombatCooldown(scene, attacker, victim, time);
  attacker.addGrowth(WORM_CONFIG.cutGrowthPerSegment);
  dropTailFood(scene, removedPositions.slice(1));
  playCutFx(scene, x, y, attacker.angle);

  if (victim.segmentCount < WORM_CONFIG.minSegments) {
    const remainingPositions = victim.eliminate(time);
    dropTailFood(scene, remainingPositions);
    playDeathFx(scene, victim.x, victim.y);
  }
}

function bounceAttackerOff(scene, attacker, victim, x, y, time) {
  setCombatCooldown(scene, attacker, victim, time);
  const bounceAngle = Phaser.Math.Angle.Between(x, y, attacker.x, attacker.y);
  const bounceDistance = WORM_CONFIG.bodyHitRadius + 8;
  attacker.x = x + Math.cos(bounceAngle) * bounceDistance;
  attacker.y = y + Math.sin(bounceAngle) * bounceDistance;
  attacker.angle = bounceAngle;
  if (attacker.ai) {
    attacker.ai.targetAngle = bounceAngle;
  }
  attacker.recordHistory();
  attacker.render(time);
  playBumpFx(scene, x, y);
}

function checkHeadCrashes(scene, aliveWorms, time) {
  for (let leftIndex = 0; leftIndex < aliveWorms.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < aliveWorms.length; rightIndex += 1) {
      const left = aliveWorms[leftIndex];
      const right = aliveWorms[rightIndex];

      if (!left.alive || !right.alive || isCombatOnCooldown(scene, left, right, time)) {
        continue;
      }

      const distance = Phaser.Math.Distance.Between(left.x, left.y, right.x, right.y);
      if (distance > WORM_CONFIG.headHitRadius) {
        continue;
      }

      setCombatCooldown(scene, left, right, time);

      const bigger = left.segmentCount >= right.segmentCount ? left : right;
      const smaller = bigger === left ? right : left;

      if (bigger.segmentCount < smaller.segmentCount * WORM_CONFIG.untouchableRatio) {
        left.angle = Phaser.Math.Angle.Between(right.x, right.y, left.x, left.y);
        right.angle = Phaser.Math.Angle.Between(left.x, left.y, right.x, right.y);
        playCutFx(scene, (left.x + right.x) / 2, (left.y + right.y) / 2, left.angle);
        continue;
      }

      const dropped = smaller.eliminate(time);
      dropTailFood(scene, dropped);
      playDeathFx(scene, smaller.x, smaller.y);
    }
  }
}

export function checkSelfCollisions(scene, time) {
  const skipFirst = 5;
  scene.worms.forEach((worm) => {
    if (!worm.alive || worm.isInvulnerable) {
      return;
    }

    const segments = worm.segmentSprites;
    if (segments.length <= skipFirst) {
      return;
    }

    const hitRadius = WORM_CONFIG.bodyHitRadius * worm.sizeMultiplier;
    let collidingIndex = -1;
    let closestDistance = Infinity;

    for (let index = skipFirst; index < segments.length; index += 1) {
      const segment = segments[index];
      const distance = Phaser.Math.Distance.Between(worm.x, worm.y, segment.x, segment.y);
      if (distance <= hitRadius && distance < closestDistance) {
        collidingIndex = index;
        closestDistance = distance;
      }
    }

    if (collidingIndex === -1) {
      return;
    }

    const hit = segments[collidingIndex];
    const bounceAngle = Phaser.Math.Angle.Between(hit.x, hit.y, worm.x, worm.y);
    const bounceDistance = hitRadius + 8;
    const bouncedX = hit.x + Math.cos(bounceAngle) * bounceDistance;
    const bouncedY = hit.y + Math.sin(bounceAngle) * bounceDistance;

    let trapped = false;
    for (let index = skipFirst; index < segments.length; index += 1) {
      if (index === collidingIndex) {
        continue;
      }
      const segment = segments[index];
      const distance = Phaser.Math.Distance.Between(bouncedX, bouncedY, segment.x, segment.y);
      if (distance <= hitRadius) {
        trapped = true;
        break;
      }
    }

    if (trapped) {
      const dropped = worm.eliminate(time);
      dropTailFood(scene, dropped);
      playDeathFx(scene, worm.x, worm.y);
      return;
    }

    worm.x = bouncedX;
    worm.y = bouncedY;
    worm.angle = bounceAngle;
    if (worm.ai) {
      worm.ai.targetAngle = bounceAngle;
    }
    worm.recordHistory();
    worm.render(time);
    playBumpFx(scene, hit.x, hit.y);
  });
}

function isCombatOnCooldown(scene, attacker, victim, time) {
  const key = combatKey(attacker, victim);
  return (scene.combatCooldowns.get(key) ?? 0) > time;
}

function setCombatCooldown(scene, attacker, victim, time) {
  const expiresAt = time + WORM_CONFIG.combatCooldown;
  scene.combatCooldowns.set(combatKey(attacker, victim), expiresAt);
  scene.combatCooldowns.set(combatKey(victim, attacker), expiresAt);
}

function combatKey(attacker, victim) {
  return `${attacker.id}:${victim.id}`;
}
