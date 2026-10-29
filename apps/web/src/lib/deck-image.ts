/**
 * Desenha o deck numa imagem (canvas) para baixar: vertical 1080×1920 (celular) ou horizontal 1920×1080 (desktop).
 * Roda só no navegador. As imagens vêm do bucket público, que responde com CORS liberado.
 */

export interface ExportCard {
  src: string | null;
  name: string;
  count: number;
  landscape?: boolean;
}

export interface ExportDeck {
  title: string;
  kicker: string;
  byline: string;
  legend: ExportCard | null;
  champion: ExportCard | null;
  battlefields: ExportCard[];
  main: ExportCard[];
  runes: ExportCard[];
  side: ExportCard[];
  /** Runas resumidas no topo: cor do domínio, nome e quantidade. */
  runeSummary: { color: string; label: string; count: number }[];
  labels: { main: string; battlefields: string; runes: string; side: string; legend: string; champion: string; site: string };
}

export type Orientation = "vertical" | "horizontal";

const PORTRAIT = 519 / 372;
const LANDSCAPE = 266 / 372;

interface Theme {
  bg: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentInk: string;
  accent2: string;
  sans: string;
  display: string;
}

function readTheme(): Theme {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  const heading = document.querySelector("h1");
  return {
    bg: v("--bg", "#0c0a14"),
    surface: v("--surface-2", "#1e1a33"),
    border: v("--border", "#2d2848"),
    text: v("--text", "#ece9f6"),
    muted: v("--muted", "#a39cc0"),
    accent: v("--accent", "#8b6cff"),
    accentInk: v("--accent-ink", "#0c0a14"),
    accent2: v("--accent-2", "#2fe0c5"),
    sans: getComputedStyle(document.body).fontFamily || "sans-serif",
    display: (heading && getComputedStyle(heading).fontFamily) || "sans-serif",
  };
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Maior carta que cabe: testa cada número de colunas e fica com a de maior largura. */
export function fitGrid(n: number, w: number, h: number, ratio: number, gap: number) {
  let best = { cols: Math.max(1, n), tw: 0 };
  for (let cols = 1; cols <= Math.max(1, n); cols++) {
    const rows = Math.ceil(n / cols);
    const byW = (w - (cols - 1) * gap) / cols;
    const byH = (h - (rows - 1) * gap) / rows / ratio;
    const tw = Math.min(byW, byH);
    if (tw > best.tw) best = { cols, tw };
  }
  return { cols: best.cols, tw: Math.floor(best.tw), th: Math.floor(best.tw * ratio) };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxW || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1]!;
    while (last && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last.trimEnd()}…`;
    return kept;
  }
  return lines;
}

export async function renderDeckImage(deck: ExportDeck, orientation: Orientation): Promise<HTMLCanvasElement> {
  const t = readTheme();
  await document.fonts?.ready;
  const W = orientation === "vertical" ? 1080 : 1920;
  const H = orientation === "vertical" ? 1920 : 1080;
  const P = 56;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const all = [deck.legend, deck.champion, ...deck.battlefields, ...deck.main, ...deck.runes, ...deck.side].filter((c): c is ExportCard => !!c?.src);
  const big = (c: ExportCard | null) => c?.src?.replace("/372/", "/744/") ?? null;
  const srcs = new Set([...all.map((c) => c.src!), big(deck.legend), big(deck.champion)].filter((s): s is string => !!s));
  const images = new Map<string, HTMLImageElement | null>();
  await Promise.all([...srcs].map(async (s) => images.set(s, await loadImage(s))));
  const imgOf = (c: ExportCard, hi = false) => (hi && images.get(big(c)!)) || (c.src ? images.get(c.src) : null) || null;

  // Fundo: cor do site, brilho violeta no canto e a arte do campeão esmaecida atrás do cabeçalho.
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.9);
  glow.addColorStop(0, `${t.accent}40`);
  glow.addColorStop(1, `${t.accent}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  const hero = deck.champion ?? deck.legend;
  const heroImg = hero ? imgOf(hero, true) : null;
  const heroH = orientation === "vertical" ? 520 : H;
  const heroW = orientation === "vertical" ? W : 760;
  if (heroImg) {
    const off = document.createElement("canvas");
    off.width = heroW;
    off.height = heroH;
    const o = off.getContext("2d")!;
    // Só a faixa da arte (topo da carta), em "cover".
    const sx = heroImg.width * 0.06;
    const sw = heroImg.width * 0.88;
    const sh = heroImg.height * 0.36;
    const sy = heroImg.height * 0.07;
    const scale = Math.max(heroW / sw, heroH / sh);
    o.drawImage(heroImg, sx, sy, sw, sh, (heroW - sw * scale) / 2, (heroH - sh * scale) / 2, sw * scale, sh * scale);
    o.globalCompositeOperation = "destination-in";
    const fade = orientation === "vertical" ? o.createLinearGradient(0, 0, 0, heroH) : o.createLinearGradient(0, 0, heroW, 0);
    fade.addColorStop(0, "rgba(0,0,0,0.9)");
    fade.addColorStop(1, "rgba(0,0,0,0)");
    o.fillStyle = fade;
    o.fillRect(0, 0, heroW, heroH);
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.drawImage(off, 0, 0);
    ctx.restore();
  }

  const drawCard = (c: ExportCard, x: number, y: number, w: number, h: number, hi = false) => {
    const img = imgOf(c, hi);
    const r = Math.max(6, w * 0.045);
    ctx.save();
    roundRect(ctx, x, y, w, h, r);
    ctx.clip();
    if (img) ctx.drawImage(img, x, y, w, h);
    else {
      ctx.fillStyle = t.surface;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = t.text;
      ctx.font = `600 ${Math.max(12, w * 0.1)}px ${t.sans}`;
      ctx.textBaseline = "top";
      wrap(ctx, c.name, w - 16, 4).forEach((l, i) => ctx.fillText(l, x + 8, y + 8 + i * w * 0.13));
    }
    ctx.restore();
    if (c.count > 0) {
      const fs = Math.round(Math.max(14, Math.min(30, w * 0.14)));
      ctx.font = `700 ${fs}px ${t.display}`;
      const label = `×${c.count}`;
      const bw = ctx.measureText(label).width + fs * 0.8;
      const bh = fs * 1.35;
      const bx = x + w - bw - w * 0.04;
      const by = y + w * 0.04;
      roundRect(ctx, bx, by, bw, bh, bh / 2);
      ctx.fillStyle = t.accent;
      ctx.fill();
      ctx.fillStyle = t.accentInk;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillText(label, bx + bw / 2, by + bh / 2 + 1);
      ctx.textAlign = "left";
    }
  };

  const LABEL = 40;
  const label = (text: string, total: number | null, x: number, y: number, w: number) => {
    ctx.font = `600 22px ${t.display}`;
    ctx.fillStyle = t.accent2;
    ctx.textBaseline = "top";
    const caps = text.toUpperCase();
    ctx.fillText(caps, x, y);
    let end = x + ctx.measureText(caps).width;
    if (total !== null) {
      ctx.font = `600 20px ${t.sans}`;
      const s = String(total);
      const cw = ctx.measureText(s).width + 20;
      roundRect(ctx, end + 12, y - 3, cw, 28, 14);
      ctx.strokeStyle = t.border;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = t.muted;
      ctx.fillText(s, end + 22, y + 1);
      end += 12 + cw;
    }
    if (end + 16 < x + w) {
      ctx.fillStyle = t.border;
      ctx.fillRect(end + 16, y + 11, x + w - end - 16, 2);
    }
  };

  const grid = (cards: ExportCard[], x: number, y: number, w: number, h: number, ratio: number, gap: number, center = false) => {
    if (!cards.length) return 0;
    const g = fitGrid(cards.length, w, h, ratio, gap);
    // Sobra de largura (grade limitada pela altura) fica dividida dos dois lados.
    const cols = Math.min(g.cols, cards.length);
    if (center) x += Math.max(0, (w - cols * g.tw - (cols - 1) * gap) / 2);
    cards.forEach((c, i) => drawCard(c, x + (i % g.cols) * (g.tw + gap), y + Math.floor(i / g.cols) * (g.th + gap), g.tw, g.th));
    return Math.ceil(cards.length / g.cols) * (g.th + gap) - gap;
  };

  const sum = (cs: ExportCard[]) => cs.reduce((a, c) => a + c.count, 0);

  /** Título, linha de autor e resumo das runas; devolve onde terminou. */
  const headerText = (x: number, y: number, w: number, titleSize: number) => {
    ctx.textBaseline = "top";
    ctx.font = `600 22px ${t.display}`;
    ctx.fillStyle = t.accent2;
    wrap(ctx, deck.kicker.toUpperCase(), w, 2).forEach((l, i) => ctx.fillText(l, x, y + i * 30));
    y += wrap(ctx, deck.kicker.toUpperCase(), w, 2).length * 30 + 10;
    ctx.font = `700 ${titleSize}px ${t.display}`;
    ctx.fillStyle = t.text;
    const lines = wrap(ctx, deck.title, w, 3);
    lines.forEach((l, i) => ctx.fillText(l, x, y + i * titleSize * 1.12));
    y += lines.length * titleSize * 1.12 + 12;
    if (deck.byline) {
      ctx.font = `400 26px ${t.sans}`;
      ctx.fillStyle = t.muted;
      const bl = wrap(ctx, deck.byline, w, 2);
      bl.forEach((l, i) => ctx.fillText(l, x, y + i * 34));
      y += bl.length * 34 + 14;
    }
    let rx = x;
    ctx.font = `500 26px ${t.sans}`;
    for (const r of deck.runeSummary) {
      ctx.beginPath();
      ctx.arc(rx + 11, y + 15, 11, 0, Math.PI * 2);
      ctx.fillStyle = r.color;
      ctx.fill();
      ctx.fillStyle = t.text;
      const s = `${r.count} ${r.label}`;
      ctx.fillText(s, rx + 30, y + 1);
      rx += 30 + ctx.measureText(s).width + 28;
    }
    return y + (deck.runeSummary.length ? 40 : 0);
  };

  /** Faixa de baixo: runas e sideboard lado a lado. */
  const strip = (x: number, y: number, w: number, h: number) => {
    const th = h - LABEL;
    const tw = Math.floor(th / PORTRAIT);
    const runesW = deck.runes.length ? deck.runes.length * tw + (deck.runes.length - 1) * 12 : 0;
    if (deck.runes.length) {
      label(deck.labels.runes, sum(deck.runes), x, y, runesW);
      deck.runes.forEach((c, i) => drawCard(c, x + i * (tw + 12), y + LABEL, tw, th));
    }
    if (deck.side.length) {
      const sx = x + (runesW ? runesW + 48 : 0);
      label(deck.labels.side, sum(deck.side), sx, y, x + w - sx);
      grid(deck.side, sx, y + LABEL, x + w - sx, th, PORTRAIT, 10);
    }
  };

  if (orientation === "vertical") {
    const cardH = 330;
    const cardW = Math.round(cardH / PORTRAIT);
    let cx = P;
    for (const c of [deck.legend, deck.champion]) {
      if (!c) continue;
      drawCard({ ...c, count: 0 }, cx, P, cardW, cardH, true);
      cx += cardW + 18;
    }
    const tx = cx + 22;
    const headEnd = Math.max(P + cardH, headerText(tx, P + 4, W - P - tx, 54));
    const stripH = 250;
    const bfTh = Math.floor(((W - 2 * P - 2 * 16) / 3) * LANDSCAPE);
    const bottom = H - P - 10;
    const stripY = bottom - stripH;
    const bfY = stripY - 36 - LABEL - bfTh;
    const mainY = headEnd + 40;
    label(deck.labels.main, sum(deck.main), P, mainY, W - 2 * P);
    grid(deck.main, P, mainY + LABEL, W - 2 * P, bfY - 36 - mainY - LABEL, PORTRAIT, 12, true);
    if (deck.battlefields.length) {
      label(deck.labels.battlefields, deck.battlefields.length, P, bfY, W - 2 * P);
      const bw = Math.floor(bfTh / LANDSCAPE);
      deck.battlefields.forEach((c, i) => drawCard({ ...c, count: 0 }, P + i * (bw + 16), bfY + LABEL, bw, bfTh));
    }
    strip(P, stripY, W - 2 * P, stripH);
  } else {
    const colW = 560;
    const cardH = 330;
    const cardW = Math.round(cardH / PORTRAIT);
    let cx = P;
    for (const c of [deck.legend, deck.champion]) {
      if (!c) continue;
      drawCard({ ...c, count: 0 }, cx, P, cardW, cardH, true);
      cx += cardW + 18;
    }
    headerText(P, P + cardH + 32, colW, 46);
    if (deck.battlefields.length) {
      const bw = Math.floor((colW - 2 * 14) / 3);
      const bh = Math.floor(bw * LANDSCAPE);
      const by = H - P - 30 - bh;
      label(deck.labels.battlefields, deck.battlefields.length, P, by - LABEL, colW);
      deck.battlefields.forEach((c, i) => drawCard({ ...c, count: 0 }, P + i * (bw + 14), by, bw, bh));
    }
    const rx = P + colW + 64;
    const rw = W - P - rx;
    const stripH = 250;
    const stripY = H - P - 10 - stripH;
    label(deck.labels.main, sum(deck.main), rx, P, rw);
    grid(deck.main, rx, P + LABEL, rw, stripY - 36 - P - LABEL, PORTRAIT, 12, true);
    strip(rx, stripY, rw, stripH);
  }

  ctx.font = `600 20px ${t.display}`;
  ctx.fillStyle = t.muted;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "right";
  ctx.fillText(deck.labels.site, W - P, H - 22);
  ctx.textAlign = "left";
  return canvas;
}
