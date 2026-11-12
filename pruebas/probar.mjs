// Pruebas del conversor. No necesitan nada instalado: `npm run probar`.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { leerPptx } from '../src/pptx.mjs';
import { armarHtml } from '../src/armar.mjs';
import { qrMatriz, qrSvg } from '../src/qr.mjs';
import { leerXml, todos } from '../src/xml.mjs';
import { construirHtml } from '../construir.mjs';

const raiz = new URL('../', import.meta.url);
const leer = (f) => readFile(new URL(f, raiz), 'utf8');
const piezas = { css: await leer('src/motor.css'), js: await leer('src/motor.js'), qr: await leer('src/qr.mjs') };
let pasos = 0;
const paso = (nombre) => { pasos++; console.log('  ok · ' + nombre); };
const guiones = (html) => [...html.matchAll(/<script(?![^>]*application\/json)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

// --- XML ---
const x = leerXml('<?xml version="1.0"?><a:r xmlns:a="x"><!-- c --><a:t a="1 &amp; 2">Ñandú &lt;b&gt; &#225;</a:t><a:v/></a:r>');
assert.equal(todos(x, 'a:t')[0].t, 'Ñandú <b> á');
assert.equal(todos(x, 'a:t')[0].a.a, '1 & 2');
assert.equal(todos(x, 'a:v').length, 1);
paso('el lector de XML entiende entidades, comentarios y etiquetas vacías');

// --- QR ---
// Huellas calculadas con esta implementación después de compararla, módulo por módulo,
// con la biblioteca `qrcode` de Python en 32 casos (versiones 1 a 9).
const huellaQr = (t) => createHash('sha256').update(qrMatriz(t).m.map((f) => f.join('')).join('\n')).digest('hex').slice(0, 16);
assert.equal(qrMatriz('https://joseii.vercel.app').n, 25);
assert.equal(qrMatriz('a').n, 21);
assert.equal(qrMatriz('w'.repeat(180)).n, 53);
assert.throws(() => qrMatriz('w'.repeat(181)));
const fijas = { 'https://joseii.vercel.app': '3dd7f7f48af3f041', ['x'.repeat(100)]: '898a791db8daf879' };
for (const [texto, esperada] of Object.entries(fijas)) assert.equal(huellaQr(texto), esperada);
assert.match(qrSvg('hola'), /^<svg [^>]*viewBox="0 0 27 27"/);
paso('los códigos QR salen idénticos a los verificados');

// --- Conversión del ejemplo ---
const modelo = await leerPptx(await readFile(new URL('ejemplos/demo.pptx', raiz)), 'demo.pptx');
assert.equal(modelo.diapositivas.length, 13);
assert.equal(modelo.titulo, 'Cómo dar una charla que la sala no se olvide');
assert.equal(modelo.diapositivas[2].items.length, 4);
assert.equal(modelo.diapositivas[4].items.filter((i) => i.nivel === 0).length, 3);
assert.equal(modelo.diapositivas[8].tablas[0].length, 4);
assert.equal(modelo.diapositivas[9].imagenes.length, 1);
assert.match(modelo.diapositivas[9].imagenes[0].src, /^data:image\/png;base64,/);
assert.match(modelo.diapositivas[10].items[0].texto, /^No hace falta/);
assert.match(modelo.diapositivas[2].notas, /Dar un minuto/);
paso('lee títulos, viñetas con niveles, tablas, imágenes, cuadros sueltos y notas del .pptx');

const vivo = armarHtml(modelo, { vivo: true, api: 'https://ejemplo.vercel.app/', evento: 'Evento <b>' }, piezas);
assert.deepEqual(vivo.resumen, { diapositivas: 13, votaciones: 1, nubes: 1, preguntas: 1 });
assert.equal(vivo.config.api, 'https://ejemplo.vercel.app');
const ids = Object.keys(vivo.config.encuestas);
assert.equal(ids.length, 2);
assert.deepEqual(vivo.config.encuestas[ids.find((i) => vivo.config.encuestas[i].tipo === 'opciones')].opciones.map((o) => o.id), ['A', 'B', 'C', 'D']);
assert.equal((vivo.html.match(/<section class="slide/g) || []).length, 13);
assert.ok(vivo.html.includes('data-momento="preguntas"'));
assert.ok(vivo.html.includes('function qrSvg('));
assert.ok(!vivo.html.includes('VOTAR:') && !vivo.html.includes('NUBE:'));
assert.ok(vivo.html.includes('Evento &lt;b&gt;') && !vivo.html.includes('Evento <b>'));
assert.ok(vivo.html.includes('data-notes="[2 min] Dar un minuto'));
paso('con modo en vivo arma la votación, la nube y las preguntas, y escapa el texto');

const simple = armarHtml(modelo, { vivo: false, notas: false, pasos: false, colores: ['#0055AA', '#FFEE88'] }, piezas);
assert.equal(simple.config.vivo, false);
assert.deepEqual(simple.config.encuestas, {});
assert.ok(!simple.html.includes('function qrSvg(') && !simple.html.includes('id="cfg"'));
assert.ok(!simple.html.includes('data-notes=') && !simple.html.includes('data-steps='));
assert.ok(simple.html.includes('--c1:#0055AA'));
assert.ok(!simple.html.includes('--c2:#FFEE88'), 'un color demasiado claro se oscurece para que se lea');
assert.ok(simple.html.includes('¿Cuánto dura la atención de una sala?'));
paso('sin modo en vivo queda una presentación común, sin notas ni servidor, con colores propios');

assert.equal(armarHtml(modelo, { vivo: true }, piezas).config.id, vivo.config.id);
paso('la misma presentación genera siempre los mismos identificadores de votación');

for (const html of [vivo.html, simple.html]) for (const js of guiones(html)) new Function(js);
paso('el JavaScript de las presentaciones generadas no tiene errores de sintaxis');

// --- El conversor del navegador ---
const construido = await construirHtml();
assert.equal(await leer('index.html'), construido, 'index.html está desactualizado: corré `npm run construir`');
assert.equal(guiones(construido).length, 1);
for (const js of guiones(construido)) new Function(js);
assert.ok(!construido.includes('__MODULOS__') && !construido.includes('__PIEZAS__'));
paso('index.html está al día con src/ y su JavaScript es válido');

console.log('\nConversor: ' + pasos + ' pruebas pasaron.');
