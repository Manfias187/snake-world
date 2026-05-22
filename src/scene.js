import {
  ASSETS,
  BOT_ROSTER,
  GAME_WIDTH,
  GAME_HEIGHT,
  POINTER_DEAD_ZONE,
  ROUND_CONFIG,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORM_CONFIG
} from "./config.js";
import { Worm } from "./worm.js";
import {
  createArena,
  createObstacles,
  findSafeSpawn,
  resolveObstacleCollision
} from "./arena.js";
import { createPellets, updatePellets } from "./pellets.js";
import { getAiTargetAngle } from "./ai.js";
import { checkSelfCollisions, checkWormCombat } from "./combat.js";
import { playPickupFlash } from "./fx.js";
import {
  createHud,
  createOverlay,
  formatStandings,
  getLeaders,
  refreshHud
} from "./hud.js";

export class SnakeWorldScene extends Phaser.Scene {
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

    this.buildTextures();
    this.buildAnimations();
    createArena(this);
    this.obstacles = createObstacles(this);
    this.bindInput();
    this.buildWorms();
    createPellets(this);
    createHud(this);
    createOverlay(this);
    refreshHud(this);

    if (this.urlParams.has("autostart")) {
      this.startRound(this.urlParams.has("skipCountdown"));
    }

    if (this.urlParams.has("results")) {
      this.startRound(true);
      this.finishRound();
    }
  }

  buildTextures() {
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
    graphics.destroy();
  }

  buildAnimations() {
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

  bindInput() {
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

  buildWorms() {
    this.worms = [];
    this.aiWorms = [];

    this.playerWorm = new Worm(this, {
      id: "player",
      name: "You",
      isPlayer: true,
      x: WORLD_WIDTH / 2,
      y: WORLD_HEIGHT / 2,
      angle: -0.2,
      tint: 0x3bf3a0,
      accentTint: 0x8df7ff,
      labelColor: "#ecffd5",
      speed: WORM_CONFIG.speed,
      turnRate: WORM_CONFIG.turnRate,
      segmentCount: WORM_CONFIG.initialSegments
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
        speed: WORM_CONFIG.speed,
        turnRate: WORM_CONFIG.aiTurnRate,
        segmentCount: WORM_CONFIG.initialSegments,
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
      refreshHud(this);
      return;
    }

    if (this.state !== "playing") {
      refreshHud(this);
      return;
    }

    if (time >= this.roundEndsAt) {
      this.finishRound();
      refreshHud(this);
      return;
    }

    if (this.playerWorm.alive) {
      this.playerWorm.update(delta, this.getSteeringAngle(), time);
      resolveObstacleCollision(this, this.playerWorm);
    }

    this.updateCameraZoom();

    this.aiWorms.forEach((worm) => {
      if (worm.alive) {
        worm.update(delta, getAiTargetAngle(this, worm, time), time);
        resolveObstacleCollision(this, worm);
      }
    });

    updatePellets(this, delta);
    checkWormCombat(this, time);
    checkSelfCollisions(this, time);
    this.updateRespawns(time);
    refreshHud(this);
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
    const leaders = getLeaders(this);
    const winner = leaders[0];
    this.overlayTitle.setText(winner === this.playerWorm ? "YOU WIN" : `${winner.name.toUpperCase()} WINS`);
    this.overlayTitle.setY(-78);
    this.overlayAction.setText("RESTART");
    this.overlayAction.setY(100);
    this.overlayDetails.setText(formatStandings(leaders));
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
      const dx = pointer.x - GAME_WIDTH / 2;
      const dy = pointer.y - GAME_HEIGHT / 2;
      if (dx * dx + dy * dy > POINTER_DEAD_ZONE * POINTER_DEAD_ZONE) {
        this.lastInputAngle = Math.atan2(dy, dx);
        return this.lastInputAngle;
      }
      return this.lastInputAngle;
    }

    return this.playerWorm.angle;
  }

  updateRespawns(time) {
    this.worms.forEach((worm) => {
      if (worm.alive || time < worm.respawnAt) {
        return;
      }

      const spawn = findSafeSpawn(this);
      worm.respawn(spawn, time);
      playPickupFlash(this, spawn.x, spawn.y);
    });
  }

  updateCameraZoom() {
    const targetZoom = Phaser.Math.Clamp(1 - (this.playerWorm.segmentCount - WORM_CONFIG.initialSegments) * 0.012, 0.82, 1);
    const camera = this.cameras.main;
    camera.setZoom(Phaser.Math.Linear(camera.zoom, targetZoom, 0.035));
  }
}
