// Generador de códigos QR sin dependencias: modo byte, corrección M, versiones 1 a 9
// (hasta 180 caracteres, de sobra para una dirección web).
const QR_EC = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22];
const QR_BLOQUES = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5];
const QR_TOTAL = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292];
const QR_MASCARAS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function qrMul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function qrDivisor(grado) {
  const r = new Array(grado).fill(0);
  r[grado - 1] = 1;
  let raiz = 1;
  for (let i = 0; i < grado; i++) {
    for (let j = 0; j < grado; j++) {
      r[j] = qrMul(r[j], raiz);
      if (j + 1 < grado) r[j] ^= r[j + 1];
    }
    raiz = qrMul(raiz, 2);
  }
  return r;
}

function qrResto(datos, div) {
  const r = div.map(() => 0);
  for (const b of datos) {
    const f = b ^ r.shift();
    r.push(0);
    for (let i = 0; i < div.length; i++) r[i] ^= qrMul(div[i], f);
  }
  return r;
}

function qrPenalidad(m, n) {
  let p = 0;
  let oscuros = 0;
  const PATRON = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  for (let a = 0; a < n; a++) {
    for (const fila of [true, false]) {
      let racha = 1;
      for (let b = 0; b < n; b++) {
        const v = fila ? m[a][b] : m[b][a];
        if (b > 0) {
          const ant = fila ? m[a][b - 1] : m[b - 1][a];
          if (v === ant) {
            racha++;
            if (racha === 5) p += 3;
            else if (racha > 5) p++;
          } else racha = 1;
        }
        if (b + 11 <= n) {
          let directo = true;
          let inverso = true;
          for (let k = 0; k < 11; k++) {
            const w = fila ? m[a][b + k] : m[b + k][a];
            if (w !== PATRON[k]) directo = false;
            if (w !== PATRON[10 - k]) inverso = false;
          }
          if (directo) p += 40;
          if (inverso) p += 40;
        }
      }
    }
  }
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      oscuros += m[y][x];
      if (x + 1 < n && y + 1 < n && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
    }
  }
  const total = n * n;
  p += (Math.ceil(Math.abs(oscuros * 20 - total * 10) / total) - 1) * 10;
  return p;
}

// Devuelve { n, m } con la matriz de módulos (1 = oscuro). `forzarMascara` es solo para pruebas.
export function qrMatriz(texto, forzarMascara) {
  const bytes = Array.from(new TextEncoder().encode(texto));
  let ver = 1;
  while (ver <= 9 && bytes.length > QR_TOTAL[ver] - QR_EC[ver] * QR_BLOQUES[ver] - 2) ver++;
  if (ver > 9) throw new Error('El texto es demasiado largo para el código QR.');
  const nb = QR_BLOQUES[ver];
  const ec = QR_EC[ver];
  const total = QR_TOTAL[ver];
  const nDatos = total - ec * nb;

  const bits = [];
  const poner = (v, largo) => { for (let i = largo - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
  poner(4, 4);
  poner(bytes.length, 8);
  bytes.forEach((b) => poner(b, 8));
  poner(0, Math.min(4, nDatos * 8 - bits.length));
  poner(0, (8 - (bits.length % 8)) % 8);
  for (let relleno = 0xec; bits.length < nDatos * 8; relleno ^= 0xec ^ 0x11) poner(relleno, 8);
  const datos = [];
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0;
    for (let k = 0; k < 8; k++) v = (v << 1) | bits[i + k];
    datos.push(v);
  }

  const cortos = nb - (total % nb);
  const largoCorto = Math.floor(total / nb);
  const div = qrDivisor(ec);
  const bloques = [];
  let k = 0;
  for (let i = 0; i < nb; i++) {
    const d = datos.slice(k, k + largoCorto - ec + (i < cortos ? 0 : 1));
    k += d.length;
    bloques.push({ d, e: qrResto(d, div) });
  }
  const flujo = [];
  for (let i = 0; i <= largoCorto - ec; i++) bloques.forEach((b) => { if (i < b.d.length) flujo.push(b.d[i]); });
  for (let i = 0; i < ec; i++) bloques.forEach((b) => flujo.push(b.e[i]));

  const n = ver * 4 + 17;
  const m = [];
  const fn = [];
  for (let i = 0; i < n; i++) {
    m.push(new Array(n).fill(0));
    fn.push(new Array(n).fill(false));
  }
  const fijo = (x, y, v) => { m[y][x] = v ? 1 : 0; fn[y][x] = true; };

  for (let i = 0; i < n; i++) {
    fijo(6, i, i % 2 === 0);
    fijo(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [[3, 3], [n - 4, 3], [3, n - 4]]) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && x < n && y >= 0 && y < n) fijo(x, y, d !== 2 && d !== 4);
      }
    }
  }
  if (ver > 1) {
    const na = Math.floor(ver / 7) + 2;
    const paso = Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2;
    const pos = [6];
    for (let q = n - 7; pos.length < na; q -= paso) pos.splice(1, 0, q);
    pos.forEach((cx, i) => pos.forEach((cy, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) fijo(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }));
  }
  const formato = (mascara) => {
    let r = mascara;
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((mascara << 10) | r) ^ 0x5412;
    const bit = (i) => (b >>> i) & 1;
    for (let i = 0; i <= 5; i++) fijo(8, i, bit(i));
    fijo(8, 7, bit(6));
    fijo(8, 8, bit(7));
    fijo(7, 8, bit(8));
    for (let i = 9; i < 15; i++) fijo(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) fijo(n - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) fijo(8, n - 15 + i, bit(i));
    fijo(8, n - 8, 1);
  };
  formato(0);
  if (ver >= 7) {
    let r = ver;
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const b = (ver << 12) | r;
    for (let i = 0; i < 18; i++) {
      const a = n - 11 + (i % 3);
      const c = Math.floor(i / 3);
      const v = (b >>> i) & 1;
      fijo(a, c, v);
      fijo(c, a, v);
    }
  }

  let i = 0;
  for (let der = n - 1; der >= 1; der -= 2) {
    if (der === 6) der = 5;
    for (let v = 0; v < n; v++) {
      for (let j = 0; j < 2; j++) {
        const x = der - j;
        const sube = ((der + 1) & 2) === 0;
        const y = sube ? n - 1 - v : v;
        if (!fn[y][x] && i < flujo.length * 8) {
          m[y][x] = (flujo[i >>> 3] >>> (7 - (i & 7))) & 1;
          i++;
        }
      }
    }
  }

  const aplicar = (q) => {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!fn[y][x] && QR_MASCARAS[q](x, y)) m[y][x] ^= 1;
  };
  let mejor = forzarMascara ?? 0;
  if (forzarMascara === undefined) {
    let minimo = Infinity;
    for (let q = 0; q < 8; q++) {
      aplicar(q);
      formato(q);
      const p = qrPenalidad(m, n);
      if (p < minimo) { minimo = p; mejor = q; }
      aplicar(q);
    }
  }
  aplicar(mejor);
  formato(mejor);
  return { n, m, mascara: mejor };
}

// Devuelve el QR como SVG listo para insertar.
export function qrSvg(texto, color) {
  const { n, m } = qrMatriz(texto);
  const borde = 3;
  let d = '';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!m[y][x]) continue;
      let largo = 1;
      while (x + largo < n && m[y][x + largo]) largo++;
      d += 'M' + (x + borde) + ' ' + (y + borde) + 'h' + largo + 'v1h-' + largo + 'z';
      x += largo - 1;
    }
  }
  const lado = n + borde * 2;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + lado + ' ' + lado + '" shape-rendering="crispEdges" role="img" aria-label="Código QR">'
    + '<rect width="' + lado + '" height="' + lado + '" fill="#fff"/><path d="' + d + '" fill="' + (color || '#1B1F21') + '"/></svg>';
}
