// Arbol procedural y determinista: raices, ramas y copa con hojas de verdad.
export type Modo = 'crece' | 'viento' | 'respira' | 'final';

type Punto = [number, number];
type Rama = {pts: Punto[]; w0: number; w1: number; d: number; t0: number; t1: number};
type Hoja = {
  x: number; y: number; rot: number; esc: number; capa: 0 | 1 | 2; tinta: number;
  fase: number; ciclos: number; aparece: number; orden: number;
  vx: number; vy: number; giro: number;
};
export type Escena = {ramas: Rama[]; raices: Rama[]; hojas: Hoja[]; caidas: Hoja[]; vetas: number[][]};

const SUELO = 1420;
const CENTRO = 1080;
const TAU = Math.PI * 2;
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const suave = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rango = (v: number, a: number, b: number) => clamp((v - a) / (b - a));
const rebote = (t: number) => {
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

function azar(semilla: number) {
  let s = semilla;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function crearArbol(semilla: number): Escena {
  const R = azar(semilla);
  const ramas: Rama[] = [];
  const raices: Rama[] = [];
  const hojas: Hoja[] = [];
  const MAX = 7;

  const trazo = (x: number, y: number, ang: number, largo: number, nudo: number, curva: number, bajoTierra = false) => {
    const n = 10;
    const pts: Punto[] = [[x, y]];
    let a = ang;
    for (let i = 1; i <= n; i++) {
      a += curva / n + (R() - 0.5) * nudo;
      if (bajoTierra && Math.sin(a) < 0.09) a = Math.cos(a) > 0 ? 0.09 : Math.PI - 0.09;
      x += (Math.cos(a) * largo) / n;
      y += (Math.sin(a) * largo) / n;
      pts.push([x, y]);
    }
    return {pts, finAng: a};
  };

  const hoja = (x: number, y: number, rot: number, esc: number, capa: 0 | 1 | 2): Hoja => ({
    x, y, rot, esc, capa,
    tinta: Math.floor(R() * 6),
    fase: R() * TAU,
    ciclos: 2 + Math.floor(R() * 3),
    aparece: 0,
    orden: R(),
    vx: 260 + R() * 420,
    vy: 40 + R() * 160,
    giro: (R() - 0.5) * 9,
  });

  const rama = (x: number, y: number, ang: number, largo: number, w: number, d: number, t0: number) => {
    const {pts, finAng} = trazo(x, y, ang, largo, 0.07, (R() - 0.5) * 0.6);
    const dur = 0.2 + 0.05 * (MAX - d);
    const t1 = Math.min(1, t0 + dur);
    const w1 = Math.max(2.4, w * 0.66);
    ramas.push({pts, w0: w, w1, d, t0, t1});
    const [fx, fy] = pts[pts.length - 1];

    if (d >= 5) {
      const n = d >= MAX ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const p = pts[4 + Math.floor(R() * 6)];
        const lado = R() < 0.5 ? -1 : 1;
        hojas.push(hoja(p[0], p[1], finAng + lado * (0.7 + R() * 0.8), 0.72 + R() * 0.5, R() < 0.3 ? 0 : 1));
      }
    }
    if (d >= MAX) {
      const n = 5 + Math.floor(R() * 3);
      for (let i = 0; i < n; i++) {
        const r = 14 + R() * 62;
        const a = R() * TAU;
        const capa: 0 | 1 | 2 = R() < 0.24 ? 0 : R() < 0.72 ? 1 : 2;
        hojas.push(hoja(fx + Math.cos(a) * r, fy + Math.sin(a) * r * 0.8, a + (R() - 0.5) * 0.9, 0.78 + R() * 0.55, capa));
      }
      return;
    }

    const k = R() < 0.38 ? 3 : 2;
    for (let q = 0; q < k; q++) {
      const abre = (q - (k - 1) / 2) * (0.46 + R() * 0.24);
      rama(fx, fy, finAng + abre + (R() - 0.5) * 0.16, largo * (0.74 + R() * 0.07), w * 0.66, d + 1, t1 - 0.04);
    }
    if (d >= 1 && d <= 4 && R() < 0.6) {
      const p = pts[5 + Math.floor(R() * 3)];
      const lado = R() < 0.5 ? -1 : 1;
      rama(p[0], p[1], finAng + lado * (0.75 + R() * 0.3), largo * 0.56, w * 0.48, d + 2, lerp(t0, t1, 0.55));
    }
  };

  rama(CENTRO, SUELO + 6, -Math.PI / 2, 430, 104, 0, 0);

  // Encaja la copa dentro del cuadro sin deformarla.
  let minY = 9e9, minX = 9e9, maxX = -9e9;
  for (const r of ramas) for (const [x, y] of r.pts) {
    minY = Math.min(minY, y); minX = Math.min(minX, x); maxX = Math.max(maxX, x);
  }
  for (const h of hojas) { minY = Math.min(minY, h.y); minX = Math.min(minX, h.x); maxX = Math.max(maxX, h.x); }
  const fit = Math.min(1, (SUELO - 130) / (SUELO - minY), 1000 / Math.max(CENTRO - minX, maxX - CENTRO));
  const ajusta = (x: number, y: number): Punto => [CENTRO + (x - CENTRO) * fit, SUELO + (y - SUELO) * fit];
  for (const r of ramas) { r.pts = r.pts.map(([x, y]) => ajusta(x, y)); r.w0 *= Math.sqrt(fit); r.w1 *= Math.sqrt(fit); }
  for (const h of hojas) { [h.x, h.y] = ajusta(h.x, h.y); }

  // Las hojas nacen de adentro hacia afuera.
  for (const h of hojas) {
    const dist = Math.hypot(h.x - CENTRO, (h.y - 800) * 0.9) / 1000;
    h.aparece = clamp(dist * 0.72 + R() * 0.2, 0, 0.82);
  }

  const raiz = (x: number, y: number, ang: number, largo: number, w: number, d: number, t0: number) => {
    const {pts, finAng} = trazo(x, y, ang, largo, 0.14, (R() - 0.5) * 1, true);
    const t1 = Math.min(1, t0 + 0.3);
    const w1 = Math.max(2.5, w * 0.6);
    raices.push({pts, w0: w, w1, d, t0, t1});
    if (d >= 5) return;
    const [fx, fy] = pts[pts.length - 1];
    if (fy > 2080 || fx < 90 || fx > 2070) return;
    const k = d < 2 ? 2 : R() < 0.7 ? 2 : 1;
    for (let q = 0; q < k; q++) {
      raiz(fx, fy, finAng + (q - (k - 1) / 2) * (0.6 + R() * 0.4), largo * (0.7 + R() * 0.12), w * 0.62, d + 1, t1 - 0.05);
    }
  };
  [-1.34, -0.94, -0.52, -0.16, 0.2, 0.6, 1.0, 1.36].forEach((o, i) => {
    const horizontal = Math.abs(o) / 1.4;
    raiz(CENTRO + o * 34, SUELO + 2, Math.PI / 2 + o * 0.98, 170 + R() * 60 + horizontal * 90, i % 3 === 1 ? 44 : 34, 0, 0.02 * i);
  });

  const caidas: Hoja[] = [];
  for (let i = 0; i < 30; i++) {
    const h = hoja(360 + R() * 1440, 240 + R() * 520, R() * TAU, 0.9 + R() * 0.5, 2);
    caidas.push(h);
  }
  const vetas: number[][] = [];
  for (let i = 0; i < 22; i++) vetas.push([R(), 180 + R() * 1700, 240 + R() * 420, R() * TAU, 1.2 + R() * 1.4]);

  if (hojas.length > 3600) {
    const salto = hojas.length / 3600;
    const elegidas: Hoja[] = [];
    for (let i = 0; i < 3600; i++) elegidas.push(hojas[Math.floor(i * salto)]);
    return {ramas, raices, hojas: elegidas, caidas, vetas};
  }
  return {ramas, raices, hojas, caidas, vetas};
}

// Hojas pre-dibujadas con nervadura, una por tono y por capa de profundidad.
const TONOS = ['#FF3300', '#FF4E12', '#FF6A1F', '#FF7F12', '#FF9900', '#E62E00'];
const CLAROS = ['#FF7A3D', '#FF8F52', '#FFA24D', '#FFB84D', '#FFC766', '#FF6A2B'];
let moldes: HTMLCanvasElement[][] | null = null;
const LARGO = 74;
const ANCHO = 46;
const ESCALA_MOLDE = 3;

function mezcla(hex: string, conBlanco: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * conBlanco));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function crearMoldes() {
  const blanco = [0.5, 0, 0];
  const tabla: HTMLCanvasElement[][] = [];
  for (let capa = 0; capa < 3; capa++) {
    const fila: HTMLCanvasElement[] = [];
    for (let t = 0; t < TONOS.length; t++) {
      const c = document.createElement('canvas');
      c.width = LARGO * ESCALA_MOLDE;
      c.height = ANCHO * ESCALA_MOLDE;
      const x = c.getContext('2d')!;
      x.scale(ESCALA_MOLDE * LARGO, ESCALA_MOLDE * LARGO);
      x.translate(0, ANCHO / LARGO / 2);
      const silueta = () => {
        x.beginPath();
        x.moveTo(0.05, 0);
        x.bezierCurveTo(0.2, -0.3, 0.6, -0.33, 0.985, 0);
        x.bezierCurveTo(0.62, 0.29, 0.22, 0.27, 0.05, 0);
        x.closePath();
      };
      const g = x.createLinearGradient(0, -0.2, 1, 0.2);
      g.addColorStop(0, mezcla(TONOS[t], blanco[capa]));
      g.addColorStop(1, mezcla(capa === 2 ? CLAROS[t] : TONOS[(t + 2) % 6], blanco[capa]));
      silueta();
      x.fillStyle = g;
      x.fill();
      x.save();
      silueta();
      x.clip();
      x.fillStyle = 'rgba(110,22,0,0.17)';
      x.fillRect(0, 0, 1, 0.4);
      x.restore();
      x.strokeStyle = capa === 0 ? 'rgba(255,255,255,0.4)' : 'rgba(255,240,226,0.72)';
      x.lineCap = 'round';
      x.lineWidth = 0.014;
      x.beginPath();
      x.moveTo(0.05, 0);
      x.quadraticCurveTo(0.5, -0.015, 0.95, 0);
      x.stroke();
      x.lineWidth = 0.007;
      x.strokeStyle = capa === 0 ? 'rgba(255,255,255,0.26)' : 'rgba(255,240,226,0.42)';
      for (let v = 0; v < 5; v++) {
        const u = 0.2 + v * 0.14;
        for (const lado of [-1, 1]) {
          x.beginPath();
          x.moveTo(u, 0);
          x.quadraticCurveTo(u + 0.05, lado * 0.09, u + 0.13, lado * (0.19 - v * 0.016));
          x.stroke();
        }
      }
      x.strokeStyle = '#5b6a6f';
      x.lineWidth = 0.022;
      x.beginPath();
      x.moveTo(0, 0);
      x.lineTo(0.08, 0);
      x.stroke();
      fila.push(c);
    }
    tabla.push(fila);
  }
  return tabla;
}

function curvar(x: number, y: number, tau: number, T: number, fuerza: number): Punto {
  const alto = clamp((SUELO - y) / (SUELO - 90));
  const p = Math.pow(alto, 1.7);
  const o = (TAU * tau) / T;
  const s = Math.sin(o + x * 0.0016) * 10 + Math.sin(2 * o + x * 0.003 + 1.2) * 5.5 + Math.sin(3 * o + y * 0.002) * 2.5;
  const f = s + fuerza * (0.86 + 0.14 * Math.sin(o * 2 + x * 0.004));
  return [x + p * f, y + p * p * Math.abs(f) * 0.13];
}

function colorRaiz(d: number) {
  return ['#3f4c50', '#4a585c', '#5a686c', '#6e7b80', '#8a9599', '#a5aeb2'][Math.min(5, d)];
}

function color(d: number) {
  if (d < 2) return '#3a464a';
  if (d < 4) return '#4d5b60';
  if (d < 6) return '#667479';
  return '#7f8c91';
}

function dibujarRama(ctx: CanvasRenderingContext2D, r: Rama, avance: number, deforma: (x: number, y: number) => Punto, tinta: string) {
  const n = r.pts.length - 1;
  const hasta = avance * n;
  if (hasta <= 0) return;
  ctx.strokeStyle = tinta;
  ctx.globalAlpha = 1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  let [ax, ay] = deforma(r.pts[0][0], r.pts[0][1]);
  const lista: Punto[] = [[ax, ay]];
  for (let i = 0; i < Math.ceil(hasta) && i < n; i++) {
    const u = Math.min(1, hasta - i);
    const [px, py] = r.pts[i];
    const [qx, qy] = r.pts[i + 1];
    const [bx, by] = deforma(lerp(px, qx, u), lerp(py, qy, u));
    ctx.lineWidth = lerp(r.w0, r.w1, (i + 0.5) / n);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ax = bx;
    ay = by;
    lista.push([ax, ay]);
  }
  if (r.w0 > 24) {
    const w = (r.w0 + r.w1) / 2;
    ctx.globalAlpha = 0.11;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = w * 0.2;
    ctx.beginPath();
    lista.forEach(([x, y], i) => (i ? ctx.lineTo(x - w * 0.2, y) : ctx.moveTo(x - w * 0.2, y)));
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function dibujarHoja(ctx: CanvasRenderingContext2D, h: Hoja, x: number, y: number, rot: number, esc: number, alfa = 1) {
  const m = moldes![h.capa][h.tinta];
  const c = Math.cos(rot) * esc;
  const s = Math.sin(rot) * esc;
  ctx.globalAlpha = alfa;
  ctx.setTransform(c, s, -s, c, x, y);
  ctx.drawImage(m, 0, -ANCHO / 2, LARGO, ANCHO);
}

function fuerzaViento(t: number) {
  const a = suave(rango(t, 1.7, 3.2)) * 74;
  const b = -suave(rango(t, 3.6, 5.2)) * 34;
  const c = suave(rango(t, 5.2, 7.3)) * 196;
  const d = -suave(rango(t, 7.6, 10.2)) * 236;
  return a + b + c + d;
}

export function dibujarEscena(ctx: CanvasRenderingContext2D, E: Escena, modo: Modo, t: number) {
  if (!moldes) moldes = crearMoldes();
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const T = modo === 'crece' ? 6 : modo === 'viento' ? 12 : 10;
  let tRaiz = 1, tRama = 1, tHoja = 1, tSuelo = 1, pulso = 0, fuerza = 0;
  if (modo === 'crece') {
    tSuelo = suave(rango(t, 0, 0.7));
    tRaiz = rango(t, 0.3, 3.5);
    tRama = rango(t, 3.5, 7.5);
    tHoja = rango(t, 7.5, 12);
    pulso = rango(t, 1.1, 2.2) * (1 - rango(t, 3.6, 4.6));
  }
  if (modo === 'viento') {
    fuerza = fuerzaViento(t);
    pulso = rango(t, 9.1, 10.1);
  }
  if (modo === 'final') pulso = 0;
  const deforma = (x: number, y: number) => curvar(x, y, t, T, fuerza);

  // Suelo: sombra, tierra tenue y linea.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, SUELO, W, H - SUELO);
  ctx.clip();
  ctx.translate(CENTRO, SUELO);
  ctx.scale(1, 0.72);
  const tierra = ctx.createRadialGradient(0, 0, 0, 0, 0, 1040);
  tierra.addColorStop(0, `rgba(72,84,88,${0.1 * tSuelo})`);
  tierra.addColorStop(0.62, `rgba(72,84,88,${0.05 * tSuelo})`);
  tierra.addColorStop(1, 'rgba(72,84,88,0)');
  ctx.fillStyle = tierra;
  ctx.fillRect(-1080, 0, 2160, 1200);
  ctx.restore();
  ctx.save();
  ctx.translate(CENTRO, SUELO + 2);
  ctx.scale(1, 0.055);
  const sombra = ctx.createRadialGradient(0, 0, 0, 0, 0, 930);
  sombra.addColorStop(0, `rgba(72,84,88,${0.3 * tSuelo * Math.max(tRama, 0.25)})`);
  sombra.addColorStop(1, 'rgba(72,84,88,0)');
  ctx.fillStyle = sombra;
  ctx.fillRect(-930, -930, 1860, 1860);
  ctx.restore();
  ctx.strokeStyle = `rgba(72,84,88,${0.5 * tSuelo})`;
  ctx.lineWidth = 5;
  ctx.setLineDash([26, 22]);
  ctx.lineDashOffset = 0;
  const anchoLinea = 980 * tSuelo;
  ctx.beginPath();
  ctx.moveTo(CENTRO - anchoLinea, SUELO);
  ctx.lineTo(CENTRO + anchoLinea, SUELO);
  ctx.stroke();
  ctx.setLineDash([]);

  // Raices.
  for (const r of E.raices) {
    const a = suave(rango(tRaiz, r.t0, r.t1));
    if (a > 0) dibujarRama(ctx, r, a, (x, y) => [x, y], colorRaiz(r.d));
  }
  if (pulso > 0) {
    ctx.lineCap = 'round';
    const prim = E.raices.filter((r) => r.d < 3);
    prim.forEach((r, i) => {
      const n = r.pts.length - 1;
      const u = (t / 1.5 + i * 0.37) % 1;
      const a = Math.floor(u * n);
      const b = Math.min(n, a + 2);
      ctx.strokeStyle = '#FF9900';
      ctx.globalAlpha = pulso;
      ctx.lineWidth = Math.max(5, r.w0 * 0.42);
      ctx.beginPath();
      ctx.moveTo(r.pts[a][0], r.pts[a][1]);
      for (let k = a + 1; k <= b; k++) ctx.lineTo(r.pts[k][0], r.pts[k][1]);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  const avanceHoja = (h: Hoja) => (tHoja >= 1 ? 1 : rebote(rango(tHoja, h.aparece, h.aparece + 0.17)));
  const pintaCapa = (capa: 0 | 1 | 2) => {
    for (const h of E.hojas) {
      if (h.capa !== capa) continue;
      const av = rango(tHoja, h.aparece, h.aparece + 0.17) > 0 ? avanceHoja(h) : 0;
      if (av <= 0) continue;
      const o = (TAU * t) / T;
      const aleteo = Math.sin(o * h.ciclos + h.fase) * (0.1 + Math.abs(fuerza) * 0.0016);
      let [x, y] = deforma(h.x, h.y);
      let rot = h.rot + aleteo + fuerza * 0.0012;
      let alfa = 1;
      if (modo === 'viento') {
        const tD = h.orden < 0.3 ? 2 + (h.orden / 0.3) * 2.2 : h.orden < 0.56 ? 5.3 + ((h.orden - 0.3) / 0.26) * 2.6 : 99;
        const edad = t - tD;
        if (edad > 0) {
          x += h.vx * edad + 84 * edad * edad;
          y += h.vy * edad * 0.6 + 58 * edad * edad + Math.sin(edad * 3 + h.fase) * 38 * Math.sqrt(edad);
          rot += h.giro * edad;
          alfa = (1 - rango(edad, 2.4, 3.6)) * (1 - rango(x, 1820, 2120));
          if (alfa <= 0) continue;
        }
      }
      dibujarHoja(ctx, h, x, y, rot, h.esc * av, alfa);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  };

  pintaCapa(0);
  for (const r of E.ramas) {
    const a = suave(rango(tRama, r.t0, r.t1));
    if (a > 0) dibujarRama(ctx, r, a, deforma, color(r.d));
  }
  pintaCapa(1);
  pintaCapa(2);

  if (modo === 'final') {
    for (const h of E.caidas) {
      const u = (t / T + h.orden) % 1;
      const alfa = rango(u, 0, 0.1) * (1 - rango(u, 0.86, 1));
      const x = h.x + Math.sin(u * TAU * 2 + h.fase) * 70 - u * 150;
      const y = lerp(h.y, SUELO - 12, u);
      dibujarHoja(ctx, h, x, y, h.rot + Math.sin(u * TAU * 3 + h.fase) * 1.3 + u * 2, h.esc, alfa);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  if (modo === 'viento' && Math.abs(fuerza) > 8) {
    const a = clamp(Math.abs(fuerza) / 150);
    ctx.lineCap = 'round';
    for (const v of E.vetas) {
      const u = ((t * v[4]) / 2.4 + v[0]) % 1;
      const x = lerp(-300, 2100 - v[2], u);
      const y = v[1] * 0.74 + Math.sin(v[3] + t * 1.4) * 24;
      ctx.strokeStyle = 'rgba(72,84,88,0.2)';
      ctx.globalAlpha = a * Math.pow(Math.sin(Math.PI * u), 2);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + v[2] * 0.33, y - 26, x + v[2] * 0.66, y + 26, x + v[2], y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
