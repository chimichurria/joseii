// Prueba la API del modo en vivo de punta a punta contra un Postgres real en memoria (PGlite).
//   npm install && npm run probar:vivo
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { crearManejador } from '../vivo/api/_nucleo.js';

const db = new PGlite();
const q = async (texto, params = []) => (await db.query(texto, params)).rows;
const manejar = crearManejador(q, { REMOTE_PIN: '4821', TOKEN_SECRET: 'secreto-de-prueba', ESPERA_SINCRO_MS: 300 });

let token = '';
async function llamar(accion, { cuerpo, consulta = {}, conToken = false, ip = '10.0.0.1' } = {}) {
  const req = {
    method: cuerpo ? 'POST' : 'GET',
    query: { accion, ...consulta },
    body: cuerpo,
    headers: { 'x-forwarded-for': ip, ...(conToken ? { authorization: 'Bearer ' + token } : {}) },
  };
  const res = { statusCode: 0, cabeceras: {}, setHeader(k, v) { this.cabeceras[k] = v; }, end(t) { this.texto = t; } };
  await manejar(req, res);
  return { estado: res.statusCode, datos: res.texto ? JSON.parse(res.texto) : null };
}

const D1 = 'dispositivo-de-prueba-0001';
const D2 = 'dispositivo-de-prueba-0002';
const VOTO = 'abc123-3';
const NUBE = 'abc123-2';
let pasos = 0;
const paso = (nombre) => { pasos++; console.log('  ok · ' + nombre); };

let r = await llamar('salud');
assert.deepEqual(r, { estado: 200, datos: { ok: true, pin: true } });
paso('las tablas se crean solas');

r = await llamar('presentador', { cuerpo: { diapositiva: 2 } });
assert.equal(r.estado, 401);
r = await llamar('login', { cuerpo: { pin: '0000' } });
assert.equal(r.estado, 401);
r = await llamar('login', { cuerpo: { pin: '4821' } });
assert.equal(r.estado, 200);
token = r.datos.token;
paso('sin PIN no se entra; con PIN se obtiene el token');

r = await llamar('definir', { conToken: true, cuerpo: { id: 'abc123', titulo: 'Charla de prueba', encuestas: {
  [VOTO]: { pregunta: '¿Mate o café?', tipo: 'opciones', opciones: [{ id: 'A', texto: 'Mate' }, { id: 'B', texto: 'Café' }] },
  [NUBE]: { pregunta: '¿De dónde venís?', tipo: 'texto', opciones: [] },
  'mala clave!': { pregunta: 'x', tipo: 'opciones', opciones: [] },
} } });
assert.equal(r.estado, 200);
r = await llamar('presentador', { conToken: true, cuerpo: { charla: 'abc123', diapositiva: 3, total: 9, titulo: '¿Mate o café?', notas: 'nota privada', encuestas: [VOTO, 'inexistente'], indice: [{ n: 1, titulo: 'Portada' }] } });
assert.equal(r.estado, 200);
r = await llamar('estado');
assert.equal(r.datos.charla, 'Charla de prueba');
assert.equal(r.datos.enVivo, true);
assert.equal(r.datos.abierta, true);
assert.deepEqual(r.datos.encuestas.map((e) => e.id), [VOTO]);
assert.equal(r.datos.encuestas[0].opciones.length, 2);
assert.equal('notas' in r.datos, false);
paso('la presentación define sus votaciones y la sala ve solo la activa, sin las notas');

assert.equal((await llamar('votar', { cuerpo: { encuesta: VOTO, opcion: 'A', dispositivo: D1 } })).estado, 200);
assert.equal((await llamar('votar', { cuerpo: { encuesta: VOTO, opcion: 'B', dispositivo: D2 } })).estado, 200);
assert.equal((await llamar('votar', { cuerpo: { encuesta: VOTO, opcion: 'B', dispositivo: D1 } })).estado, 200);
assert.equal((await llamar('votar', { cuerpo: { encuesta: VOTO, opcion: 'Z', dispositivo: D1 } })).estado, 400);
assert.equal((await llamar('votar', { cuerpo: { encuesta: VOTO, opcion: 'A', dispositivo: 'corto' } })).estado, 400);
r = await llamar('resultados', { consulta: { e: VOTO } });
assert.deepEqual(r.datos.conteos[VOTO], { A: 0, B: 2 });
paso('un voto por dispositivo, se puede cambiar, y las opciones inválidas se rechazan');

await llamar('votacion', { conToken: true, cuerpo: { abierta: false } });
assert.equal((await llamar('votar', { cuerpo: { encuesta: VOTO, opcion: 'A', dispositivo: D2 } })).estado, 409);
paso('con la votación cerrada no entran votos');

await llamar('presentador', { conToken: true, cuerpo: { diapositiva: 2, total: 9, titulo: '¿De dónde venís?', encuestas: [NUBE] } });
assert.equal((await llamar('palabra', { cuerpo: { encuesta: NUBE, texto: 'Córdoba', dispositivo: D1 } })).estado, 200);
assert.equal((await llamar('palabra', { cuerpo: { encuesta: NUBE, texto: '  cordoba ', dispositivo: D2 } })).estado, 200);
assert.equal((await llamar('palabra', { cuerpo: { encuesta: NUBE, texto: 'mierda', dispositivo: D2 } })).estado, 400);
assert.equal((await llamar('palabra', { cuerpo: { encuesta: VOTO, texto: 'Rosario', dispositivo: D2 } })).estado, 400);
r = await llamar('palabras', { consulta: { e: NUBE } });
assert.equal(r.datos.palabras.length, 1);
assert.equal(r.datos.palabras[0].n, 2);
assert.equal(r.datos.palabras[0].clave, 'cordoba');
paso('la nube junta la misma palabra con y sin acentos y filtra insultos');

assert.equal((await llamar('preguntar', { cuerpo: { texto: '¿Esto funciona sin internet?', dispositivo: D1 } })).estado, 200);
assert.equal((await llamar('preguntas')).datos.preguntas.length, 0);
r = await llamar('panel', { conToken: true });
assert.equal(r.estado, 200);
assert.equal(r.datos.pendientes.length, 1);
assert.equal(r.datos.participantes, 2);
assert.equal(r.datos.palabras[NUBE][0].n, 2);
const idPregunta = r.datos.pendientes[0].id;
await llamar('moderar', { conToken: true, cuerpo: { id: idPregunta, estado: 'aprobada' } });
assert.equal((await llamar('apoyar', { cuerpo: { pregunta: idPregunta, dispositivo: D2 } })).estado, 200);
await llamar('apoyar', { cuerpo: { pregunta: idPregunta, dispositivo: D2 } });
r = await llamar('preguntas');
assert.equal(r.datos.preguntas[0].apoyos, 1);
assert.equal((await llamar('panel')).estado, 401);
paso('las preguntas no aparecen hasta que el presentador las aprueba; el apoyo cuenta una vez');

const antes = (await llamar('ultimo', { conToken: true })).datos.seq;
r = await llamar('comando', { conToken: true, cuerpo: { tipo: 'ir', valor: 5 } });
assert.equal(r.estado, 200);
assert.equal((await llamar('comando', { conToken: true, cuerpo: { tipo: 'borrar-todo' } })).estado, 400);
r = await llamar('sincro', { conToken: true, consulta: { desde: antes } });
assert.deepEqual(r.datos.comandos.map((c) => [c.tipo, c.valor]), [['ir', 5]]);
r = await llamar('sincro', { conToken: true, consulta: { desde: r.datos.comandos[0].seq } });
assert.deepEqual(r.datos.comandos, []);
paso('el control remoto manda comandos y la presentación los recibe una sola vez');

await llamar('limpiar', { conToken: true, cuerpo: { encuesta: NUBE } });
assert.equal((await llamar('palabras', { consulta: { e: NUBE } })).datos.palabras.length, 0);
assert.deepEqual((await llamar('resultados', { consulta: { e: VOTO } })).datos.conteos[VOTO], { A: 0, B: 2 });
assert.equal((await llamar('reiniciar', { conToken: true })).estado, 404); // solo acepta POST
assert.equal((await llamar('reiniciar', { conToken: true, cuerpo: {} })).estado, 200);
assert.deepEqual((await llamar('resultados', { consulta: { e: VOTO } })).datos.conteos[VOTO], { A: 0, B: 0 });
assert.deepEqual((await llamar('resumen')).datos, { personas: 0, votos: 0, preguntas: 0 });
paso('se puede limpiar una pregunta sola o todos los datos');

await llamar('definir', { conToken: true, cuerpo: { id: 'otra99', titulo: 'Otra charla', encuestas: {} } });
r = await llamar('estado');
assert.equal(r.datos.charla, 'Otra charla');
assert.deepEqual(r.datos.encuestas, []);
paso('al conectar otra presentación se cierran las votaciones de la anterior');

for (let i = 0; i < 5; i++) await llamar('login', { cuerpo: { pin: '1111' }, ip: '10.9.9.9' });
assert.equal((await llamar('login', { cuerpo: { pin: '4821' }, ip: '10.9.9.9' })).estado, 429);
assert.equal((await llamar('login', { cuerpo: { pin: '4821' }, ip: '10.0.0.7' })).estado, 200);
paso('cinco PIN errados bloquean esa conexión por unos minutos');

const sinPin = crearManejador(q, {});
const res = { setHeader() {}, end(t) { this.texto = t; } };
await sinPin({ method: 'POST', query: { accion: 'login' }, body: { pin: '' }, headers: {} }, res);
assert.equal(res.statusCode, 500);
paso('sin PIN configurado nadie puede entrar');

console.log('\nAPI en vivo: ' + pasos + ' pruebas pasaron.');
await db.close();
