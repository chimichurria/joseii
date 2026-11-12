#!/usr/bin/env node
// Arma index.html (el conversor que se abre en el navegador) a partir de src/.
// Corré `npm run construir` después de tocar cualquier archivo de src/.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const leer = (archivo) => readFile(new URL('./src/' + archivo, import.meta.url), 'utf8');

// Dentro de una etiqueta <script> no puede aparecer "</script", "<script" ni "<!--" tal cual.
const seguroEnScript = (js) => js.replace(/<\/script/gi, '<\\/script').replace(/<script/gi, '<\\script').replace(/<!--/g, '<\\!--');

export async function construirHtml() {
  const [plantilla, css, js, qr] = await Promise.all([leer('conversor.html'), leer('motor.css'), leer('motor.js'), leer('qr.mjs')]);
  const modulos = [];
  for (const archivo of ['zip.mjs', 'xml.mjs', 'pptx.mjs', 'armar.mjs']) {
    modulos.push('// ---- ' + archivo + ' ----\n' + (await leer(archivo)).replace(/^import .*;\n/gm, '').replace(/^export\s+/gm, ''));
  }
  const piezas = JSON.stringify({ css, js, qr }).replace(/</g, '\\u003c');
  return plantilla
    .replace('/*__PIEZAS__*/', () => piezas)
    .replace('/*__MODULOS__*/', () => seguroEnScript(modulos.join('\n')));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const html = await construirHtml();
  await writeFile(new URL('./index.html', import.meta.url), html);
  console.log('Listo: index.html (' + Math.round(html.length / 1024) + ' KB)');
}
