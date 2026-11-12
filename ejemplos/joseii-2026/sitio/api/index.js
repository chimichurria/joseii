import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { ENCUESTAS, LIMITES } from './_config.js';
import { NOTAS } from './_notas.js';

const sql = neon(process.env.DATABASE_URL);
const SECRETO = process.env.TOKEN_SECRET || '';
const PIN = process.env.REMOTE_PIN || '';

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const q = (texto, params = []) => sql.query(texto, params);

class ErrorApi extends Error {
  constructor(estado, mensaje) {
    super(mensaje);
    this.estado = estado;
  }
}

function esDispositivo(v) {
  return typeof v === 'string' && /^[a-zA-Z0-9-]{16,64}$/.test(v);
}

function ipCliente(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || req.socket?.remoteAddress || 'desconocida';
}

function huella(ip) {
  return createHmac('sha256', SECRETO).update(ip).digest('hex').slice(0, 24);
}

function firmar(cuerpo) {
  return createHmac('sha256', SECRETO).update(cuerpo).digest('base64url');
}

function crearToken() {
  const vence = Date.now() + LIMITES.horasToken * 3600 * 1000;
  const cuerpo = `${vence}.${randomBytes(9).toString('base64url')}`;
  return `${cuerpo}.${firmar(cuerpo)}`;
}

function iguales(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

function exigirToken(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const partes = token.split('.');
  if (partes.length !== 3 || !SECRETO) throw new ErrorApi(401, 'Sesión vencida');
  const cuerpo = `${partes[0]}.${partes[1]}`;
  if (!iguales(firmar(cuerpo), partes[2]) || Number(partes[0]) < Date.now()) {
    throw new ErrorApi(401, 'Sesión vencida');
  }
}

const NO_VA = new Set(['boludo', 'boluda', 'pelotudo', 'pelotuda', 'puto', 'puta', 'mierda', 'concha', 'pija', 'verga', 'culo', 'forro', 'forra', 'trolo', 'nazi', 'hitler', 'idiota', 'imbecil', 'pene', 'sexo', 'teta', 'tetas', 'gil', 'tarado', 'mogolico', 'orto']);
const sinAcentos = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function limpiarPalabra(texto) {
  let t = String(texto || '').replace(/\s+/g, ' ').trim();
  const corto = t.replace(/^(ing\.?|ingenier[ií]a|lic\.?|licenciatura|tecnicatura|tec\.?)\s+((en|de)\s+)?/i, '');
  if (corto.length >= 3) t = corto;
  if (t.length < 2) throw new ErrorApi(400, 'Escribí tu carrera');
  if (t.length > LIMITES.textoPalabra) throw new ErrorApi(400, 'Probá con menos palabras');
  const clave = sinAcentos(t).toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  if (!clave || clave.split(' ').some((p) => NO_VA.has(p))) throw new ErrorApi(400, 'Probá con otra palabra');
  return { texto: t[0].toUpperCase() + t.slice(1), clave };
}

async function nube() {
  const filas = await q(
    `select mode() within group (order by texto) as texto, clave, count(*)::int as n
       from palabras where not oculta group by clave order by n desc, min(creado) limit 30`,
  );
  return filas;
}

function encuestasPublicas(ids) {
  return ids
    .filter((id) => ENCUESTAS[id])
    .map((id) => ({ id, ...ENCUESTAS[id] }));
}

async function conteos(ids) {
  const validos = ids.filter((id) => ENCUESTAS[id]);
  if (!validos.length) return {};
  const filas = await q(
    'select encuesta, opcion, count(*)::int as n from votos where encuesta = any($1) group by 1, 2',
    [validos],
  );
  const salida = {};
  for (const id of validos) {
    salida[id] = Object.fromEntries(ENCUESTAS[id].opciones.map((o) => [o.id, 0]));
  }
  for (const f of filas) {
    if (salida[f.encuesta] && f.opcion in salida[f.encuesta]) salida[f.encuesta][f.opcion] = f.n;
  }
  return salida;
}

async function preguntasAprobadas() {
  return q(
    `select p.id, p.texto, p.estado, count(a.dispositivo)::int as apoyos
       from preguntas p left join apoyos a on a.pregunta_id = p.id
      where p.estado in ('aprobada', 'respondida')
      group by p.id
      order by (p.estado = 'respondida'), apoyos desc, p.id asc
      limit 40`,
  );
}

const publicas = {
  async estado() {
    const [e] = await q(
      `select diapositiva, paso, pasos, total, titulo, encuestas, abierta, recibe_preguntas, ronda,
              latido > now() - interval '20 seconds' as en_vivo,
              (select version from app_demo where id = 1) as app
         from estado where id = 1`,
    );
    return {
      diapositiva: e.diapositiva,
      paso: e.paso,
      pasos: e.pasos,
      total: e.total,
      titulo: e.titulo,
      ronda: e.ronda,
      enVivo: Boolean(e.en_vivo),
      app: e.app || 0,
      abierta: e.abierta,
      recibePreguntas: e.recibe_preguntas,
      encuestas: encuestasPublicas(e.encuestas),
    };
  },

  async resultados(req) {
    const ids = String(req.query.e || '').split(',').filter(Boolean).slice(0, 8);
    return { conteos: await conteos(ids) };
  },

  async preguntas() {
    return { preguntas: await preguntasAprobadas() };
  },

  async palabras() {
    return { palabras: await nube() };
  },

  async resumen() {
    const [r] = await q(
      `select (select count(*) from (select dispositivo from votos union select dispositivo from palabras) x)::int as personas,
              (select count(*) from votos)::int as votos,
              (select count(*) from preguntas where estado <> 'rechazada')::int as preguntas`,
    );
    return r;
  },
};

const acciones = {
  async votar(req, cuerpo) {
    const { encuesta, opcion, dispositivo } = cuerpo;
    if (!esDispositivo(dispositivo)) throw new ErrorApi(400, 'Dispositivo inválido');
    const def = ENCUESTAS[encuesta];
    if (!def || !def.opciones.some((o) => o.id === opcion)) {
      throw new ErrorApi(400, 'Opción inválida');
    }
    const [e] = await q('select encuestas, abierta from estado where id = 1');
    if (!e.abierta || !e.encuestas.includes(encuesta)) {
      throw new ErrorApi(409, 'La votación está cerrada');
    }
    // Tope por conexion en la base: alcanza para una sala entera en la misma red.
    const filas = await q(
      `with cuenta as (
         select count(*)::int as n from votos
          where encuesta = $1 and huella = $4 and dispositivo <> $2
       )
       insert into votos (encuesta, dispositivo, opcion, huella)
       select $1, $2, $3, $4 from cuenta where n < $5
       on conflict (encuesta, dispositivo)
       do update set opcion = excluded.opcion, creado = now()
       returning 1 as ok`,
      [encuesta, dispositivo, opcion, huella(ipCliente(req)), LIMITES.dispositivosPorIp],
    );
    if (!filas.length) throw new ErrorApi(429, 'Demasiados votos desde esta conexión');
    return { ok: true };
  },

  async palabra(req, cuerpo) {
    const { dispositivo } = cuerpo;
    if (!esDispositivo(dispositivo)) throw new ErrorApi(400, 'Dispositivo inválido');
    const p = limpiarPalabra(cuerpo.texto);
    const [e] = await q('select encuestas, abierta from estado where id = 1');
    if (!e.abierta || !e.encuestas.includes('carrera')) throw new ErrorApi(409, 'Ya está cerrado');
    const filas = await q(
      `with cuenta as (
         select count(*)::int as n from palabras where huella = $4 and dispositivo <> $1
       )
       insert into palabras (dispositivo, texto, clave, huella)
       select $1, $2, $3, $4 from cuenta where n < $5
       on conflict (dispositivo)
       do update set texto = excluded.texto, clave = excluded.clave, creado = now()
       returning 1 as ok`,
      [dispositivo, p.texto, p.clave, huella(ipCliente(req)), LIMITES.dispositivosPorIp],
    );
    if (!filas.length) throw new ErrorApi(429, 'Demasiadas respuestas desde esta conexión');
    return { ok: true, texto: p.texto };
  },

  async ocultar(req, cuerpo) {
    exigirToken(req);
    await q('update palabras set oculta = true where clave = $1', [String(cuerpo.clave || '')]);
    return { ok: true };
  },

  async preguntar(req, cuerpo) {
    const { texto, dispositivo } = cuerpo;
    if (!esDispositivo(dispositivo)) throw new ErrorApi(400, 'Dispositivo inválido');
    const limpio = String(texto || '').replace(/\s+/g, ' ').trim();
    if (limpio.length < 3) throw new ErrorApi(400, 'Escribí tu pregunta');
    if (limpio.length > LIMITES.textoPregunta) {
      throw new ErrorApi(400, `Máximo ${LIMITES.textoPregunta} caracteres`);
    }
    const [e] = await q('select recibe_preguntas from estado where id = 1');
    if (!e.recibe_preguntas) throw new ErrorApi(409, 'Las preguntas están cerradas');
    const [r] = await q(
      `select count(*)::int as n from preguntas
        where dispositivo = $1 and creado > now() - interval '1 minute'`,
      [dispositivo],
    );
    if (r.n >= LIMITES.preguntasPorMinuto) {
      throw new ErrorApi(429, 'Esperá un minuto antes de mandar otra');
    }
    await q('insert into preguntas (dispositivo, texto) values ($1, $2)', [dispositivo, limpio]);
    return { ok: true };
  },

  async apoyar(req, cuerpo) {
    const { pregunta, dispositivo } = cuerpo;
    if (!esDispositivo(dispositivo)) throw new ErrorApi(400, 'Dispositivo inválido');
    const id = Number(pregunta);
    if (!Number.isInteger(id) || id < 1) throw new ErrorApi(400, 'Pregunta inválida');
    const [p] = await q(`select 1 as ok from preguntas where id = $1 and estado = 'aprobada'`, [id]);
    if (!p) throw new ErrorApi(404, 'Pregunta no encontrada');
    await q(
      'insert into apoyos (pregunta_id, dispositivo) values ($1, $2) on conflict do nothing',
      [id, dispositivo],
    );
    return { ok: true };
  },

  async login(req, cuerpo) {
    if (!PIN || !SECRETO) throw new ErrorApi(500, 'Falta configurar el PIN');
    const h = huella(ipCliente(req));
    await q(`delete from intentos_pin where creado < now() - interval '1 hour'`);
    const [c] = await q(
      `select count(*) filter (where huella = $1)::int as propios, count(*)::int as todos
         from intentos_pin where creado > now() - ($2 || ' minutes')::interval`,
      [h, String(LIMITES.ventanaPinMin)],
    );
    if (c.propios >= LIMITES.intentosPin || c.todos >= LIMITES.intentosGlobales) {
      throw new ErrorApi(429, 'Demasiados intentos. Esperá 5 minutos.');
    }
    if (!iguales(String(cuerpo.pin || ''), PIN)) {
      await q('insert into intentos_pin (huella) values ($1)', [h]);
      await espera(350);
      throw new ErrorApi(401, 'PIN incorrecto');
    }
    return { token: crearToken() };
  },

  async comando(req, cuerpo) {
    exigirToken(req);
    const tipos = ['siguiente', 'anterior', 'ir', 'blanco', 'reloj', 'tomar'];
    if (!tipos.includes(cuerpo.tipo)) throw new ErrorApi(400, 'Comando inválido');
    const valor = cuerpo.valor === undefined ? null : JSON.stringify(cuerpo.valor);
    const [c] = await q('insert into comandos (tipo, valor) values ($1, $2) returning seq', [
      cuerpo.tipo,
      valor,
    ]);
    return { seq: Number(c.seq) };
  },

  async presentador(req, cuerpo) {
    exigirToken(req);
    const encuestas = (Array.isArray(cuerpo.encuestas) ? cuerpo.encuestas : [])
      .filter((id) => ENCUESTAS[id])
      .slice(0, 4);
    await q(
      `update estado set
          diapositiva = $1, paso = $2, pasos = $3, total = $4, titulo = $5, notas = $6,
          abierta = case
            when cardinality($7::text[]) = 0 then false
            when $7::text[] <> encuestas then true
            else abierta end,
          encuestas = $7, minuto_plan = $8,
          indice = coalesce($9::jsonb, indice),
          reloj_inicio = coalesce($10::timestamptz, reloj_inicio),
          latido = now(), actualizado = now()
        where id = 1`,
      [
        Number(cuerpo.diapositiva) || 1,
        Number(cuerpo.paso) || 0,
        Number(cuerpo.pasos) || 0,
        Number(cuerpo.total) || 22,
        String(cuerpo.titulo || '').slice(0, 160),
        String(cuerpo.notas || '').slice(0, 4000),
        encuestas,
        Number(cuerpo.minutoPlan) || 0,
        cuerpo.indice ? JSON.stringify(cuerpo.indice) : null,
        cuerpo.relojInicio || null,
      ],
    );
    return { ok: true };
  },

  async publicar(req, cuerpo) {
    exigirToken(req);
    const html = String(cuerpo.html || '');
    if (html.trim().length < 20) throw new ErrorApi(400, 'El archivo está vacío');
    if (Buffer.byteLength(html) > LIMITES.bytesApp) throw new ErrorApi(413, 'El archivo es demasiado grande');
    const [r] = await q(
      `insert into app_demo (id, html, version) values (1, $1, 1)
       on conflict (id) do update
         set html = excluded.html, version = app_demo.version + 1, creado = now()
       returning version`,
      [html],
    );
    return { version: r.version };
  },

  async votacion(req, cuerpo) {
    exigirToken(req);
    await q('update estado set abierta = $1, actualizado = now() where id = 1', [
      Boolean(cuerpo.abierta),
    ]);
    return { ok: true };
  },

  async recepcion(req, cuerpo) {
    exigirToken(req);
    await q('update estado set recibe_preguntas = $1, actualizado = now() where id = 1', [
      Boolean(cuerpo.recibe),
    ]);
    return { ok: true };
  },

  async moderar(req, cuerpo) {
    exigirToken(req);
    const id = Number(cuerpo.id);
    if (!['aprobada', 'rechazada', 'respondida'].includes(cuerpo.estado) || !id) {
      throw new ErrorApi(400, 'Datos inválidos');
    }
    await q('update preguntas set estado = $1 where id = $2', [cuerpo.estado, id]);
    return { ok: true };
  },

  async reiniciar(req) {
    exigirToken(req);
    // Los comandos se borran sin reiniciar su numeracion: la presentacion sigue escuchando desde el ultimo.
    await q('truncate votos, apoyos, preguntas, app_demo, palabras restart identity cascade');
    await q('delete from comandos');
    await q(
      `update estado set
          abierta = true,
          encuestas = case when latido > now() - interval '20 seconds' then encuestas else '{carrera}' end,
          reloj_inicio = null, ronda = ronda + 1, actualizado = now()
        where id = 1`,
    );
    await q(`insert into comandos (tipo, valor) values ('limpio', 'null')`);
    return { ok: true };
  },

  async limpiar(req, cuerpo) {
    exigirToken(req);
    const id = String(cuerpo.encuesta || '');
    if (!ENCUESTAS[id]) throw new ErrorApi(400, 'Pregunta inválida');
    if (id === 'carrera') await q('delete from palabras');
    else await q('delete from votos where encuesta = $1', [id]);
    await q('update estado set ronda = ronda + 1, actualizado = now() where id = 1');
    await q(`insert into comandos (tipo, valor) values ('limpio', $1)`, [JSON.stringify(id)]);
    return { ok: true };
  },
};

const privadasGet = {
  // Espera larga: responde apenas hay comandos nuevos, o a los 8 segundos.
  async sincro(req) {
    exigirToken(req);
    const desde = Number(req.query.desde) || 0;
    const hasta = Date.now() + 8000;
    do {
      const filas = await q(
        'select seq, tipo, valor from comandos where seq > $1 order by seq limit 20',
        [desde],
      );
      if (filas.length) {
        return { comandos: filas.map((f) => ({ ...f, seq: Number(f.seq) })) };
      }
      await espera(140);
    } while (Date.now() < hasta);
    return { comandos: [] };
  },

  async ultimo(req) {
    exigirToken(req);
    const [f] = await q('select coalesce(max(seq), 0) as seq from comandos');
    return { seq: Number(f.seq) };
  },

  async panel(req) {
    exigirToken(req);
    const [e] = await q('select * from estado where id = 1');
    const [cola, aprobadas, resultados, personas, palabras] = await Promise.all([
      q(`select id, texto, creado from preguntas where estado = 'pendiente' order by id limit 30`),
      preguntasAprobadas(),
      conteos(e.encuestas),
      q('select count(distinct dispositivo)::int as n from votos'),
      nube(),
    ]);
    return {
      diapositiva: e.diapositiva,
      paso: e.paso,
      pasos: e.pasos,
      total: e.total,
      titulo: e.titulo,
      notas: e.notas || NOTAS[e.diapositiva - 1] || '',
      palabras,
      abierta: e.abierta,
      recibePreguntas: e.recibe_preguntas,
      encuestas: encuestasPublicas(e.encuestas),
      indice: e.indice,
      minutoPlan: e.minuto_plan,
      relojInicio: e.reloj_inicio,
      latido: e.latido,
      pendientes: cola,
      aprobadas,
      conteos: resultados,
      participantes: personas[0].n,
      ahora: new Date().toISOString(),
    };
  },
};

function responder(res, estado, datos, cache) {
  res.statusCode = estado;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache === 'rapido' ? 'public, s-maxage=1' : cache ? 'public, s-maxage=1, stale-while-revalidate=2' : 'no-store');
  res.end(JSON.stringify(datos));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const accion = String(req.query.accion || '');
  try {
    // La app generada en vivo se sirve aislada: sin acceso al sitio ni a sus datos.
    if (req.method === 'GET' && accion === 'app') {
      const [a] = await q('select html from app_demo where id = 1');
      if (!a) return responder(res, 404, { error: 'Todavía no hay app' });
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Security-Policy', "sandbox allow-scripts allow-forms; default-src 'self' 'unsafe-inline' data:");
      return res.end(a.html);
    }
    if (req.method === 'GET' && Object.hasOwn(publicas, accion)) {
      return responder(res, 200, await publicas[accion](req), accion === 'estado' ? 'rapido' : true);
    }
    if (req.method === 'GET' && Object.hasOwn(privadasGet, accion)) {
      return responder(res, 200, await privadasGet[accion](req));
    }
    if (req.method === 'POST' && Object.hasOwn(acciones, accion)) {
      const cuerpo = req.body && typeof req.body === 'object' ? req.body : {};
      return responder(res, 200, await acciones[accion](req, cuerpo));
    }
    return responder(res, 404, { error: 'No encontrado' });
  } catch (e) {
    if (e instanceof ErrorApi) return responder(res, e.estado, { error: e.message });
    console.error('api', accion, e?.message);
    return responder(res, 500, { error: 'Error del servidor' });
  }
}
