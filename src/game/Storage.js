// localStorage persistence for best scores and settings (all access guarded).
const KEY = 'adventure-mini-golf-v1';

function read() {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function write(data) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    // storage unavailable (private mode etc.) — ignore
  }
}

export const storage = {
  getBestRound() { return read().bestRound ?? null; },
  getBestHoles() { return read().bestHoles ?? {}; },
  getMuted() { return !!read().muted; },
  getQuality() { return read().quality ?? 'auto'; },
  getSensitivity() { return read().sensitivity ?? 1; },

  // Returns { newBestRound, newBestHoles: [holeIndex...] }
  recordRound(scores) {
    const d = read();
    const total = scores.reduce((a, b) => a + b, 0);
    let newBestRound = false;
    if (scores.length === 9 && scores.every((s) => s != null) && (d.bestRound == null || total < d.bestRound)) {
      d.bestRound = total;
      newBestRound = true;
    }
    write(d);
    return { newBestRound };
  },

  recordHole(index, strokes) {
    const d = read();
    d.bestHoles = d.bestHoles || {};
    const prev = d.bestHoles[index];
    const isBest = prev == null || strokes < prev;
    if (isBest) d.bestHoles[index] = strokes;
    write(d);
    return isBest;
  },

  setMuted(m) { const d = read(); d.muted = m; write(d); },
  setQuality(q) { const d = read(); d.quality = q; write(d); },
  setSensitivity(s) { const d = read(); d.sensitivity = s; write(d); },
};
