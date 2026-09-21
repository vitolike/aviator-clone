import { Application, Assets } from '../vendor/pixi.min.mjs';
import { Engine } from './core/engine.js';
import { Game } from './core/game.js';
import { Bots } from './core/bots.js';
import { Sfx } from './audio/sfx.js';
import { Scene } from './view/scene.js';
import { authenticPlaneTexture } from './view/textures.js';
import { initTopbarUI } from './view/topbar-ui.js';
import { NetworkClient } from './network/client.js';

async function boot() {
  const app = new Application();
  const gameEl = document.getElementById('game');
  await app.init({
    background: 0x000000,
    resizeTo: gameEl,
    antialias: true,
    resolution: Math.min(2, window.devicePixelRatio || 1),
    autoDensity: true,
    preference: 'webgl',
  });
  gameEl.appendChild(app.canvas);

  // Preload official Spribe assets
  const avatarList = Array.from({ length: 72 }, (_, i) => `assets/images/avatars/av-${i + 1}.png`);
  await Assets.load([
    'assets/images/spribe_aviator_logo.png',
    'assets/images/plane/plane_frame_0.png',
    'assets/images/plane/plane_frame_1.png',
    'assets/images/plane/plane_frame_2.png',
    'assets/images/plane/plane_frame_3.png',
    'assets/images/ufc.svg',
    'assets/images/official.svg',
    'assets/images/spribe.png',
    'images/logo.png',
    'images/logo.svg',
    ...avatarList,
  ]);
  const planeTexture = Assets.get('assets/images/plane/plane_frame_0.png');

  const engine = new Engine();
  const game = new Game(engine);
  const bots = new Bots();
  const sfx = new Sfx();

  const scene = new Scene(app, engine, game, bots, sfx, planeTexture);
  app.stage.addChild(scene);

  initTopbarUI({ game, sfx, scene, bots });

  // Initialize network client to sync with backend & session token
  const network = new NetworkClient(engine, game, bots);
  network.init().catch(err => console.warn('[Boot] Network client init error:', err));

  const unlock = () => { sfx.init(); };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });

  let raf = null;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => scene.relayout());
  });
  window.addEventListener('orientationchange', () => setTimeout(() => scene.relayout(), 250));

  app.ticker.add((t) => scene.update(Math.min(50, t.deltaMS)));

  const loader = document.getElementById('loading');
  if (loader) {
    loader.classList.add('hide');
    setTimeout(() => loader.remove(), 220);
  }
  window.__aviator = { app, engine, game, bots, scene, network };
}

boot().catch((e) => {
  console.error(e);
  const el = document.getElementById('loading');
  if (el) el.innerHTML = `<span style="color:#ff5c74">Load Failed: ${e.message}</span>`;
});
