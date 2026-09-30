// DOM overlay: menus, HUD, scorecards, banners and celebrations.
import { storage } from '../game/Storage.js';

const $ = (id) => document.getElementById(id);

export function scoreName(strokes, par) {
  if (strokes === 1) return 'Hole in One!';
  const d = strokes - par;
  if (d <= -3) return 'Albatross!';
  if (d === -2) return 'Eagle!';
  if (d === -1) return 'Birdie!';
  if (d === 0) return 'Par';
  if (d === 1) return 'Bogey';
  if (d === 2) return 'Double Bogey';
  if (d === 3) return 'Triple Bogey';
  return `+${d}`;
}

export function relText(n) {
  if (n === 0) return 'E';
  return n > 0 ? `+${n}` : `${n}`;
}

const HOLE_COLORS = ['#4cc26a', '#ff8a3d', '#23b5d3', '#e8413c', '#7fc8ff', '#5aa845', '#c98b3a', '#8f5cff', '#ff5a1f'];

export class UI {
  constructor() {
    this.handlers = {};
    this.toastTimer = null;
    this.celTimer = null;
    const click = (id, ev, arg) => $(id).addEventListener('click', (e) => { e.stopPropagation(); this.emit(ev, arg); });
    click('btn-play', 'play');
    click('btn-practice', 'showPractice');
    click('btn-howto', 'showHowto');
    click('btn-howto-back', 'back');
    click('btn-practice-back', 'back');
    click('btn-resume', 'resume');
    click('btn-pause-restart', 'restart');
    click('btn-pause-holes', 'showHoles');
    click('btn-pause-card', 'pauseCard');
    click('btn-pause-menu', 'menu');
    click('btn-restart', 'restart');
    click('btn-sound', 'toggleSound');
    click('btn-menu-sound', 'toggleSound');
    click('btn-view', 'toggleView');
    click('btn-pause', 'pause');
    $('sel-quality').value = storage.getQuality();
    $('sel-quality').addEventListener('change', (e) => this.emit('quality', e.target.value));
    // stop HUD clicks from reaching the canvas
    for (const id of ['hud', 'menu', 'practice', 'howto', 'pause', 'scorecard']) {
      $(id).addEventListener('mousedown', (e) => { if (e.target.closest('button, select, .hole-card')) e.stopPropagation(); });
    }
  }

  on(ev, fn) { this.handlers[ev] = fn; }
  emit(ev, arg) { const fn = this.handlers[ev]; if (fn) fn(arg); }

  showScreen(name) {
    for (const id of ['menu', 'practice', 'howto', 'pause', 'scorecard', 'loading']) $(id).classList.toggle('hidden', id !== name);
  }

  showHud(v) { $('hud').classList.toggle('hidden', !v); }

  setHud({ index, name, par, strokes, total }) {
    $('hud-hole').textContent = index + 1;
    $('hud-name').textContent = name;
    $('hud-par').textContent = par;
    $('hud-total').textContent = total;
    const el = $('hud-strokes');
    if (el.textContent !== String(strokes)) {
      el.textContent = strokes;
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    }
    document.querySelector('.hole-chip').style.background = HOLE_COLORS[index % HOLE_COLORS.length];
  }

  setPower(p) {
    if (p == null) { $('power').classList.add('hidden'); return; }
    $('power').classList.remove('hidden');
    $('power-fill').style.width = `${Math.round(p * 100)}%`;
    $('power-text').textContent = `${Math.round(p * 100)}%`;
  }

  setHint(text) {
    const el = $('hint');
    if (!text) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.textContent = text;
  }

  setLockHint(v) { $('lockhint').classList.toggle('hidden', !v); }

  showBanner(index, def) {
    $('banner-hole').textContent = `HOLE ${index + 1}`;
    $('banner-name').textContent = def.name;
    $('banner-par').textContent = `PAR ${def.par}`;
    $('banner-tip').textContent = def.tip || '';
    const b = $('banner');
    b.classList.remove('hidden');
    b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  }
  hideBanner() { $('banner').classList.add('hidden'); }

  toast(text, sub = '', ms = 1800) {
    const el = $('toast');
    el.innerHTML = '';
    el.append(document.createTextNode(text));
    if (sub) { const s = document.createElement('small'); s.textContent = sub; el.append(s); }
    el.classList.remove('hidden');
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
  }
  hideToast() { $('toast').classList.add('hidden'); }

  celebrate(word, sub = '', cls = '', ms = 2800) {
    const w = $('cel-word');
    w.className = 'cel-word ' + cls;
    w.textContent = word;
    $('cel-sub').textContent = sub;
    const el = $('celebrate');
    el.classList.remove('hidden');
    w.style.animation = 'none'; void w.offsetWidth; w.style.animation = '';
    clearTimeout(this.celTimer);
    this.celTimer = setTimeout(() => el.classList.add('hidden'), ms);
  }
  hideCelebrate() { $('celebrate').classList.add('hidden'); }

  setMuted(m) {
    $('btn-sound').classList.toggle('muted', m);
    $('btn-menu-sound').textContent = m ? 'Sound: Off' : 'Sound: On';
  }

  setViewActive(v) { $('btn-view').classList.toggle('active', v); }

  setBestRound(best, totalPar) {
    $('best-round').textContent = best == null ? 'No best round yet — go set one!' : `Best round: ${best} (${relText(best - totalPar)})`;
  }

  // Hole picker used by the main menu ("Choose a Hole") and the pause menu ("Jump to Hole")
  renderHoleGrid(holes, onSelect, { title = 'Choose a Hole', sub = '', current = -1, scores = null } = {}) {
    $('holes-title').textContent = title;
    $('holes-sub').textContent = sub;
    const grid = $('hole-grid');
    grid.innerHTML = '';
    const best = storage.getBestHoles();
    holes.forEach((h, i) => {
      const card = document.createElement('div');
      card.className = 'hole-card' + (i === current ? ' current' : '');
      card.tabIndex = 0;
      const b = best[i];
      const s = scores ? scores[i] : null;
      const info = [`Par ${h.par}`];
      if (s != null) info.push(`<span class="done">Scored ${s}</span>`);
      else if (b != null) info.push(`Best ${b}`);
      if (i === current) info.push('Playing');
      card.innerHTML = `<div class="n" style="background:${HOLE_COLORS[i]}">${i + 1}</div><div><div class="nm"></div><div class="pr">${info.join(' · ')}</div></div>`;
      card.querySelector('.nm').textContent = h.name;
      const pick = (e) => { e.stopPropagation(); onSelect(i); };
      card.addEventListener('click', pick);
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') pick(e); });
      grid.appendChild(card);
    });
  }

  // scores: array (index -> strokes or undefined)
  renderScorecard({ holes, scores, current = -1, title = 'Scorecard', summary = '', buttons = [] }) {
    $('sc-title').textContent = title;
    $('sc-summary').innerHTML = summary;
    const t = $('sc-table');
    const cells = (fn) => holes.map((h, i) => fn(h, i)).join('');
    const parTotal = holes.reduce((a, h) => a + h.par, 0);
    const played = scores.map((s, i) => (s != null ? i : -1)).filter((i) => i >= 0);
    const strokeTotal = played.reduce((a, i) => a + scores[i], 0);
    const parPlayed = played.reduce((a, i) => a + holes[i].par, 0);
    const badge = (s, par) => {
      if (s == null) return '–';
      let cls = '';
      if (s === 1) cls = 'hio';
      else if (s - par <= -2) cls = 'eagle';
      else if (s - par === -1) cls = 'birdie';
      else if (s - par === 1) cls = 'bogey';
      else if (s - par >= 2) cls = 'double';
      return `<span class="score ${cls}">${s}</span>`;
    };
    t.innerHTML = `
      <tr><th>Hole</th>${cells((h, i) => `<th>${i + 1}</th>`)}<th>Total</th></tr>
      <tr><td>Par</td>${cells((h, i) => `<td class="${i === current ? 'cur' : ''}">${h.par}</td>`)}<td class="total">${parTotal}</td></tr>
      <tr><td>Score</td>${cells((h, i) => `<td class="${i === current ? 'cur' : ''}">${badge(scores[i], h.par)}</td>`)}<td class="total">${played.length ? strokeTotal : '–'}</td></tr>
      <tr><td>+/−</td>${cells((h, i) => `<td class="${i === current ? 'cur' : ''}">${scores[i] != null ? relText(scores[i] - h.par) : ''}</td>`)}<td class="total">${played.length ? relText(strokeTotal - parPlayed) : ''}</td></tr>
    `;
    const bw = $('sc-buttons');
    bw.innerHTML = '';
    for (const b of buttons) {
      const el = document.createElement('button');
      el.className = 'btn' + (b.primary ? ' primary' : '');
      el.textContent = b.label;
      el.addEventListener('click', (e) => { e.stopPropagation(); b.action(); });
      bw.appendChild(el);
    }
    this.showScreen('scorecard');
    const first = bw.querySelector('.primary');
    if (first) setTimeout(() => first.focus(), 50);
  }
}
