// Abre un .pptx (que por dentro es un zip) sin dependencias.
// Funciona igual en el navegador y en Node 20.12 o superior.
export async function abrirZip(datos) {
  const b = datos instanceof Uint8Array ? datos : new Uint8Array(datos);
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let fin = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  }
  if (fin < 0) throw new Error('El archivo no parece un .pptx: no se pudo abrir.');
  const total = v.getUint16(fin + 10, true);
  let p = v.getUint32(fin + 16, true);
  const dec = new TextDecoder();
  const entradas = new Map();
  for (let n = 0; n < total; n++) {
    if (p + 46 > b.length || v.getUint32(p, true) !== 0x02014b50) break;
    const metodo = v.getUint16(p + 10, true);
    const comprimido = v.getUint32(p + 20, true);
    const largoNombre = v.getUint16(p + 28, true);
    const largoExtra = v.getUint16(p + 30, true);
    const largoComentario = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const nombre = dec.decode(b.subarray(p + 46, p + 46 + largoNombre));
    entradas.set(nombre, { metodo, comprimido, local });
    p += 46 + largoNombre + largoExtra + largoComentario;
  }

  async function bytes(nombre) {
    const e = entradas.get(nombre);
    if (!e) return null;
    const inicio = e.local + 30 + v.getUint16(e.local + 26, true) + v.getUint16(e.local + 28, true);
    const crudo = b.subarray(inicio, inicio + e.comprimido);
    if (e.metodo === 0) return crudo;
    if (e.metodo !== 8) throw new Error('Compresión no soportada en ' + nombre);
    const flujo = new Blob([crudo]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(flujo).arrayBuffer());
  }

  return {
    nombres: [...entradas.keys()],
    tiene: (nombre) => entradas.has(nombre),
    bytes,
    texto: async (nombre) => {
      const x = await bytes(nombre);
      return x ? dec.decode(x) : null;
    },
  };
}
