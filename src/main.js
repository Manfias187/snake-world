import { GAME_WIDTH, GAME_HEIGHT } from "./config.js";
import { SnakeWorldScene } from "./scene.js";

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
