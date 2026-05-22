export function rotateToward(current, target, maxDelta) {
  const diff = Phaser.Math.Angle.Wrap(target - current);
  return Phaser.Math.Angle.Wrap(current + Phaser.Math.Clamp(diff, -maxDelta, maxDelta));
}
