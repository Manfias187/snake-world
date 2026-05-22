export function playPickupFlash(scene, x, y) {
  const flash = scene.add.sprite(x, y, "hit", 0);
  flash.setDepth(70);
  flash.setScale(1.15);
  flash.play("pickup-flash");
  flash.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => flash.destroy());
}

export function playBumpFx(scene, x, y) {
  const flash = scene.add.sprite(x, y, "hit", 1);
  flash.setDepth(68);
  flash.setScale(0.85);
  flash.setAlpha(0.8);
  flash.play("pickup-flash");
  flash.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => flash.destroy());
}

export function playCutFx(scene, x, y, angle) {
  const slash = scene.add.sprite(x, y, "slash", 0);
  slash.setDepth(75);
  slash.setRotation(angle);
  slash.setScale(1.15);
  slash.play("tail-slash");
  slash.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => slash.destroy());
}

export function playDeathFx(scene, x, y) {
  const pop = scene.add.sprite(x, y, "death", 0);
  pop.setDepth(78);
  pop.setScale(1.4);
  pop.play("worm-pop");
  pop.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => pop.destroy());
  scene.cameras.main.shake(110, 0.003);
}

export function playGrowthPulse(scene, worm) {
  if (worm.isPlayer) {
    scene.cameras.main.shake(70, 0.002);
  }

  worm.segmentSprites.forEach((sprite, index) => {
    if (index > 2) {
      return;
    }

    scene.tweens.add({
      targets: sprite,
      scale: 1.2,
      duration: 90,
      yoyo: true,
      ease: "Sine.easeOut"
    });
  });
}
