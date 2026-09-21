// Canvas-based gradient and glow texture generation
import { Texture } from '../../vendor/pixi.min.mjs';

const cache = new Map();

function make(key, w, h, draw) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = Texture.from(c);
  cache.set(key, t);
  return t;
}

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

export function vGradient(key, top, bottom, h = 64) {
  return make(`v_${key}`, 8, h, (ctx, w, hh) => {
    const g = ctx.createLinearGradient(0, 0, 0, hh);
    g.addColorStop(0, hex(top));
    g.addColorStop(1, hex(bottom));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, hh);
  });
}

export function radialGlow(key, color, alpha = 1) {
  return make(`glow_${key}`, 256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    const c = hex(color);
    g.addColorStop(0, `${c}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`);
    g.addColorStop(0.45, `${c}55`);
    g.addColorStop(1, `${c}00`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

// Red gradient fill below the flight trajectory curve
export function curveFill() {
  return make('curvefill', 8, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,44,85,0.55)');
    g.addColorStop(0.55, 'rgba(226,5,57,0.22)');
    g.addColorStop(1, 'rgba(226,5,57,0.02)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

// Background rotating sunburst
export function sunburst() {
  return make('sunburst', 512, 512, (ctx, w, h) => {
    const cx = w / 2, cy = h / 2, R = w * 0.72;
    ctx.clearRect(0, 0, w, h);
    const blades = 18;
    for (let i = 0; i < blades; i++) {
      const a0 = (i / blades) * Math.PI * 2;
      const a1 = a0 + (Math.PI * 2) / blades / 2;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      g.addColorStop(0, 'rgba(255,255,255,0.10)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.045)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, a0, a1);
      ctx.closePath();
      ctx.fill();
    }
  });
}

// Background radial spotlight behind the central multiplier
export function centralSpotlight() {
  return make('central_spotlight', 384, 384, (ctx, w, h) => {
    const cx = w / 2, cy = h / 2, r = w / 2;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(108, 43, 174, 0.48)');
    g.addColorStop(0.25, 'rgba(73, 29, 125, 0.30)');
    g.addColorStop(0.55, 'rgba(40, 18, 73, 0.13)');
    g.addColorStop(0.85, 'rgba(20, 10, 35, 0.04)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

// Authentic Spribe Aviator 2D Red Propeller Plane
export function authenticPlaneTexture() {
  return make('authentic_plane_v2', 480, 240, (ctx, w, h) => {
    ctx.save();
    ctx.translate(10, 10);

    // 1. Rear Tail & Horizontal Stabilizers
    // Horizontal fin
    ctx.fillStyle = '#b3132e';
    ctx.beginPath();
    ctx.moveTo(80, 115);
    ctx.lineTo(45, 105);
    ctx.lineTo(40, 118);
    ctx.lineTo(82, 128);
    ctx.closePath();
    ctx.fill();

    // Vertical Stabilizer (Tail)
    ctx.fillStyle = '#cc1433';
    ctx.beginPath();
    ctx.moveTo(95, 115);
    ctx.lineTo(52, 38);
    ctx.lineTo(88, 38);
    ctx.lineTo(135, 100);
    ctx.closePath();
    ctx.fill();

    // Tail fin highlight
    ctx.fillStyle = '#e21c3d';
    ctx.beginPath();
    ctx.moveTo(88, 38);
    ctx.lineTo(52, 38);
    ctx.lineTo(75, 75);
    ctx.lineTo(105, 75);
    ctx.closePath();
    ctx.fill();

    // White "X" emblem on tail (Authentic Aviator feature!)
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(68, 48); ctx.lineTo(86, 70);
    ctx.moveTo(86, 48); ctx.lineTo(68, 70);
    ctx.stroke();
    ctx.restore();

    // 2. Main Fuselage
    const fuseGrad = ctx.createLinearGradient(80, 40, 80, 150);
    fuseGrad.addColorStop(0, '#ff4767');
    fuseGrad.addColorStop(0.35, '#e21c3d');
    fuseGrad.addColorStop(0.75, '#b8122f');
    fuseGrad.addColorStop(1, '#7e091e');

    ctx.fillStyle = fuseGrad;
    ctx.beginPath();
    ctx.moveTo(75, 118);
    ctx.quadraticCurveTo(140, 68, 280, 72);
    ctx.quadraticCurveTo(365, 75, 385, 105);
    ctx.quadraticCurveTo(365, 138, 280, 142);
    ctx.quadraticCurveTo(140, 145, 75, 118);
    ctx.closePath();
    ctx.fill();

    // Fuselage sleek white racer speed stripe
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.moveTo(110, 114);
    ctx.lineTo(365, 96);
    ctx.lineTo(368, 102);
    ctx.lineTo(110, 120);
    ctx.closePath();
    ctx.fill();

    // 3. Cockpit Canopy
    ctx.fillStyle = '#11161d';
    ctx.beginPath();
    ctx.moveTo(210, 75);
    ctx.quadraticCurveTo(250, 48, 295, 62);
    ctx.quadraticCurveTo(315, 73, 318, 80);
    ctx.lineTo(210, 80);
    ctx.closePath();
    ctx.fill();

    // Cockpit Glass reflection (cyan/white glossy shine)
    const glassGrad = ctx.createLinearGradient(230, 50, 270, 75);
    glassGrad.addColorStop(0, '#ffffff');
    glassGrad.addColorStop(0.4, '#64d2ff');
    glassGrad.addColorStop(0.8, '#1e75a8');
    glassGrad.addColorStop(1, '#112233');
    ctx.fillStyle = glassGrad;
    ctx.beginPath();
    ctx.moveTo(222, 75);
    ctx.quadraticCurveTo(252, 53, 290, 66);
    ctx.quadraticCurveTo(305, 74, 308, 77);
    ctx.lineTo(222, 77);
    ctx.closePath();
    ctx.fill();

    // 4. Main Wing (foreground)
    const wingGrad = ctx.createLinearGradient(160, 100, 230, 175);
    wingGrad.addColorStop(0, '#e21c3d');
    wingGrad.addColorStop(0.6, '#b8122f');
    wingGrad.addColorStop(1, '#80081d');

    ctx.fillStyle = wingGrad;
    ctx.beginPath();
    ctx.moveTo(195, 112);
    ctx.lineTo(165, 168);
    ctx.quadraticCurveTo(195, 175, 240, 168);
    ctx.lineTo(265, 120);
    ctx.closePath();
    ctx.fill();

    // Wing white edge stripe
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(170, 162);
    ctx.lineTo(235, 163);
    ctx.lineTo(232, 168);
    ctx.lineTo(168, 167);
    ctx.closePath();
    ctx.fill();

    // 5. Landing Gear Strut & Wheel Spat
    ctx.fillStyle = '#444850';
    ctx.beginPath();
    ctx.moveTo(275, 135); ctx.lineTo(265, 165); ctx.lineTo(275, 165); ctx.lineTo(285, 135);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = '#cc1433';
    ctx.beginPath();
    ctx.ellipse(272, 166, 18, 8, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111215';
    ctx.beginPath();
    ctx.ellipse(272, 169, 10, 4, -0.15, 0, Math.PI * 2);
    ctx.fill();

    // 6. Nose Cowling & Spinner
    ctx.fillStyle = '#b3132e';
    ctx.beginPath();
    ctx.ellipse(384, 105, 12, 28, 0, 0, Math.PI * 2);
    ctx.fill();

    // Propeller Spinner Cone
    const coneGrad = ctx.createLinearGradient(384, 95, 412, 105);
    coneGrad.addColorStop(0, '#ff4767');
    coneGrad.addColorStop(0.5, '#e21c3d');
    coneGrad.addColorStop(1, '#8a0a20');
    ctx.fillStyle = coneGrad;
    ctx.beginPath();
    ctx.moveTo(384, 92);
    ctx.quadraticCurveTo(412, 102, 415, 105);
    ctx.quadraticCurveTo(412, 108, 384, 118);
    ctx.closePath();
    ctx.fill();

    // 7. Spinning Propeller Blur Effect (Authentic Spribe Aviator spinning disc)
    // Motion blur outer halo
    const blurGrad = ctx.createRadialGradient(408, 105, 10, 408, 105, 62);
    blurGrad.addColorStop(0, 'rgba(255, 255, 255, 0.65)');
    blurGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.35)');
    blurGrad.addColorStop(0.7, 'rgba(226, 28, 61, 0.45)');
    blurGrad.addColorStop(0.95, 'rgba(255, 255, 255, 0.15)');
    blurGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = blurGrad;
    ctx.beginPath();
    ctx.ellipse(408, 105, 14, 62, 0, 0, Math.PI * 2);
    ctx.fill();

    // Spinning blade streak
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(408, 105, 7, 56, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Blade red tips
    ctx.fillStyle = 'rgba(226, 28, 61, 0.9)';
    ctx.beginPath();
    ctx.ellipse(408, 55, 6, 12, 0, 0, Math.PI * 2);
    ctx.ellipse(408, 155, 6, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  });
}

// Fallback is also alias to authenticPlaneTexture
export function planeFallback() {
  return authenticPlaneTexture();
}

// Generates rich, authentic circular avatars matching the reference screenshot
export function playerAvatar(avatarId, color) {
  const key = `avatar_${avatarId}_${color}`;
  return make(key, 40, 40, (ctx, w, h) => {
    const cx = w / 2, cy = h / 2, r = 17;

    // Outer circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    const c = hex(color);
    bgGrad.addColorStop(0, c);
    bgGrad.addColorStop(1, '#0e1014');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Mini avatar graphic inside
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8;

    const id = avatarId % 16;
    if (avatarId === 99) {
      // Golden star for "You"
      ctx.fillStyle = '#ffd60a';
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a1 = (i * Math.PI * 2) / 5 - Math.PI / 2;
        const a2 = a1 + Math.PI / 5;
        const x1 = cx + Math.cos(a1) * 11, y1 = cy + Math.sin(a1) * 11;
        const x2 = cx + Math.cos(a2) * 5, y2 = cy + Math.sin(a2) * 5;
        if (i === 0) ctx.moveTo(x1, y1); else ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.closePath();
      ctx.fill();
    } else if (id === 0) {
      // Aviator goggles
      ctx.beginPath();
      ctx.arc(cx - 5, cy, 4.5, 0, Math.PI * 2);
      ctx.arc(cx + 5, cy, 4.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 1, cy); ctx.lineTo(cx + 1, cy); ctx.stroke();
    } else if (id === 1) {
      // Helmet / Pilot
      ctx.beginPath();
      ctx.arc(cx, cy - 1, 7, Math.PI * 0.9, Math.PI * 2.1);
      ctx.stroke();
      ctx.fillStyle = '#64d2ff';
      ctx.fillRect(cx - 5, cy - 1, 10, 4);
    } else if (id === 2) {
      // Diamond
      ctx.beginPath();
      ctx.moveTo(cx, cy - 7);
      ctx.lineTo(cx + 7, cy);
      ctx.lineTo(cx, cy + 7);
      ctx.lineTo(cx - 7, cy);
      ctx.closePath();
      ctx.fill();
    } else if (id === 3) {
      // Dice
      ctx.roundRect(cx - 6, cy - 6, 12, 12, 2.5);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, 1.5, 0, Math.PI * 2); ctx.fill();
    } else if (id === 4) {
      // Lightning
      ctx.beginPath();
      ctx.moveTo(cx + 1, cy - 8);
      ctx.lineTo(cx - 4, cy);
      ctx.lineTo(cx + 1, cy);
      ctx.lineTo(cx - 1, cy + 8);
      ctx.lineTo(cx + 5, cy - 1);
      ctx.lineTo(cx + 1, cy - 1);
      ctx.closePath();
      ctx.fill();
    } else if (id === 5) {
      // Jet silhouette
      ctx.beginPath();
      ctx.moveTo(cx, cy - 8);
      ctx.lineTo(cx + 2, cy - 2);
      ctx.lineTo(cx + 8, cy + 2);
      ctx.lineTo(cx + 2, cy + 4);
      ctx.lineTo(cx + 3, cy + 8);
      ctx.lineTo(cx, cy + 6);
      ctx.lineTo(cx - 3, cy + 8);
      ctx.lineTo(cx - 2, cy + 4);
      ctx.lineTo(cx - 8, cy + 2);
      ctx.lineTo(cx - 2, cy - 2);
      ctx.closePath();
      ctx.fill();
    } else if (id === 6) {
      // Target
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill();
    } else if (id === 7) {
      // Crown
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy + 5);
      ctx.lineTo(cx + 6, cy + 5);
      ctx.lineTo(cx + 7, cy - 4);
      ctx.lineTo(cx + 3, cy);
      ctx.lineTo(cx, cy - 5);
      ctx.lineTo(cx - 3, cy);
      ctx.lineTo(cx - 7, cy - 4);
      ctx.closePath();
      ctx.fill();
    } else if (id === 8) {
      // Shield
      ctx.beginPath();
      ctx.moveTo(cx, cy - 7);
      ctx.lineTo(cx + 6, cy - 4);
      ctx.lineTo(cx + 6, cy + 1);
      ctx.quadraticCurveTo(cx + 5, cy + 7, cx, cy + 9);
      ctx.quadraticCurveTo(cx - 5, cy + 7, cx - 6, cy + 1);
      ctx.lineTo(cx - 6, cy - 4);
      ctx.closePath();
      ctx.fill();
    } else if (id === 9) {
      // Skull
      ctx.beginPath();
      ctx.arc(cx, cy - 2, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(cx - 3.5, cy + 2, 7, 4);
    } else {
      // Star
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 7.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();

    // Thin rim border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  });
}

// Rounded gradient button background
export function roundedGradient(w, h, r, top, bottom, border = null, borderAlpha = 0.45) {
  const key = `rg_${w}x${h}_${r}_${top}_${bottom}_${border}_${borderAlpha}`;
  return make(key, Math.max(2, Math.round(w)), Math.max(2, Math.round(h)), (ctx, W, H) => {
    const rr = Math.min(r, W / 2, H / 2);
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(rr, 0);
      ctx.arcTo(W, 0, W, H, rr);
      ctx.arcTo(W, H, 0, H, rr);
      ctx.arcTo(0, H, 0, 0, rr);
      ctx.arcTo(0, 0, W, 0, rr);
      ctx.closePath();
    };
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, hex(top));
    g.addColorStop(1, hex(bottom));
    path();
    ctx.fillStyle = g;
    ctx.fill();
    if (border !== null) {
      ctx.save();
      path();
      ctx.clip();
      ctx.strokeStyle = hex(border);
      ctx.globalAlpha = borderAlpha;
      ctx.lineWidth = 3;
      path();
      ctx.stroke();
      ctx.restore();
    }
  });
}

// Radiating fan rays originating from bottom-left corner for next round screen
export function fanRaysTexture(w = 1200, h = 700) {
  const key = `fan_rays_${w}_${h}`;
  return make(key, w, h, (ctx, W, H) => {
    ctx.fillStyle = '#050608';
    ctx.fillRect(0, 0, W, H);
    const ox = 0, oy = H;
    const R = Math.hypot(W, H) * 1.3;
    const sectors = 36;
    for (let i = 0; i < sectors; i++) {
      if (i % 2 === 0) continue;
      const a0 = -Math.PI / 2 + (i / sectors) * (Math.PI / 2);
      const a1 = -Math.PI / 2 + ((i + 1) / sectors) * (Math.PI / 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.042)';
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.arc(ox, oy, R, a0, a1);
      ctx.closePath();
      ctx.fill();
    }
  });
}

// Authentic UFC x Aviator OFFICIAL PARTNERS lockup & Spribe badge
export function nextRoundUfcTexture() {
  return make('ufc_official_partners_lockup_v1', 700, 360, (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    ctx.save();

    const cx = W / 2;
    const topY = 40;

    // === 1. TOP ROW: UFC LOGO + DIVIDER + AVIATOR LOGO ===
    const leftW = 160;
    const ufcX = cx - leftW - 20;

    // --- UFC LOGO (Bold Red Italic) ---
    ctx.save();
    ctx.translate(ufcX, topY);
    ctx.fillStyle = '#d20a11';

    // Italic shear transform
    ctx.transform(1, 0, -0.22, 1, 0, 0);

    // Draw "U"
    ctx.beginPath();
    ctx.moveTo(25, 0);
    ctx.lineTo(44, 0);
    ctx.lineTo(44, 42);
    ctx.arcTo(44, 62, 24, 62, 18);
    ctx.arcTo(4, 62, 4, 42, 18);
    ctx.lineTo(4, 0);
    ctx.lineTo(23, 0);
    ctx.lineTo(23, 40);
    ctx.arcTo(23, 46, 30, 46, 6);
    ctx.arcTo(36, 46, 36, 40, 6);
    ctx.lineTo(36, 0);
    ctx.closePath();
    ctx.fill();

    // Draw "F"
    ctx.beginPath();
    ctx.moveTo(56, 0);
    ctx.lineTo(100, 0);
    ctx.lineTo(97, 16);
    ctx.lineTo(75, 16);
    ctx.lineTo(73, 27);
    ctx.lineTo(93, 27);
    ctx.lineTo(90, 41);
    ctx.lineTo(70, 41);
    ctx.lineTo(67, 62);
    ctx.lineTo(49, 62);
    ctx.closePath();
    ctx.fill();

    // Draw "C"
    ctx.beginPath();
    ctx.moveTo(150, 16);
    ctx.lineTo(135, 16);
    ctx.arcTo(116, 16, 116, 32, 16);
    ctx.lineTo(116, 44);
    ctx.arcTo(116, 62, 134, 62, 18);
    ctx.lineTo(154, 62);
    ctx.lineTo(150, 46);
    ctx.lineTo(136, 46);
    ctx.arcTo(129, 46, 129, 40, 6);
    ctx.lineTo(129, 36);
    ctx.arcTo(129, 30, 136, 30, 6);
    ctx.lineTo(146, 30);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // --- VERTICAL DIVIDER LINE ---
    ctx.strokeStyle = '#4a4d55';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx - 8, topY - 2);
    ctx.lineTo(cx - 8, topY + 68);
    ctx.stroke();

    // === 2. MIDDLE ROW: OFFICIAL PARTNERS ===
    const partnersY = topY + 104;
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 24px Roboto, Inter, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '3px';
    ctx.fillText('OFFICIAL PARTNERS', cx, partnersY);

    // === 3. UNDERLINE BAR (HALF RED / HALF DARK) ===
    const lineY = partnersY + 12;
    const lineHalf = 70;
    // Red half (left)
    ctx.fillStyle = '#e50539';
    ctx.beginPath();
    ctx.roundRect(cx - lineHalf, lineY, lineHalf, 3.5, [2, 0, 0, 2]);
    ctx.fill();
    // Dark half (right)
    ctx.fillStyle = '#32343b';
    ctx.beginPath();
    ctx.roundRect(cx, lineY, lineHalf, 3.5, [0, 2, 2, 0]);
    ctx.fill();

    // === 4. SPRIBE OFFICIAL GAME BADGE ===
    const badgeW = 142;
    const badgeH = 72;
    const badgeX = cx - badgeW / 2;
    const badgeY = lineY + 18;

    // Dark card background
    ctx.fillStyle = '#0f1811';
    ctx.strokeStyle = '#1e3822';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 10);
    ctx.fill();
    ctx.stroke();

    // Spribe spiral/flower icon
    const iconX = badgeX + 26;
    const iconY = badgeY + 18;
    ctx.strokeStyle = '#8bbd8f';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 6; i++) {
      const ang = (i * Math.PI * 2) / 6;
      ctx.beginPath();
      ctx.arc(iconX + Math.cos(ang) * 4, iconY + Math.sin(ang) * 4, 3.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(iconX, iconY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Text "SPRIBE"
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 13px Roboto, Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.letterSpacing = '1px';
    ctx.fillText('SPRIBE', iconX + 14, iconY + 5);

    // Green pill: "Official Game ✔"
    const pillW = 114;
    const pillH = 20;
    const pillX = cx - pillW / 2;
    const pillY = badgeY + 31;
    ctx.fillStyle = '#143818';
    ctx.strokeStyle = '#235928';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#4ade80';
    ctx.font = '700 9.5px Roboto, Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Official Game', pillX + pillW / 2 - 7, pillY + 13.5);

    // Checkmark circle
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(pillX + pillW - 14, pillY + 10, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f1811';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText('✔', pillX + pillW - 14, pillY + 13);

    // "Since 2019"
    ctx.fillStyle = '#6f8d74';
    ctx.font = '600 9.5px Roboto, Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Since 2019', cx, badgeY + 63);

    ctx.restore();
  });
}
