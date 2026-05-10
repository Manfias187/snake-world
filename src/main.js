const GAME_WIDTH = 960;
const GAME_HEIGHT = 640;
const WORLD_WIDTH = 1600;
const WORLD_HEIGHT = 1120;
const ASSET_ROOT = "assets";

const WORM_CONFIG = {
  speed: 172,
  aiSpeed: 152,
  turnRate: 4.6,
  aiTurnRate: 3.35,
  spacing: 16,
  initialSegments: 8,
  minSegments: 4,
  minHistoryDistance: 2,
  growthPerSegment: 10,
  boundsPadding: 34,
  bodyHitRadius: 18,
  headHitRadius: 18,
  combatCooldown: 760,
  spawnInvulnerability: 1700,
  respawnDelay: 2400,
  cutGrowthPerSegment: 1
};

const PELLET_CONFIG = {
  targetCount: 72,
  pickupRadius: 22,
  spawnPadding: 72,
  value: 1,
  dropValue: 2,
  frames: [57, 58, 59, 60, 61, 62, 63, 64, 110, 111, 112, 113],
  dropFrames: [82, 83, 84, 85, 86, 87, 88, 135, 136, 137, 138]
};

const ROUND_CONFIG = {
  duration: 90000,
  countdown: 3000,
  warningTime: 15000
};

const AI_CONFIG = {
  thinkDelay: [230, 520],
  foodVision: 620,
  attackVision: 480,
  dangerDistance: 190,
  edgeDistance: 155,
  obstacleDistance: 86,
  wanderTurn: 0.78
};

const ASSETS = {
  forestPreview: `${ASSET_ROOT}/reference/top-down-forest-preview.png`,
  forestTiles: `${ASSET_ROOT}/tiles/top-down-forest-tileset.png`,
  gems: `${ASSET_ROOT}/pickups/gems-spritesheet.png`,
  hit: `${ASSET_ROOT}/fx/hit.png`,
  slash: `${ASSET_ROOT}/fx/slash-horizontal.png`,
  death: `${ASSET_ROOT}/fx/enemy-death.png`
};

const BOT_ROSTER = [
  { name: "Vine", tint: 0xff6157, accentTint: 0xffd46a },
  { name: "Amber", tint: 0xffc247, accentTint: 0xfff08f },
  { name: "Violet", tint: 0xb96cff, accentTint: 0xf3a6ff },
  { name: "Azure", tint: 0x5aa8ff, accentTint: 0x9ff9ff },
  { name: "Moss", tint: 0xa8d957, accentTint: 0xf5ff90 }
];

const OBSTACLE_CONFIG = [
  { x: 440, y: 360, radius: 58 },
  { x: 805, y: 300, radius: 50 },
  { x: 1110, y: 500, radius: 62 },
  { x: 585, y: 790, radius: 54 },
  { x: 1040, y: 850, radius: 50 },
  { x: 1320, y: 735, radius: 56 }
];

class Worm {
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
    return this.segmentCount * WORM_CONFIG.growthPerSegment + this.growthPoints;
  }

  get isInvulnerable() {
    return this.scene.time.now < this.invulnerableUntil;
  }

  seedHistory() {
    const step = WORM_CONFIG.minHistoryDistance;
    const total = (this.segmentCount + 8) * WORM_CONFIG.spacing;
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
      const texture = index === this.segmentCount - 1 ? "worm-tail" : "worm-body";
      const sprite = this.scene.add.image(this.x, this.y, texture);
      sprite.setTint(this.tint);
      sprite.setDepth(48 - index * 0.01);
      this.segmentSprites.push(sprite);
    }

    while (this.segmentSprites.length > this.segmentCount) {
      this.segmentSprites.pop().destroy();
    }

    this.segmentSprites.forEach((sprite, index) => {
      const isTail = index === this.segmentSprites.length - 1;
      sprite.setTexture(isTail ? "worm-tail" : "worm-body");
      sprite.setTint(index % 3 === 1 ? this.accentTint : this.tint);
      sprite.setScale(isTail ? 0.92 : 1);
      sprite.setVisible(this.alive);
    });
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
      this.scene.playGrowthPulse(this);
    }
  }

  update(delta, targetAngle, time) {
    if (!this.alive) {
      return;
    }

    const dt = delta / 1000;
    this.angle = rotateToward(this.angle, targetAngle, this.turnRate * dt);

    this.x += Math.cos(this.angle) * this.baseSpeed * dt;
    this.y += Math.sin(this.angle) * this.baseSpeed * dt;
    this.keepInsideArena();
    this.recordHistory();
    this.render(time);
  }

  keepInsideArena() {
    const padding = WORM_CONFIG.boundsPadding;
    let bounced = false;

    if (this.x < padding) {
      this.x = padding;
      bounced = true;
    } else if (this.x > WORLD_WIDTH - padding) {
      this.x = WORLD_WIDTH - padding;
      bounced = true;
    }

    if (this.y < padding) {
      this.y = padding;
      bounced = true;
    } else if (this.y > WORLD_HEIGHT - padding) {
      this.y = WORLD_HEIGHT - padding;
      bounced = true;
    }

    if (bounced) {
      this.angle = Phaser.Math.Angle.Between(this.x, this.y, WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
      if (this.ai) {
        this.ai.targetAngle = this.angle;
      }
    }
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
    const maxPoints = Math.ceil(((this.segmentCount + 8) * WORM_CONFIG.spacing) / WORM_CONFIG.minHistoryDistance);
    if (this.history.length > maxPoints) {
      this.history.length = maxPoints;
    }
  }

  render(time) {
    const invulnerableAlpha = this.alive && time < this.invulnerableUntil
      ? 0.5 + Math.sin(time / 90) * 0.18
      : 1;

    this.head.setPosition(this.x, this.y);
    this.head.setRotation(this.angle);
    this.head.setAlpha(invulnerableAlpha);
    this.head.setVisible(this.alive);

    this.segmentSprites.forEach((sprite, index) => {
      const point = this.getHistoryPoint((index + 1) * WORM_CONFIG.spacing);
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
    return this.segmentSprites.map((sprite) => ({ x: sprite.x, y: sprite.y }));
  }

  cutTail(cutStartIndex) {
    const safeStart = Phaser.Math.Clamp(cutStartIndex, 0, this.segmentSprites.length);
    const removedSprites = this.segmentSprites.splice(safeStart);
    const removedPositions = removedSprites.map((sprite) => ({ x: sprite.x, y: sprite.y }));

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

class SnakeWorldScene extends Phaser.Scene {
  constructor() {
    super("SnakeWorldScene");
  }

  preload() {
    this.load.image("forest-preview", ASSETS.forestPreview);
    this.load.image("forest-tiles", ASSETS.forestTiles);
    this.load.spritesheet("gems", ASSETS.gems, { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("hit", ASSETS.hit, { frameWidth: 31, frameHeight: 32 });
    this.load.spritesheet("slash", ASSETS.slash, { frameWidth: 65, frameHeight: 40 });
    this.load.spritesheet("death", ASSETS.death, { frameWidth: 48, frameHeight: 48 });
  }

  create() {
    this.urlParams = new URLSearchParams(window.location.search);
    this.state = "ready";
    this.pausedState = "ready";
    this.roundStartedAt = 0;
    this.roundEndsAt = 0;
    this.countdownEndsAt = 0;
    this.pauseStartedAt = 0;
    this.roundDuration = this.urlParams.has("shortRound")
      ? 6000
      : ROUND_CONFIG.duration;
    this.lastInputAngle = 0;
    this.combatCooldowns = new Map();
    this.cameras.main.setBackgroundColor("#14351f");
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    this.createTextures();
    this.createAnimations();
    this.createArena();
    this.createObstacles();
    this.createInput();
    this.createPellets();
    this.createWorms();
    this.createHud();
    this.createOverlay();
    this.refreshHud();

    if (this.urlParams.has("autostart")) {
      this.startRound(this.urlParams.has("skipCountdown"));
    }

    if (this.urlParams.has("results")) {
      this.startRound(true);
      this.finishRound();
    }
  }

  createTextures() {
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });

    graphics.clear();
    graphics.fillStyle(0xffffff, 1);
    graphics.fillEllipse(20, 20, 34, 30);
    graphics.lineStyle(3, 0x9affd6, 0.75);
    graphics.strokeEllipse(20, 20, 34, 30);
    graphics.fillStyle(0x07150c, 1);
    graphics.fillCircle(27, 14, 3);
    graphics.fillCircle(27, 26, 3);
    graphics.generateTexture("worm-head", 40, 40);

    graphics.clear();
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(16, 16, 13);
    graphics.lineStyle(2, 0xa9ffe5, 0.55);
    graphics.strokeCircle(16, 16, 13);
    graphics.generateTexture("worm-body", 32, 32);

    graphics.clear();
    graphics.fillStyle(0xffffff, 1);
    graphics.fillEllipse(16, 16, 22, 18);
    graphics.lineStyle(2, 0xa9ffe5, 0.55);
    graphics.strokeEllipse(16, 16, 22, 18);
    graphics.generateTexture("worm-tail", 32, 32);
    graphics.destroy();
  }

  createAnimations() {
    this.anims.create({
      key: "pickup-flash",
      frames: this.anims.generateFrameNumbers("hit", { start: 0, end: 2 }),
      frameRate: 18,
      hideOnComplete: true
    });

    this.anims.create({
      key: "tail-slash",
      frames: this.anims.generateFrameNumbers("slash", { start: 0, end: 4 }),
      frameRate: 18,
      hideOnComplete: true
    });

    this.anims.create({
      key: "worm-pop",
      frames: this.anims.generateFrameNumbers("death", { start: 0, end: 7 }),
      frameRate: 18,
      hideOnComplete: true
    });
  }

  createArena() {
    this.add.tileSprite(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH, WORLD_HEIGHT, "forest-preview")
      .setAlpha(0.86)
      .setDepth(-20);

    const overlay = this.add.graphics();
    overlay.setDepth(-15);
    overlay.fillStyle(0x17351f, 0.16);
    overlay.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    const border = this.add.graphics();
    border.setDepth(5);
    border.lineStyle(8, 0x132413, 0.95);
    border.strokeRect(4, 4, WORLD_WIDTH - 8, WORLD_HEIGHT - 8);
    border.lineStyle(2, 0x86d06f, 0.5);
    border.strokeRect(12, 12, WORLD_WIDTH - 24, WORLD_HEIGHT - 24);
  }

  createObstacles() {
    this.obstacles = OBSTACLE_CONFIG.map((obstacle) => ({ ...obstacle }));

    this.obstacles.forEach((obstacle, index) => {
      const graphics = this.add.graphics({ x: obstacle.x, y: obstacle.y });
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
  }

  createInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      start: Phaser.Input.Keyboard.KeyCodes.ENTER,
      pause: Phaser.Input.Keyboard.KeyCodes.P,
      restart: Phaser.Input.Keyboard.KeyCodes.R
    });

    this.input.on("pointerdown", () => {
      if (this.state === "ready") {
        this.startRound();
      } else if (this.state === "paused") {
        this.togglePause();
      } else if (this.state === "finished") {
        this.scene.restart();
      }
    });
  }

  createPellets() {
    this.pellets = this.add.group();

    for (let index = 0; index < PELLET_CONFIG.targetCount; index += 1) {
      this.spawnPellet();
    }
  }

  createWorms() {
    this.worms = [];
    this.aiWorms = [];

    const playerSpawn = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2, angle: -0.2 };
    this.playerWorm = new Worm(this, {
      id: "player",
      name: "You",
      isPlayer: true,
      x: playerSpawn.x,
      y: playerSpawn.y,
      angle: playerSpawn.angle,
      tint: 0x3bf3a0,
      accentTint: 0x8df7ff,
      labelColor: "#ecffd5",
      speed: WORM_CONFIG.speed,
      turnRate: WORM_CONFIG.turnRate
    });

    this.worms.push(this.playerWorm);

    BOT_ROSTER.forEach((bot, index) => {
      const spawn = this.getInitialBotSpawn(index);
      const worm = new Worm(this, {
        id: `bot-${index}`,
        name: bot.name,
        isPlayer: false,
        x: spawn.x,
        y: spawn.y,
        angle: spawn.angle,
        tint: bot.tint,
        accentTint: bot.accentTint,
        labelColor: "#f3ffd8",
        speed: WORM_CONFIG.aiSpeed + index * 4,
        turnRate: WORM_CONFIG.aiTurnRate,
        segmentCount: WORM_CONFIG.initialSegments - 1 + (index % 3),
        ai: true
      });

      this.worms.push(worm);
      this.aiWorms.push(worm);
    });

    this.cameras.main.startFollow(this.playerWorm.head, true, 0.08, 0.08);
  }

  getInitialBotSpawn(index) {
    const spawns = [
      { x: 230, y: 220, angle: 0.35 },
      { x: WORLD_WIDTH - 230, y: 220, angle: 2.65 },
      { x: 250, y: WORLD_HEIGHT - 230, angle: -0.5 },
      { x: WORLD_WIDTH - 250, y: WORLD_HEIGHT - 240, angle: -2.8 },
      { x: WORLD_WIDTH / 2, y: 210, angle: 1.5 }
    ];

    return spawns[index % spawns.length];
  }

  spawnPellet(x, y, options = {}) {
    const padding = PELLET_CONFIG.spawnPadding;
    const isDrop = options.isDrop ?? false;
    const point = x === undefined || y === undefined
      ? this.getSafePelletPoint()
      : { x, y };
    const pellet = this.add.sprite(
      Phaser.Math.Clamp(point.x, padding, WORLD_WIDTH - padding),
      Phaser.Math.Clamp(point.y, padding, WORLD_HEIGHT - padding),
      "gems",
      Phaser.Utils.Array.GetRandom(options.frames ?? PELLET_CONFIG.frames)
    );

    pellet.setScale(options.scale ?? (isDrop ? 1.5 : 1.35));
    pellet.setDepth(isDrop ? 3 : 2);
    pellet.setData("value", options.value ?? PELLET_CONFIG.value);
    pellet.setData("isDrop", isDrop);
    this.pellets.add(pellet);

    this.tweens.add({
      targets: pellet,
      scale: (options.scale ?? (isDrop ? 1.5 : 1.35)) + 0.18,
      duration: Phaser.Math.Between(520, 820),
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });

    return pellet;
  }

  getSafePelletPoint() {
    const padding = PELLET_CONFIG.spawnPadding;

    for (let attempt = 0; attempt < 24; attempt += 1) {
      const point = {
        x: Phaser.Math.Between(padding, WORLD_WIDTH - padding),
        y: Phaser.Math.Between(padding, WORLD_HEIGHT - padding)
      };

      if (!this.isInsideObstacle(point.x, point.y, 30)) {
        return point;
      }
    }

    return {
      x: Phaser.Math.Between(padding, WORLD_WIDTH - padding),
      y: Phaser.Math.Between(padding, WORLD_HEIGHT - padding)
    };
  }

  createHud() {
    this.hud = {
      score: this.add.text(24, 18, "", {
        fontFamily: '"Courier New", monospace',
        fontSize: "22px",
        color: "#ecffd5",
        stroke: "#10200f",
        strokeThickness: 4
      }).setScrollFactor(0).setDepth(100),
      size: this.add.text(24, 48, "", {
        fontFamily: '"Courier New", monospace',
        fontSize: "16px",
        color: "#c5f7b8",
        stroke: "#10200f",
        strokeThickness: 4
      }).setScrollFactor(0).setDepth(100),
      progressBack: this.add.rectangle(24, 86, 170, 12, 0x152518, 0.92)
        .setOrigin(0)
        .setScrollFactor(0)
        .setDepth(100),
      progressFill: this.add.rectangle(24, 86, 1, 12, 0x7dff8a, 1)
        .setOrigin(0)
        .setScrollFactor(0)
        .setDepth(101),
      leaderboard: this.add.text(GAME_WIDTH - 24, 18, "", {
        fontFamily: '"Courier New", monospace',
        fontSize: "15px",
        color: "#f3ffd8",
        align: "right",
        stroke: "#10200f",
        strokeThickness: 4
      }).setOrigin(1, 0).setScrollFactor(0).setDepth(100),
      status: this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 32, "", {
        fontFamily: '"Courier New", monospace',
        fontSize: "16px",
        color: "#f3ffd8",
        stroke: "#10200f",
        strokeThickness: 4
      }).setOrigin(0.5).setScrollFactor(0).setDepth(100),
      timer: this.add.text(GAME_WIDTH / 2, 18, "", {
        fontFamily: '"Courier New", monospace',
        fontSize: "22px",
        color: "#f3ffd8",
        stroke: "#10200f",
        strokeThickness: 4
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100),
      objective: this.add.text(GAME_WIDTH / 2, 48, "", {
        fontFamily: '"Courier New", monospace',
        fontSize: "13px",
        color: "#c5f7b8",
        stroke: "#10200f",
        strokeThickness: 3
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100)
    };
  }

  createOverlay() {
    this.overlay = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    this.overlay.setScrollFactor(0);
    this.overlay.setDepth(200);

    const panel = this.add.rectangle(0, 0, 420, 260, 0x142216, 0.92);
    panel.setStrokeStyle(2, 0x8bdc73, 0.85);

    this.overlayTitle = this.add.text(0, -50, "SNAKE WORLD", {
      fontFamily: '"Courier New", monospace',
      fontSize: "34px",
      color: "#f3ffd8",
      stroke: "#0b130d",
      strokeThickness: 5
    }).setOrigin(0.5);

    this.overlayAction = this.add.text(0, 34, "START", {
      fontFamily: '"Courier New", monospace',
      fontSize: "24px",
      color: "#98ff83",
      stroke: "#0b130d",
      strokeThickness: 4
    }).setOrigin(0.5);

    this.overlayDetails = this.add.text(0, 80, `${this.formatTime(this.roundDuration)} ROUND`, {
      fontFamily: '"Courier New", monospace',
      fontSize: "15px",
      color: "#c5f7b8",
      align: "center",
      stroke: "#0b130d",
      strokeThickness: 3
    }).setOrigin(0.5);

    this.overlay.add([panel, this.overlayTitle, this.overlayAction, this.overlayDetails]);
  }

  update(time, delta) {
    if (Phaser.Input.Keyboard.JustDown(this.keys.start) && this.state === "ready") {
      this.startRound();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.start) && this.state === "finished") {
      this.scene.restart();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.pause) && (this.state === "playing" || this.state === "countdown" || this.state === "paused")) {
      this.togglePause();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.restart)) {
      this.scene.restart();
      return;
    }

    if (this.state === "countdown") {
      this.updateCountdown(time);
      this.refreshHud();
      return;
    }

    if (this.state !== "playing") {
      this.refreshHud();
      return;
    }

    if (time >= this.roundEndsAt) {
      this.finishRound();
      this.refreshHud();
      return;
    }

    if (this.playerWorm.alive) {
      this.playerWorm.update(delta, this.getSteeringAngle(), time);
      this.resolveObstacleCollision(this.playerWorm);
    }

    this.updateCameraZoom();

    this.aiWorms.forEach((worm) => {
      if (worm.alive) {
        worm.update(delta, this.getAiTargetAngle(worm, time), time);
        this.resolveObstacleCollision(worm);
      }
    });

    this.worms.forEach((worm) => this.checkPelletCollection(worm));
    this.checkWormCombat(time);
    this.updateRespawns(time);
    this.refreshHud();
  }

  startRound(skipCountdown = false) {
    const time = this.time.now;
    this.state = skipCountdown ? "playing" : "countdown";
    this.countdownEndsAt = skipCountdown ? time : time + ROUND_CONFIG.countdown;
    this.roundStartedAt = this.countdownEndsAt;
    this.roundEndsAt = this.roundStartedAt + this.roundDuration;
    this.worms.forEach((worm) => {
      worm.invulnerableUntil = this.roundStartedAt + WORM_CONFIG.spawnInvulnerability;
    });
    this.overlay.setVisible(!skipCountdown);

    if (!skipCountdown) {
      this.updateCountdown(time);
    }
  }

  togglePause() {
    if (this.state === "paused") {
      const pauseDuration = this.time.now - this.pauseStartedAt;
      this.countdownEndsAt += pauseDuration;
      this.roundStartedAt += pauseDuration;
      this.roundEndsAt += pauseDuration;
      this.state = this.pausedState;
      this.overlay.setVisible(this.state === "countdown");
      return;
    }

    this.pauseStartedAt = this.time.now;
    this.pausedState = this.state;
    this.state = "paused";
    this.overlayTitle.setText("PAUSED");
    this.overlayTitle.setY(-50);
    this.overlayAction.setText("RESUME");
    this.overlayAction.setY(34);
    this.overlayDetails.setText("P OR CLICK");
    this.overlayDetails.setY(80);
    this.overlay.setVisible(true);
  }

  updateCountdown(time) {
    const remaining = Math.max(0, this.countdownEndsAt - time);
    const number = Math.ceil(remaining / 1000);

    this.overlayTitle.setText(number > 0 ? `${number}` : "GO");
    this.overlayTitle.setY(-50);
    this.overlayAction.setText("GET READY");
    this.overlayAction.setY(34);
    this.overlayDetails.setText("CUT TAILS  EAT PELLETS  GET HUGE");
    this.overlayDetails.setY(80);

    if (remaining <= 0) {
      this.state = "playing";
      this.overlay.setVisible(false);
    }
  }

  finishRound() {
    this.state = "finished";
    const leaders = this.getLeaders();
    const winner = leaders[0];
    this.overlayTitle.setText(winner === this.playerWorm ? "YOU WIN" : `${winner.name.toUpperCase()} WINS`);
    this.overlayTitle.setY(-78);
    this.overlayAction.setText("RESTART");
    this.overlayAction.setY(100);
    this.overlayDetails.setText(this.formatStandings(leaders));
    this.overlayDetails.setY(4);
    this.overlay.setVisible(true);
    this.cameras.main.flash(260, 243, 255, 216, false);
  }

  getSteeringAngle() {
    const xAxis = Number(this.cursors.right.isDown || this.keys.right.isDown) - Number(this.cursors.left.isDown || this.keys.left.isDown);
    const yAxis = Number(this.cursors.down.isDown || this.keys.down.isDown) - Number(this.cursors.up.isDown || this.keys.up.isDown);

    if (xAxis !== 0 || yAxis !== 0) {
      this.lastInputAngle = Math.atan2(yAxis, xAxis);
      return this.lastInputAngle;
    }

    const pointer = this.input.activePointer;
    if (pointer.isDown) {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.lastInputAngle = Phaser.Math.Angle.Between(this.playerWorm.x, this.playerWorm.y, worldPoint.x, worldPoint.y);
      return this.lastInputAngle;
    }

    return this.playerWorm.angle;
  }

  getAiTargetAngle(worm, time) {
    if (time < worm.ai.nextThinkAt) {
      return worm.ai.targetAngle;
    }

    worm.ai.nextThinkAt = time + Phaser.Math.Between(AI_CONFIG.thinkDelay[0], AI_CONFIG.thinkDelay[1]);

    const edgeAngle = this.getEdgeAvoidanceAngle(worm);
    if (edgeAngle !== null) {
      worm.ai.state = "EDGE";
      worm.ai.targetAngle = edgeAngle;
      return worm.ai.targetAngle;
    }

    const obstacleAngle = this.getObstacleAvoidanceAngle(worm);
    if (obstacleAngle !== null) {
      worm.ai.state = "AVOID";
      worm.ai.targetAngle = obstacleAngle;
      return worm.ai.targetAngle;
    }

    const threat = this.findThreateningHead(worm);
    if (threat) {
      worm.ai.state = "FLEE";
      worm.ai.targetAngle = Phaser.Math.Angle.Between(threat.x, threat.y, worm.x, worm.y);
      return worm.ai.targetAngle;
    }

    const biteTarget = this.findBiteTarget(worm);
    if (biteTarget) {
      worm.ai.state = "BITE";
      worm.ai.targetAngle = Phaser.Math.Angle.Between(worm.x, worm.y, biteTarget.x, biteTarget.y);
      return worm.ai.targetAngle;
    }

    const pellet = this.findNearestPellet(worm, AI_CONFIG.foodVision);
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

  getEdgeAvoidanceAngle(worm) {
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

  getObstacleAvoidanceAngle(worm) {
    let nearest = null;
    let nearestDistance = Infinity;

    this.obstacles.forEach((obstacle) => {
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

  resolveObstacleCollision(worm) {
    this.obstacles.forEach((obstacle) => {
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
      worm.render(this.time.now);

      if ((worm.bumpFxAt ?? 0) < this.time.now) {
        worm.bumpFxAt = this.time.now + 280;
        this.playBumpFx(worm.x, worm.y);
      }
    });
  }

  findThreateningHead(worm) {
    let nearest = null;
    let nearestDistance = Infinity;

    this.worms.forEach((other) => {
      if (other === worm || !other.alive || other.isInvulnerable) {
        return;
      }

      const distance = Phaser.Math.Distance.Between(worm.x, worm.y, other.x, other.y);
      const isThreat = other.segmentCount >= worm.segmentCount + 2 || other.isPlayer;

      if (isThreat && distance < AI_CONFIG.dangerDistance && distance < nearestDistance) {
        nearest = other;
        nearestDistance = distance;
      }
    });

    return nearest;
  }

  findBiteTarget(worm) {
    let best = null;
    let bestDistance = Infinity;

    this.worms.forEach((victim) => {
      if (victim === worm || !victim.alive || victim.isInvulnerable) {
        return;
      }

      const startIndex = Math.max(2, Math.floor(victim.segmentSprites.length * 0.45));
      for (let index = startIndex; index < victim.segmentSprites.length; index += 2) {
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

  findNearestPellet(worm, maxDistance) {
    let nearest = null;
    let nearestDistance = maxDistance;

    this.pellets.children.each((pellet) => {
      const distance = Phaser.Math.Distance.Between(worm.x, worm.y, pellet.x, pellet.y);
      if (distance < nearestDistance) {
        nearest = pellet;
        nearestDistance = distance;
      }
    });

    return nearest;
  }

  checkPelletCollection(worm) {
    if (!worm.alive) {
      return;
    }

    const collected = [];

    this.pellets.children.each((pellet) => {
      const distance = Phaser.Math.Distance.Between(worm.x, worm.y, pellet.x, pellet.y);
      if (distance <= PELLET_CONFIG.pickupRadius) {
        collected.push(pellet);
      }
    });

    collected.forEach((pellet) => this.collectPellet(worm, pellet));
  }

  collectPellet(worm, pellet) {
    if (!worm.alive || !pellet.active) {
      return;
    }

    const value = pellet.getData("value");
    const isDrop = pellet.getData("isDrop");
    const x = pellet.x;
    const y = pellet.y;

    this.tweens.killTweensOf(pellet);
    pellet.destroy();
    worm.addGrowth(value);
    this.playPickupFlash(x, y);

    if (!isDrop) {
      this.spawnPellet();
    }
  }

  checkWormCombat(time) {
    const aliveWorms = this.worms.filter((worm) => worm.alive && !worm.isInvulnerable);

    for (let attackerIndex = 0; attackerIndex < aliveWorms.length; attackerIndex += 1) {
      for (let victimIndex = 0; victimIndex < aliveWorms.length; victimIndex += 1) {
        const attacker = aliveWorms[attackerIndex];
        const victim = aliveWorms[victimIndex];

        if (!attacker.alive || !victim.alive || attacker === victim || victim.isInvulnerable || this.isCombatOnCooldown(attacker, victim, time)) {
          continue;
        }

        const hit = this.findBodyHit(attacker, victim);
        if (hit) {
          this.cutVictimTail(attacker, victim, hit.segmentIndex, hit.x, hit.y, time);
        }
      }
    }

    this.checkHeadCrashes(aliveWorms, time);
  }

  findBodyHit(attacker, victim) {
    for (let index = 1; index < victim.segmentSprites.length; index += 1) {
      const segment = victim.segmentSprites[index];
      const distance = Phaser.Math.Distance.Between(attacker.x, attacker.y, segment.x, segment.y);

      if (distance <= WORM_CONFIG.bodyHitRadius) {
        return { segmentIndex: index, x: segment.x, y: segment.y };
      }
    }

    return null;
  }

  cutVictimTail(attacker, victim, segmentIndex, x, y, time) {
    const cutStartIndex = Math.min(segmentIndex + 1, victim.segmentCount - 1);
    const removedPositions = victim.cutTail(cutStartIndex);

    if (removedPositions.length === 0) {
      return;
    }

    this.setCombatCooldown(attacker, victim, time);
    attacker.addGrowth(Math.max(1, removedPositions.length * WORM_CONFIG.cutGrowthPerSegment));
    this.dropTailFood(removedPositions);
    this.playCutFx(x, y, attacker.angle);

    if (victim.segmentCount < WORM_CONFIG.minSegments) {
      const remainingPositions = victim.eliminate(time);
      this.dropTailFood(remainingPositions);
      this.playDeathFx(victim.x, victim.y);
      attacker.addGrowth(WORM_CONFIG.growthPerSegment);
    }
  }

  checkHeadCrashes(aliveWorms, time) {
    for (let leftIndex = 0; leftIndex < aliveWorms.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < aliveWorms.length; rightIndex += 1) {
        const left = aliveWorms[leftIndex];
        const right = aliveWorms[rightIndex];

        if (!left.alive || !right.alive || this.isCombatOnCooldown(left, right, time)) {
          continue;
        }

        const distance = Phaser.Math.Distance.Between(left.x, left.y, right.x, right.y);
        if (distance > WORM_CONFIG.headHitRadius) {
          continue;
        }

        this.setCombatCooldown(left, right, time);

        if (left.segmentCount === right.segmentCount) {
          left.angle = Phaser.Math.Angle.Between(right.x, right.y, left.x, left.y);
          right.angle = Phaser.Math.Angle.Between(left.x, left.y, right.x, right.y);
          this.playCutFx((left.x + right.x) / 2, (left.y + right.y) / 2, left.angle);
          continue;
        }

        const winner = left.segmentCount > right.segmentCount ? left : right;
        const loser = winner === left ? right : left;
        const dropped = loser.eliminate(time);

        this.dropTailFood(dropped);
        this.playDeathFx(loser.x, loser.y);
        winner.addGrowth(WORM_CONFIG.growthPerSegment);
      }
    }
  }

  isCombatOnCooldown(attacker, victim, time) {
    const key = this.getCombatKey(attacker, victim);
    return (this.combatCooldowns.get(key) ?? 0) > time;
  }

  setCombatCooldown(attacker, victim, time) {
    const expiresAt = time + WORM_CONFIG.combatCooldown;
    this.combatCooldowns.set(this.getCombatKey(attacker, victim), expiresAt);
    this.combatCooldowns.set(this.getCombatKey(victim, attacker), expiresAt);
  }

  getCombatKey(attacker, victim) {
    return `${attacker.id}:${victim.id}`;
  }

  dropTailFood(positions) {
    positions.forEach((point, index) => {
      if (index % 2 === 1) {
        return;
      }

      this.spawnPellet(
        Phaser.Math.Clamp(point.x + Phaser.Math.Between(-10, 10), PELLET_CONFIG.spawnPadding, WORLD_WIDTH - PELLET_CONFIG.spawnPadding),
        Phaser.Math.Clamp(point.y + Phaser.Math.Between(-10, 10), PELLET_CONFIG.spawnPadding, WORLD_HEIGHT - PELLET_CONFIG.spawnPadding),
        {
          isDrop: true,
          value: PELLET_CONFIG.dropValue,
          frames: PELLET_CONFIG.dropFrames,
          scale: 1.55
        }
      );
    });
  }

  updateRespawns(time) {
    this.worms.forEach((worm) => {
      if (worm.alive || time < worm.respawnAt) {
        return;
      }

      const spawn = this.findSafeSpawn();
      worm.respawn(spawn, time);
      this.playPickupFlash(spawn.x, spawn.y);
    });
  }

  updateCameraZoom() {
    const targetZoom = Phaser.Math.Clamp(1 - (this.playerWorm.segmentCount - WORM_CONFIG.initialSegments) * 0.012, 0.82, 1);
    const camera = this.cameras.main;
    camera.setZoom(Phaser.Math.Linear(camera.zoom, targetZoom, 0.035));
  }

  findSafeSpawn() {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const spawn = {
        x: Phaser.Math.Between(130, WORLD_WIDTH - 130),
        y: Phaser.Math.Between(130, WORLD_HEIGHT - 130),
        angle: Phaser.Math.FloatBetween(-Math.PI, Math.PI)
      };

      const safe = this.worms.every((worm) => {
        if (!worm.alive) {
          return true;
        }

        return Phaser.Math.Distance.Between(spawn.x, spawn.y, worm.x, worm.y) > 230;
      }) && !this.isInsideObstacle(spawn.x, spawn.y, 90);

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

  isInsideObstacle(x, y, extraRadius = 0) {
    return this.obstacles.some((obstacle) => {
      const distance = Phaser.Math.Distance.Between(x, y, obstacle.x, obstacle.y);
      return distance < obstacle.radius + extraRadius;
    });
  }

  playPickupFlash(x, y) {
    const flash = this.add.sprite(x, y, "hit", 0);
    flash.setDepth(70);
    flash.setScale(1.15);
    flash.play("pickup-flash");
    flash.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => flash.destroy());
  }

  playBumpFx(x, y) {
    const flash = this.add.sprite(x, y, "hit", 1);
    flash.setDepth(68);
    flash.setScale(0.85);
    flash.setAlpha(0.8);
    flash.play("pickup-flash");
    flash.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => flash.destroy());
  }

  playCutFx(x, y, angle) {
    const slash = this.add.sprite(x, y, "slash", 0);
    slash.setDepth(75);
    slash.setRotation(angle);
    slash.setScale(1.15);
    slash.play("tail-slash");
    slash.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => slash.destroy());
  }

  playDeathFx(x, y) {
    const pop = this.add.sprite(x, y, "death", 0);
    pop.setDepth(78);
    pop.setScale(1.4);
    pop.play("worm-pop");
    pop.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => pop.destroy());
    this.cameras.main.shake(110, 0.003);
  }

  playGrowthPulse(worm) {
    if (worm.isPlayer) {
      this.cameras.main.shake(70, 0.002);
    }

    worm.segmentSprites.forEach((sprite, index) => {
      if (index > 2) {
        return;
      }

      this.tweens.add({
        targets: sprite,
        scale: 1.2,
        duration: 90,
        yoyo: true,
        ease: "Sine.easeOut"
      });
    });
  }

  getLeaders() {
    return [...this.worms].sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return right.segmentCount - left.segmentCount;
    });
  }

  formatStandings(leaders = this.getLeaders()) {
    return leaders
      .slice(0, 6)
      .map((leader, index) => `${index + 1}. ${leader.name.padEnd(6, " ")} ${String(leader.score).padStart(3, " ")}`)
      .join("\n");
  }

  getRoundTimeRemaining() {
    if (this.state === "ready") {
      return this.roundDuration;
    }

    if (this.state === "countdown") {
      return this.roundDuration;
    }

    if (this.state === "finished") {
      return 0;
    }

    if (this.state === "paused") {
      return Math.max(0, this.roundEndsAt - this.pauseStartedAt);
    }

    return Math.max(0, this.roundEndsAt - this.time.now);
  }

  formatTime(milliseconds) {
    const totalSeconds = Math.ceil(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  refreshHud() {
    const worm = this.playerWorm;
    const progress = worm.growthPoints / WORM_CONFIG.growthPerSegment;
    const leaders = this.getLeaders();
    const playerRank = leaders.findIndex((leader) => leader === worm) + 1;
    const timeRemaining = this.getRoundTimeRemaining();
    let statusText = !worm.alive
      ? "RESPAWNING..."
      : `RANK ${playerRank}/${this.worms.length}`;

    if (this.state === "ready") {
      statusText = "ENTER OR CLICK";
    } else if (this.state === "countdown") {
      statusText = "GET READY";
    } else if (this.state === "finished") {
      statusText = "ROUND OVER";
    } else if (this.state === "paused") {
      statusText = "PAUSED";
    }

    this.hud.score.setText(`SCORE ${worm.score}`);
    this.hud.size.setText(`SIZE ${worm.segmentCount}  GROWTH ${worm.growthPoints}/${WORM_CONFIG.growthPerSegment}`);
    this.hud.progressFill
      .setVisible(progress > 0)
      .setDisplaySize(Math.max(1, 170 * progress), 12);
    this.hud.leaderboard.setText([
      "LEADERS",
      ...leaders.map((leader, index) => {
        const score = leader.alive ? leader.score : "KO";
        return `${index + 1}. ${leader.name.padEnd(6, " ")} ${score}`;
      })
    ].join("\n"));
    this.hud.status.setText(statusText);
    this.hud.timer
      .setColor(timeRemaining <= ROUND_CONFIG.warningTime && this.state === "playing" ? "#fff27d" : "#f3ffd8")
      .setText(this.formatTime(timeRemaining));
    this.hud.objective.setText(this.state === "finished" ? "FINAL STANDINGS" : "BIGGEST WORM WINS");
  }
}

function rotateToward(current, target, maxDelta) {
  const diff = Phaser.Math.Angle.Wrap(target - current);
  return Phaser.Math.Angle.Wrap(current + Phaser.Math.Clamp(diff, -maxDelta, maxDelta));
}

const config = {
  type: Phaser.AUTO,
  parent: "game",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#17351f",
  pixelArt: true,
  roundPixels: true,
  scene: SnakeWorldScene,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

window.addEventListener("load", () => {
  new Phaser.Game(config);
});
