import { GAME_WIDTH, GAME_HEIGHT, ROUND_CONFIG } from "./config.js";

export function createHud(scene) {
  scene.hud = {
    score: scene.add.text(24, 18, "", {
      fontFamily: '"Courier New", monospace',
      fontSize: "22px",
      color: "#ecffd5",
      stroke: "#10200f",
      strokeThickness: 4
    }).setScrollFactor(0).setDepth(100),
    leaderboard: scene.add.text(GAME_WIDTH - 24, 18, "", {
      fontFamily: '"Courier New", monospace',
      fontSize: "15px",
      color: "#f3ffd8",
      align: "right",
      stroke: "#10200f",
      strokeThickness: 4
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100),
    status: scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 32, "", {
      fontFamily: '"Courier New", monospace',
      fontSize: "16px",
      color: "#f3ffd8",
      stroke: "#10200f",
      strokeThickness: 4
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100),
    timer: scene.add.text(GAME_WIDTH / 2, 18, "", {
      fontFamily: '"Courier New", monospace',
      fontSize: "22px",
      color: "#f3ffd8",
      stroke: "#10200f",
      strokeThickness: 4
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100),
    objective: scene.add.text(GAME_WIDTH / 2, 48, "", {
      fontFamily: '"Courier New", monospace',
      fontSize: "13px",
      color: "#c5f7b8",
      stroke: "#10200f",
      strokeThickness: 3
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100)
  };
}

export function createOverlay(scene) {
  scene.overlay = scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2);
  scene.overlay.setScrollFactor(0);
  scene.overlay.setDepth(200);

  const panel = scene.add.rectangle(0, 0, 420, 260, 0x142216, 0.92);
  panel.setStrokeStyle(2, 0x8bdc73, 0.85);

  scene.overlayTitle = scene.add.text(0, -50, "SNAKE WORLD", {
    fontFamily: '"Courier New", monospace',
    fontSize: "34px",
    color: "#f3ffd8",
    stroke: "#0b130d",
    strokeThickness: 5
  }).setOrigin(0.5);

  scene.overlayAction = scene.add.text(0, 34, "START", {
    fontFamily: '"Courier New", monospace',
    fontSize: "24px",
    color: "#98ff83",
    stroke: "#0b130d",
    strokeThickness: 4
  }).setOrigin(0.5);

  scene.overlayDetails = scene.add.text(0, 80, `${formatTime(scene.roundDuration)} ROUND`, {
    fontFamily: '"Courier New", monospace',
    fontSize: "15px",
    color: "#c5f7b8",
    align: "center",
    stroke: "#0b130d",
    strokeThickness: 3
  }).setOrigin(0.5);

  scene.overlay.add([panel, scene.overlayTitle, scene.overlayAction, scene.overlayDetails]);
}

export function refreshHud(scene) {
  const worm = scene.playerWorm;
  const leaders = getLeaders(scene);
  const playerRank = leaders.findIndex((leader) => leader === worm) + 1;
  const timeRemaining = getRoundTimeRemaining(scene);
  let statusText = !worm.alive
    ? "RESPAWNING..."
    : `RANK ${playerRank}/${scene.worms.length}`;

  if (scene.state === "ready") {
    statusText = "ENTER OR CLICK";
  } else if (scene.state === "countdown") {
    statusText = "GET READY";
  } else if (scene.state === "finished") {
    statusText = "ROUND OVER";
  } else if (scene.state === "paused") {
    statusText = "PAUSED";
  }

  scene.hud.score.setText(`SCORE ${worm.score}`);
  scene.hud.leaderboard.setText([
    "LEADERS",
    ...leaders.map((leader, index) => {
      const score = leader.alive ? leader.score : "KO";
      return `${index + 1}. ${leader.name.padEnd(6, " ")} ${score}`;
    })
  ].join("\n"));
  scene.hud.status.setText(statusText);
  scene.hud.timer
    .setColor(timeRemaining <= ROUND_CONFIG.warningTime && scene.state === "playing" ? "#fff27d" : "#f3ffd8")
    .setText(formatTime(timeRemaining));
  scene.hud.objective.setText(scene.state === "finished" ? "FINAL STANDINGS" : "BIGGEST WORM WINS");
}

export function getLeaders(scene) {
  return [...scene.worms].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return right.segmentCount - left.segmentCount;
  });
}

export function formatStandings(leaders) {
  return leaders
    .slice(0, 6)
    .map((leader, index) => `${index + 1}. ${leader.name.padEnd(6, " ")} ${String(leader.score).padStart(3, " ")}`)
    .join("\n");
}

export function getRoundTimeRemaining(scene) {
  if (scene.state === "ready" || scene.state === "countdown") {
    return scene.roundDuration;
  }

  if (scene.state === "finished") {
    return 0;
  }

  if (scene.state === "paused") {
    return Math.max(0, scene.roundEndsAt - scene.pauseStartedAt);
  }

  return Math.max(0, scene.roundEndsAt - scene.time.now);
}

export function formatTime(milliseconds) {
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
