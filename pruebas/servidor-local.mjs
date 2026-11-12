// Corre el modo en vivo completo en tu computadora, sin Vercel ni base de datos externa.
// Sirve para ensayar: la base vive en memoria y se pierde al cerrar.
//   npm install && npm run vivo:local
// Después, en la presentación: tecla C → dirección http://localhost:4321 → PIN 1234.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { crearManejador } from '../vivo/api/_nucleo.js';

const PUERTO = Number(process.env.PORT) || 4321;
const PIN = process.env.REMOTE_PIN || '1234';
const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'vivo');
const db = new PGlite();
const manejar = crearManejador(async (texto, params = []) => (await db.query(texto, params)).rows, { REMOTE_PIN: PIN, TOKEN_SECRET: 'solo-para-ensayar-en-local' });
const PAGINAS = { '/': 'index.html', '/control': 'control/index.html', '/control/': 'control/index.html' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const api = /^\/api\/([a-z]+)$/.exec(url.pathname);
  if (api) {
    let crudo = '';
    for await (const parte of req) crudo += parte;
    try { req.body = crudo ? JSON.parse(crudo) : undefined; } catch { req.body = undefined; }
    req.query = { ...Object.fromEntries(url.searchParams), accion: api[1] };
    return manejar(req, res);
  }
  const archivo = PAGINAS[url.pathname];
  if (!archivo) { res.statusCode = 404; return res.end('No encontrado'); }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(await readFile(path.join(raiz, archivo)));
}).listen(PUERTO, () => {
  console.log('Modo en vivo local en http://localhost:' + PUERTO);
  console.log('  Sala:    http://localhost:' + PUERTO + '/');
  console.log('  Control: http://localhost:' + PUERTO + '/control   (PIN ' + PIN + ')');
});
