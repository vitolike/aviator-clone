// 驗證崩盤倍數分佈與 RTP：node tools/simrtp.mjs
import { crashFromHash, sha256Hex, randomSeed } from '../src/core/fair.js';

const RTP = 0.97;
const N = 200000;

// 1) 用真實 SHA-256 抽樣，檢查各目標倍數的實測回報率
const samples = [];
const clientSeed = randomSeed(8);
for (let i = 0; i < N; i++) {
  // 為速度改用同步偽 hash 來源不行，這裡直接用真 hash（分批）
  samples.push(i);
}
const hashes = await Promise.all(samples.map((i) => sha256Hex(`${randomSeed(8)}:${clientSeed}:${i}`)));
const crashes = hashes.map(crashFromHash);

const stat = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  return {
    n: arr.length,
    instant: (arr.filter((m) => m <= 1.0).length / arr.length * 100).toFixed(2) + '%',
    median: s[(s.length / 2) | 0].toFixed(2),
    p90: s[(s.length * 0.9) | 0].toFixed(2),
    max: s[s.length - 1].toFixed(2),
  };
};
console.log('崩盤倍數樣本統計:', stat(crashes));

console.log('\n目標倍數  命中率(理論)  命中率(實測)  回報率(實測)');
for (const m of [1.2, 1.5, 2, 3, 5, 10, 50, 100]) {
  const hit = crashes.filter((c) => c >= m).length / crashes.length;
  console.log(
    `${String(m).padEnd(8)}  ${(RTP / m * 100).toFixed(2).padStart(9)}%  ${(hit * 100).toFixed(2).padStart(9)}%  ${(hit * m * 100).toFixed(2).padStart(9)}%`,
  );
}

// 2) 隨機目標策略的整體 RTP
let bet = 0, ret = 0;
for (const c of crashes) {
  const target = 1.1 + Math.random() * 9;
  bet += 1;
  if (c >= target) ret += target;
}
console.log(`\n隨機目標策略整體 RTP: ${(ret / bet * 100).toFixed(2)}%（理論 ${RTP * 100}%）`);
