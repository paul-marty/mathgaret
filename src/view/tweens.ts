import type * as Phaser from 'phaser';
import { services } from '../services';

type TweenConfig = Phaser.Types.Tweens.TweenBuilderConfig;

const num = (v: unknown, fallback: number): number => (typeof v === 'number' ? v : fallback);

/** Durée prévue d'une animation (temps de jeu), ou `null` si elle boucle sans fin. */
export function plannedMs(c: TweenConfig): number | null {
  const repeat = num(c.repeat, 0);
  if (repeat < 0) return null;
  const once = num(c.duration, 1000) * (c.yoyo ? 2 : 1) + num(c.hold, 0);
  return num(c.delay, 0) + once * (repeat + 1) + num(c.repeatDelay, 0) * repeat;
}

/**
 * Lance une animation et attend sa fin. La promesse se résout toujours :
 * à la fin normale, si l'animation est arrêtée, et au pire après sa durée prévue (avec une marge),
 * même si Phaser ne prévient jamais (cible détruite, animation supprimée par une autre).
 */
export function tweenAsync(scene: Phaser.Scene, config: TweenConfig): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (rescue?: string) => {
      if (done) return;
      done = true;
      if (rescue) services.diag.secours(rescue);
      resolve();
    };
    const planned = plannedMs(config);
    if (planned === null) {
      // Une animation qui boucle ne se termine jamais : on ne l'attend pas.
      scene.tweens.add(config);
      finish('animation sans fin attendue par le scénario : on ne l’attend pas');
      return;
    }
    const { onComplete, onStop } = config;
    scene.tweens.add({
      ...config,
      onComplete: (...args: Parameters<NonNullable<TweenConfig['onComplete']>>) => {
        onComplete?.(...args);
        finish();
      },
      onStop: (...args: Parameters<NonNullable<TweenConfig['onStop']>>) => {
        onStop?.(...args);
        finish();
      },
    });
    // Marge large : une image saccadée retarde l'animation sans la bloquer ; ce filet ne vise que les vrais blocages.
    void services.clock.wait(planned * 2 + 3000).then(() => finish(`animation de ${Math.round(planned)} ms jamais terminée : on continue`));
  });
}
