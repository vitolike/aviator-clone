// Global configuration: Color palette, rules, PC / Mobile layouts

export const CURRENCY = 'USD';
export const CURRENCY_SYM = '$';

export const COLORS = {
  bg: 0x000000,
  stageBg: 0x0b0b0f,
  panel: 0x1b1c1d,
  panelDeep: 0x141516,
  panelLine: 0x2c2d30,
  text: 0xffffff,
  textDim: 0x9ea0a3,
  textFaint: 0x7b7d80,
  green: 0x28a909,
  greenLight: 0x34c60c,
  greenDark: 0x1f8508,
  red: 0xe21c3d,
  redLight: 0xff3b57,
  orange: 0xd07206,
  orangeLight: 0xf3901c,
  cyan: 0x34b4ff,
  purple: 0x913ef8,
  pink: 0xc017b4,
  gold: 0xffd60a,
  curve: 0xe50539,
  curveFill: 0xff2c55,
  pillBlueBg: 0x131d2a,
  pillBlueBorder: 0x204a6e,
  pillPurpleBg: 0x221634,
  pillPurpleBorder: 0x5a2d8e,
  pillMagentaBg: 0x301228,
  pillMagentaBorder: 0x8a1b65,
};

// Rules (aligned with Spribe Aviator)
export const RULES = {
  rtp: 0.97,             // Official RTP 97%
  minBet: 0.1,           // Min bet $0.10
  maxBet: 1000,          // Max bet $1,000.00
  maxWinPerBet: 10000,   // Max win per bet $10,000.00
  maxMultiplier: 100000, // Max multiplier 100,000x
  quickBets: [1, 2, 5, 10], // USD presets matching the screenshot
  startBalance: 30000,   // Default balance: 30,000.00 USD
  bettingMs: 4000,       // Betting countdown before takeoff
  crashedMs: 2500,       // Cooldown after crash
  growth: 0.0865,        // Multiplier growth coefficient m = e^(growth * t)
  reachMs: 3200,         // Time to reach cruising altitude
  historyMax: 30,
};

// Multiplier -> Color (Authentic Aviator history pill palette)
export function multColor(m) {
  if (m < 2) return COLORS.cyan;
  if (m < 10) return COLORS.purple;
  return COLORS.pink;
}

export function multPillTheme(m) {
  if (m < 2) return { text: COLORS.cyan, bg: COLORS.pillBlueBg, border: COLORS.pillBlueBorder };
  if (m < 10) return { text: COLORS.purple, bg: COLORS.pillPurpleBg, border: COLORS.pillPurpleBorder };
  return { text: COLORS.pink, bg: COLORS.pillMagentaBg, border: COLORS.pillMagentaBorder };
}

// -- Layout Coordinates (Tunable via DEV Inspector) --
// All values are design coordinates; the stage dynamically resizes and scales proportionally

export const LAYOUT_PC = {
  designW: 1280,
  designH: 800,
  topbarH: 0,
  historyH: 36,
  sideW: 320,
  gap: 10,
  betPanelH: 172,
  // Plane cruising position ratios inside the flight arena
  planeX: 0.74,
  planeY: 0.30,
  planeScale: 0.30,
  originX: 0.055,
  originY: 0.90,
  multSize: 82,
  multY: 0.37,
  statusSize: 20,
  betBtnH: 74,
  amountH: 36,
  quickH: 22,
  feedRowH: 45,
};

export const LAYOUT_MOBILE = {
  designW: 420,
  designH: 860,
  topbarH: 0,
  historyH: 34,
  sideW: 0,
  gap: 8,
  betPanelH: 150,
  planeX: 0.70,
  planeY: 0.27,
  planeScale: 0.24,
  originX: 0.07,
  originY: 0.88,
  multSize: 50,
  multY: 0.46,
  statusSize: 15,
  betBtnH: 56,
  amountH: 34,
  quickH: 24,
  feedRowH: 30,
};

export function pickLayout(w, h) {
  const mobile = w < 900 || w / h < 1.1;
  return { mobile, L: { ...(mobile ? LAYOUT_MOBILE : LAYOUT_PC) } };
}

export const FONT = 'Roboto, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
