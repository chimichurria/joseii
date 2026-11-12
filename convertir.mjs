#!/usr/bin/env node
// Convierte un .pptx en una presentación HTML desde la terminal.
//   node convertir.mjs mi-charla.pptx
//   node convertir.mjs mi-charla.pptx --vivo https://mi-charla.vercel.app --evento "Jornadas 2026"
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerPptx } from './src/pptx.mjs';
import { armarHtml } from './src/armar.mjs';

const AYUDA = `Uso: node convertir.mjs <archivo.pptx> [opciones]

  -o, --salida <archivo>   Dónde guardar el HTML (por defecto, al lado del .pptx)
      --evento <texto>     Nombre del evento: aparece arriba de cada diapositiva y en el pie
      --vivo [dirección]   Activa votaciones, nube de palabras y preguntas (tipo Menti).
                           La dirección del servidor es opcional: se puede cargar después con la tecla C
      --colores-ppt        Usa los colores del tema del PowerPoint en vez del naranja original
      --color <#hex>       Color principal propio (y --color2 <#hex> para el secundario)
      --logo <imagen>      Logo para el pie de cada diapositiva
      --todo-junto         Muestra los puntos todos juntos en vez de uno por clic
      --sin-notas          No incluye las notas del orador en el HTML
`;

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp' };

function leerArgumentos(lista) {
  const o = { entrada: '', salida: '', evento: '', vivo: false, api: '', pasos: true, notas: true, coloresPpt: false, color: '', color2: '', logo: '' };
  for (let i = 0; i < lista.length; i++) {
    const a = lista[i];
    const valor = () => lista[++i] ?? '';
    if (a === '-h' || a === '--help' || a === '--ayuda') o.ayuda = true;
    else if (a === '-o' || a === '--salida') o.salida = valor();
    else if (a === '--evento') o.evento = valor();
    else if (a === '--vivo') { o.vivo = true; if (lista[i + 1] && !lista[i + 1].startsWith('-')) o.api = valor(); }
    else if (a === '--colores-ppt') o.coloresPpt = true;
    else if (a === '--color') o.color = valor();
    else if (a === '--color2') o.color2 = valor();
    else if (a === '--logo') o.logo = valor();
    else if (a === '--todo-junto') o.pasos = false;
    else if (a === '--sin-notas') o.notas = false;
    else if (a.startsWith('-')) throw new Error('Opción desconocida: ' + a);
    else o.entrada = a;
  }
  return o;
}

async function principal() {
  const o = leerArgumentos(process.argv.slice(2));
  if (o.ayuda || !o.entrada) { console.log(AYUDA); process.exit(o.ayuda ? 0 : 1); }
  const aqui = path.dirname(fileURLToPath(import.meta.url));
  const leer = (f) => readFile(path.join(aqui, 'src', f), 'utf8');
  const [css, js, qr] = await Promise.all([leer('motor.css'), leer('motor.js'), leer('qr.mjs')]);
  const modelo = await leerPptx(await readFile(o.entrada), path.basename(o.entrada));
  if (o.api && !/^https?:\/\//i.test(o.api)) o.api = 'https://' + o.api;
  let logo = '';
  if (o.logo) {
    const mime = MIME[path.extname(o.logo).slice(1).toLowerCase()];
    if (!mime) throw new Error('El logo tiene que ser PNG, JPG, SVG, GIF o WebP.');
    logo = 'data:' + mime + ';base64,' + (await readFile(o.logo)).toString('base64');
  }
  const colores = o.color ? [o.color, o.color2 || o.color] : o.coloresPpt ? modelo.colores : null;
  const r = armarHtml(modelo, { evento: o.evento, vivo: o.vivo, api: o.api, pasos: o.pasos, notas: o.notas, colores, logo }, { css, js, qr });
  const salida = o.salida || o.entrada.replace(/\.pptx$/i, '') + '.html';
  await writeFile(salida, r.html);
  const s = r.resumen;
  console.log('Listo: ' + salida + ' (' + Math.round(r.html.length / 1024) + ' KB)');
  console.log(s.diapositivas + ' diapositivas' + (r.config.vivo ? ' · ' + s.votaciones + ' votaciones · ' + s.nubes + ' nubes de palabras · ' + s.preguntas + ' de preguntas' : ''));
  if (r.config.vivo && !r.config.api) console.log('Modo en vivo sin servidor: las votaciones se cuentan a mano con + y −. Para conectar la sala, mirá vivo/ en el README.');
  r.avisos.forEach((a) => console.log('Aviso · ' + a));
}

principal().catch((e) => {
  const motivo = e.code === 'ENOENT' ? 'no existe el archivo ' + e.path : e.code === 'EACCES' ? 'no hay permiso para leer ' + e.path : e.message;
  console.error('No se pudo convertir: ' + motivo);
  process.exit(1);
});
