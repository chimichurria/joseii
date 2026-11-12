// Lector de XML mínimo: alcanza para los archivos de un .pptx y no depende del navegador.
const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function desescapar(t) {
  if (t.indexOf('&') < 0) return t;
  return t.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (todo, e) => {
    if (e[0] !== '#') return ENTIDADES[e] ?? todo;
    const hex = e[1] === 'x' || e[1] === 'X';
    return String.fromCodePoint(parseInt(e.slice(hex ? 2 : 1), hex ? 16 : 10));
  });
}

export function leerXml(txt) {
  const raiz = { n: '#raiz', a: {}, c: [], t: '' };
  const pila = [raiz];
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/([^\s>]+)\s*>|<([^\s>\/]+)((?:\s+[^\s=>\/]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(txt))) {
    const arriba = pila[pila.length - 1];
    if (m[1] !== undefined) arriba.t += m[1];
    else if (m[2]) { if (pila.length > 1) pila.pop(); }
    else if (m[3]) {
      const nodo = { n: m[3], a: {}, c: [], t: '' };
      if (m[4]) {
        const ra = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
        let x;
        while ((x = ra.exec(m[4]))) nodo.a[x[1]] = desescapar(x[2] ?? x[3]);
      }
      arriba.c.push(nodo);
      if (!m[5]) pila.push(nodo);
    } else if (m[6]) arriba.t += desescapar(m[6]);
  }
  return raiz;
}

export const hijos = (n, nombre) => (n ? n.c.filter((x) => x.n === nombre) : []);
export const hijo = (n, nombre) => (n ? n.c.find((x) => x.n === nombre) : undefined);

export function ruta(n, ...nombres) {
  for (const x of nombres) {
    n = hijo(n, x);
    if (!n) return undefined;
  }
  return n;
}

export function todos(n, nombre, salida = []) {
  if (!n) return salida;
  for (const x of n.c) {
    if (x.n === nombre) salida.push(x);
    todos(x, nombre, salida);
  }
  return salida;
}
