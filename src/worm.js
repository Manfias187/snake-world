import { WORM_CONFIG, WORLD_WIDTH, WORLD_HEIGHT, TAIL_SCALES } from "./config.js";
import { rotateToward } from "./utils.js";
import { playGrowthPulse } from "./fx.js";

export class Worm {
  constructor(scene, options) {
    this.scene = scene;
    this.id = options.id;
    this.name = options.name;
    this.isPlayer = options.isPlayer;
    this.tint = options.tint;
    this.accentTint = options.accentTint;
    this.labelColor = options.labelColor;
    this.baseSpeed = options.speed ?? WORM_CONFIG.speed;
    this.turnRate = options.turnRate ?? WORM_CONFIG.turnRate;
    this.initialSegments = options.segmentCount ?? WORM_CONFIG.initialSegments;
    this.segmentCount = this.initialSegments;
    this.growthPoints = 0;
    this.alive = true;
    this.respawnAt = 0;
    this.invulnerableUntil = scene.time.now + WORM_CONFIG.spawnInvulnerability;
    this.ai = options.ai ? {
      targetAngle: options.angle,
      state: "SEEK",
      nextThinkAt: 0
    } : null;
    this.x = options.x;
    this.y = options.y;
    this.angle = options.angle;
    this.history = [];
    this.segmentSprites = [];

    this.head = scene.add.image(this.x, this.y, "worm-head");
    this.head.setTint(this.tint);
    this.head.setDepth(55);
    this.head.setRotation(this.angle);

    this.nameTag = scene.add.text(this.x, this.y - 30, this.name, {
      fontFamily: '"Courier New", monospace',
      fontSize: "12px",
      color: this.labelColor,
      stroke: "#10200f",
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(86);

    this.seedHistory();
    this.syncSegments();
    this.render(scene.time.now);
  }

  get score() {
    const total = (this.segmentCount - this.initialSegments) * WORM_CONFIG.growthPerSegment + this.growthPoints;
    return Math.max(0, total);
  }

  get isInvulnerable() {
    return this.scene.time.now < this.invulnerableUntil;
  }

  get currentSpeed() {
    const extra = Math.max(0, this.segmentCount - this.initialSegments);
    return Math.min(WORM_CONFIG.maxSpeed, this.baseSpeed + extra * WORM_CONFIG.speedPerSegment);
  }

  get sizeMultiplier() {
    const extra = Math.max(0, this.segmentCount - this.initialSegments);
    return Math.min(WORM_CONFIG.maxSizeMultiplier, 1 + extra * WORM_CONFIG.sizePerSegment);
  }

  seedHistory() {
    const step = WORM_CONFIG.minHistoryDistance;
    const total = (this.segmentCount + 8) * WORM_CONFIG.spacing * this.sizeMultiplier;
    this.history.length = 0;

    for (let distance = 0; distance <= total; distance += step) {
      this.history.push({
        x: this.x - Math.cos(this.angle) * distance,
        y: this.y - Math.sin(this.angle) * distance,
        angle: this.angle
      });
    }
  }

  syncSegments() {
    while (this.segmentSprites.length < this.segmentCount) {
      const index = this.segmentSprites.length;
      const sprite = this.scene.add.image(this.x, this.y, "worm-body");
      sprite.setTint(this.tint);
      sprite.setDepth(48 - index * 0.01);
      this.segmentSprites.push(sprite);
    }

    while (this.segmentSprites.length > this.segmentCount) {
      this.segmentSprites.pop().destroy();
    }

    const size = this.sizeMultiplier;
    this.segmentSprites.forEach((sprite, index) => {
      const total = this.segmentSprites.length;
      const fromEnd = total - 1 - index;
      const taperScale = fromEnd < TAIL_SCALES.length ? TAIL_SCALES[fromEnd] : 1;
      sprite.setTexture("worm-body");
      sprite.setTint(index % 3 === 1 ? this.accentTint : this.tint);
      sprite.setScale(taperScale * size);
      sprite.setVisible(this.alive);
    });

    this.render(this.scene.time.now);
  }

  addGrowth(points) {
    if (!this.alive) {
      return;
    }

    this.growthPoints += points;

    while (this.growthPoints >= WORM_CONFIG.growthPerSegment) {
      this.growthPoints -= WORM_CONFIG.growthPerSegment;
      this.segmentCount += 1;
      this.syncSegments();
      playGrowthPulse(this.scene, this);
    }
  }

  update(delta, targetAngle, time) {
    if (!this.alive) {
      return;
    }

    const dt = delta / 1000;
    this.angle = rotateToward(this.angle, targetAngle, this.turnRate * dt);

    this.x += Math.cos(this.angle) * this.currentSpeed * dt;
    this.y += Math.sin(this.angle) * this.currentSpeed * dt;
    this.keepInsideArena();
    this.recordHistory();
    this.render(time);
  }

  keepInsideArena() {
    const padding = WORM_CONFIG.boundsPadding;
    this.x = Phaser.Math.Clamp(this.x, padding, WORLD_WIDTH - padding);
    this.y = Phaser.Math.Clamp(this.y, padding, WORLD_HEIGHT - padding);
  }

  recordHistory() {
    if (this.history.length === 0) {
      this.seedHistory();
      return;
    }

    const last = this.history[0];
    const distance = Phaser.Math.Distance.Between(this.x, this.y, last.x, last.y);

    if (distance < WORM_CONFIG.minHistoryDistance) {
      last.x = this.x;
      last.y = this.y;
      last.angle = this.angle;
      return;
    }

    this.history.unshift({ x: this.x, y: this.y, angle: this.angle });
    this.trimHistory();
  }

  trimHistory() {
    const maxPoints = Math.ceil(((this.segmentCount + 8) * WORM_CONFIG.spacing * this.sizeMultiplier) / WORM_CONFIG.minHistoryDistance);
    if (this.history.length > maxPoints) {
      this.history.length = maxPoints;
    }
  }

  render(time) {
    const invulnerableAlpha = this.alive && time < this.invulnerableUntil
      ? 0.5 + Math.sin(time / 90) * 0.18
      : 1;

    const size = this.sizeMultiplier;
    const segmentSpacing = WORM_CONFIG.spacing * size;

    this.head.setPosition(this.x, this.y);
    this.head.setRotation(this.angle);
    this.head.setAlpha(invulnerableAlpha);
    this.head.setScale(size);
    this.head.setVisible(this.alive);

    const total = this.segmentSprites.length;
    let cumulativeDistance = 0;
    this.segmentSprites.forEach((sprite, index) => {
      const fromEnd = total - 1 - index;
      const taperScale = fromEnd < TAIL_SCALES.length ? TAIL_SCALES[fromEnd] : 1;
      cumulativeDistance += segmentSpacing * taperScale;
      const point = this.getHistoryPoint(cumulativeDistance);
      sprite.setPosition(point.x, point.y);
      sprite.setRotation(point.angle);
      sprite.setAlpha(invulnerableAlpha);
    });

    this.nameTag.setPosition(this.x, this.y - 34);
    this.nameTag.setText(this.alive ? this.name : `${this.name} KO`);
    this.nameTag.setAlpha(this.alive ? 1 : 0.72);
  }

  getHistoryPoint(targetDistance) {
    let walked = 0;

    for (let index = 0; index < this.history.length - 1; index += 1) {
      const current = this.history[index];
      const next = this.history[index + 1];
      const segmentDistance = Phaser.Math.Distance.Between(current.x, current.y, next.x, next.y);

      if (segmentDistance === 0) {
        continue;
      }

      if (walked + segmentDistance >= targetDistance) {
        const ratio = (targetDistance - walked) / segmentDistance;
        return {
          x: Phaser.Math.Linear(current.x, next.x, ratio),
          y: Phaser.Math.Linear(current.y, next.y, ratio),
          angle: Phaser.Math.Angle.Between(next.x, next.y, current.x, current.y)
        };
      }

      walked += segmentDistance;
    }

    return this.history[this.history.length - 1] ?? { x: this.x, y: this.y, angle: this.angle };
  }

  getSegmentPositions() {
    return this.segmentSprites.map((sprite) => ({ x: sprite.x, y: sprite.y, tint: sprite.tintTopLeft }));
  }

  cutTail(cutStartIndex) {
    const safeStart = Phaser.Math.Clamp(cutStartIndex, 0, this.segmentSprites.length);
    const removedSprites = this.segmentSprites.splice(safeStart);
    const removedPositions = removedSprites.map((sprite) => ({ x: sprite.x, y: sprite.y, tint: sprite.tintTopLeft }));

    removedSprites.forEach((sprite) => sprite.destroy());
    this.segmentCount = this.segmentSprites.length;
    this.syncSegments();
    this.trimHistory();

    return removedPositions;
  }

  eliminate(time) {
    if (!this.alive) {
      return [];
    }

    const remainingPositions = this.getSegmentPositions();
    this.alive = false;
    this.respawnAt = time + WORM_CONFIG.respawnDelay;
    this.head.setVisible(false);
    this.segmentSprites.forEach((sprite) => sprite.destroy());
    this.segmentSprites.length = 0;
    this.nameTag.setText(`${this.name} KO`);

    return remainingPositions;
  }

  respawn(spawn, time) {
    this.x = spawn.x;
    this.y = spawn.y;
    this.angle = spawn.angle;
    this.segmentCount = this.initialSegments;
    this.growthPoints = 0;
    this.alive = true;
    this.respawnAt = 0;
    this.invulnerableUntil = time + WORM_CONFIG.spawnInvulnerability;
    this.history.length = 0;
    this.seedHistory();
    this.syncSegments();
    this.head.setVisible(true);
    this.nameTag.setVisible(true);

    if (this.ai) {
      this.ai.targetAngle = this.angle;
      this.ai.nextThinkAt = 0;
      this.ai.state = "SEEK";
    }

    this.render(time);
  }
}
