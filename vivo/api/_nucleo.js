// Lógica de la API del modo en vivo. No depende de Vercel ni de Neon: recibe una función
// `q(texto, params)` que ejecuta SQL en Postgres, así se puede probar con cualquier base.
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const LIMITES = {
  textoPregunta: 200,
  preguntasPorMinuto: 3,
  intentosPin: 5,
  ventanaPinMin: 5,
  intentosGlobales: 25,
  horasToken: 36,
  dispositivosPorIp: 60,
  textoPalabra: 32,
  encuestasPorCharla: 60,
};

// Las tablas se crean solas la primera vez: no hay que correr nada a mano.
const ESQUEMA = [
  `create table if not exists estado (
     id int primary key default 1 check (id = 1),
     charla text not null default '',
     titulo_charla text not null default '',
     definiciones jsonb not null default '{}',
     diapositiva int not null default 1,
     paso int not null default 0,
     pasos int not null default 0,
     total int not null default 0,
     titulo text not null default '',
     notas text not null default '',
     momento text not null default '',
     encuestas text[] not null default '{}',
     abierta boolean not null default false,
     recibe_preguntas boolean not null default true,
     indice jsonb not null default '[]',
     reloj_inicio timestamptz,
     latido timestamptz,
     ronda int not null default 0,
     actualizado timestamptz not null default now()
   )`,
  `insert into estado (id) values (1) on conflict (id) do nothing`,
  `create table if not exists votos (
     encuesta text not null, dispositivo text not null, opcion text not null, huella text,
     creado timestamptz not null default now(), primary key (encuesta, dispositivo)
   )`,
  `create index if not exists votos_huella on votos (encuesta, huella)`,
  `create table if not exists palabras (
     encuesta text not null, dispositivo text not null, texto text not null, clave text not null, huella text,
     oculta boolean not null default false, creado timestamptz not null default now(), primary key (encuesta, dispositivo)
   )`,
  `create table if not exists preguntas (
     id bigserial primary key, dispositivo text not null, texto text not null,
     estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'rechazada', 'respondida')),
     creado timestamptz not null default now()
   )`,
  `create index if not exists preguntas_estado on preguntas (estado, creado)`,
  `create table if not exists apoyos (
     pregunta_id bigint not null references preguntas (id) on delete cascade, dispositivo text not null,
     primary key (pregunta_id, dispositivo)
   )`,
  `create table if not exists comandos (seq bigserial primary key, tipo text not null, valor jsonb, creado timestamptz not null default now())`,
  `create table if not exists intentos_pin (huella text not null, creado timestamptz not null default now())`,
  `create index if not exists intentos_pin_creado on intentos_pin (creado)`,
];

const NO_VA = new Set(['boludo', 'boluda', 'pelotudo', 'pelotuda', 'puto', 'puta', 'mierda', 'concha', 'pija', 'verga', 'culo', 'forro', 'forra', 'trolo', 'nazi', 'hitler', 'idiota', 'imbecil', 'pene', 'sexo', 'teta', 'tetas', 'tarado', 'mogolico', 'orto']);
const sinAcentos = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

class ErrorApi extends Error {
  constructor(estado, mensaje) {
    super(mensaje);
    this.estado = estado;
  }
}

function esDispositivo(v) {
  return typeof v === 'string' && /^[a-zA-Z0-9-]{16,64}$/.test(v);
}

function iguales(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

function limpiarPalabra(texto) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim();
  if (t.length < 2) throw new ErrorApi(400, 'Escribí tu respuesta');
  if (t.length > LIMITES.textoPalabra) throw new ErrorApi(400, 'Probá con menos palabras');
  const clave = sinAcentos(t).toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  if (!clave || clave.split(' ').some((p) => NO_VA.has(p))) throw new ErrorApi(400, 'Probá con otra palabra');
  return { texto: t[0].toUpperCase() + t.slice(1), clave };
}

// Lo que manda la presentación se recorta y valida antes de guardarlo.
function limpiarDefiniciones(crudas) {
  const limpias = {};
  for (const [clave, d] of Object.entries(crudas && typeof crudas === 'object' ? crudas : {}).slice(0, LIMITES.encuestasPorCharla)) {
    if (!/^[a-z0-9-]{3,40}$/i.test(clave) || !d || typeof d !== 'object') continue;
    const tipo = d.tipo === 'texto' ? 'texto' : 'opciones';
    const opciones = tipo === 'texto' ? [] : (Array.isArray(d.opciones) ? d.opciones : []).slice(0, 10)
      .map((o) => ({ id: String(o?.id || ''), texto: String(o?.texto || '').slice(0, 160) }))
      .filter((o) => /^[A-Z0-9]{1,12}$/i.test(o.id) && o.texto);
    if (tipo === 'opciones' && opciones.length < 2) continue;
    limpias[clave] = { pregunta: String(d.pregunta || '').slice(0, 300), ayuda: String(d.ayuda || '').slice(0, 200), tipo, opciones };
  }
  return limpias;
}

export function crearManejador(q, entorno = {}) {
  const PIN = String(entorno.REMOTE_PIN || entorno.PIN || '').trim();
  const SECRETO = entorno.TOKEN_SECRET
    || (PIN && entorno.DATABASE_URL ? createHash('sha256').update(entorno.DATABASE_URL + '|' + PIN).digest('hex') : '');

  let lista = null;
  function preparar() {
    if (!lista) {
      lista = (async () => {
        try {
          await q('select (select count(*) from intentos_pin where false) as n, charla from estado where id = 1');
        } catch (e) {
          if (e.sinBase) throw e;
          for (const sentencia of ESQUEMA) await q(sentencia);
        }
      })().catch((e) => { lista = null; throw e; });
    }
    return lista;
  }

  const firmar = (cuerpo) => createHmac('sha256', SECRETO).update(cuerpo).digest('base64url');
  const huella = (ip) => createHmac('sha256', SECRETO || 'sin-secreto').update(ip).digest('hex').slice(0, 24);
  const ipCliente = (req) => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'desconocida';

  function crearToken() {
    const cuerpo = `${Date.now() + LIMITES.horasToken * 3600 * 1000}.${randomBytes(9).toString('base64url')}`;
    return `${cuerpo}.${firmar(cuerpo)}`;
  }

  function exigirToken(req) {
    const partes = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').split('.');
    if (partes.length !== 3 || !SECRETO) throw new ErrorApi(401, 'Sesión vencida');
    const cuerpo = `${partes[0]}.${partes[1]}`;
    if (!iguales(firmar(cuerpo), partes[2]) || Number(partes[0]) < Date.now()) throw new ErrorApi(401, 'Sesión vencida');
  }

  const publicasDe = (ids, defs) => ids.filter((id) => defs[id]).map((id) => ({ id, ...defs[id] }));

  async function conteos(ids, defs) {
    const validos = ids.filter((id) => defs[id] && defs[id].tipo !== 'texto');
    const salida = {};
    if (!validos.length) return salida;
    for (const id of validos) salida[id] = Object.fromEntries(defs[id].opciones.map((o) => [o.id, 0]));
    const filas = await q('select encuesta, opcion, count(*)::int as n from votos where encuesta = any($1) group by 1, 2', [validos]);
    for (const f of filas) if (salida[f.encuesta] && f.opcion in salida[f.encuesta]) salida[f.encuesta][f.opcion] = f.n;
    return salida;
  }

  const nube = (encuesta) => q(
    `select mode() within group (order by texto) as texto, clave, count(*)::int as n
       from palabras where encuesta = $1 and not oculta group by clave order by n desc, min(creado) limit 30`,
    [encuesta],
  );

  const preguntasVisibles = () => q(
    `select p.id::int as id, p.texto, p.estado, count(a.dispositivo)::int as apoyos
       from preguntas p left join apoyos a on a.pregunta_id = p.id
      where p.estado in ('aprobada', 'respondida')
      group by p.id
      order by (p.estado = 'respondida'), apoyos desc, p.id asc
      limit 40`,
  );

  const publicas = {
    async salud() {
      await q('select 1 as ok');
      return { ok: true, pin: Boolean(PIN) };
    },

    async estado() {
      const [e] = await q(
        `select charla, titulo_charla, definiciones, diapositiva, paso, pasos, total, titulo, momento, encuestas, abierta,
                recibe_preguntas, ronda, coalesce(latido > now() - interval '20 seconds', false) as en_vivo
           from estado where id = 1`,
      );
      return {
        charla: e.titulo_charla,
        diapositiva: e.diapositiva,
        paso: e.paso,
        pasos: e.pasos,
        total: e.total,
        titulo: e.titulo,
        momento: e.momento,
        ronda: e.ronda,
        enVivo: Boolean(e.en_vivo),
        abierta: e.abierta,
        recibePreguntas: e.recibe_preguntas,
        encuestas: publicasDe(e.encuestas, e.definiciones),
      };
    },

    async resultados(req) {
      const ids = String(req.query.e || '').split(',').filter(Boolean).slice(0, 8);
      const [e] = await q('select definiciones from estado where id = 1');
      return { conteos: await conteos(ids, e.definiciones) };
    },

    async palabras(req) {
      return { palabras: await nube(String(req.query.e || '')) };
    },

    async preguntas() {
      return { preguntas: await preguntasVisibles() };
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
      const [e] = await q('select encuestas, abierta, definiciones from estado where id = 1');
      const def = e.definiciones[encuesta];
      if (!def || def.tipo === 'texto' || !def.opciones.some((o) => o.id === opcion)) throw new ErrorApi(400, 'Opción inválida');
      if (!e.abierta || !e.encuestas.includes(encuesta)) throw new ErrorApi(409, 'La votación está cerrada');
      // Tope por conexión: alcanza para una sala entera en la misma red y frena a quien quiera inflar votos.
      const filas = await q(
        `with cuenta as (
           select count(*)::int as n from votos where encuesta = $1 and huella = $4 and dispositivo <> $2
         )
         insert into votos (encuesta, dispositivo, opcion, huella)
         select $1, $2, $3, $4 from cuenta where n < $5
         on conflict (encuesta, dispositivo) do update set opcion = excluded.opcion, creado = now()
         returning 1 as ok`,
        [encuesta, dispositivo, opcion, huella(ipCliente(req)), LIMITES.dispositivosPorIp],
      );
      if (!filas.length) throw new ErrorApi(429, 'Demasiados votos desde esta conexión');
      return { ok: true };
    },

    async palabra(req, cuerpo) {
      const { encuesta, dispositivo } = cuerpo;
      if (!esDispositivo(dispositivo)) throw new ErrorApi(400, 'Dispositivo inválido');
      const p = limpiarPalabra(cuerpo.texto);
      const [e] = await q('select encuestas, abierta, definiciones from estado where id = 1');
      if (e.definiciones[encuesta]?.tipo !== 'texto') throw new ErrorApi(400, 'Pregunta inválida');
      if (!e.abierta || !e.encuestas.includes(encuesta)) throw new ErrorApi(409, 'Ya está cerrado');
      const filas = await q(
        `with cuenta as (
           select count(*)::int as n from palabras where encuesta = $1 and huella = $5 and dispositivo <> $2
         )
         insert into palabras (encuesta, dispositivo, texto, clave, huella)
         select $1, $2, $3, $4, $5 from cuenta where n < $6
         on conflict (encuesta, dispositivo) do update set texto = excluded.texto, clave = excluded.clave, oculta = false, creado = now()
         returning 1 as ok`,
        [encuesta, dispositivo, p.texto, p.clave, huella(ipCliente(req)), LIMITES.dispositivosPorIp],
      );
      if (!filas.length) throw new ErrorApi(429, 'Demasiadas respuestas desde esta conexión');
      return { ok: true, texto: p.texto };
    },

    async preguntar(req, cuerpo) {
      const { texto, dispositivo } = cuerpo;
      if (!esDispositivo(dispositivo)) throw new ErrorApi(400, 'Dispositivo inválido');
      const limpio = String(texto || '').replace(/\s+/g, ' ').trim();
      if (limpio.length < 3) throw new ErrorApi(400, 'Escribí tu pregunta');
      if (limpio.length > LIMITES.textoPregunta) throw new ErrorApi(400, `Máximo ${LIMITES.textoPregunta} caracteres`);
      const [e] = await q('select recibe_preguntas from estado where id = 1');
      if (!e.recibe_preguntas) throw new ErrorApi(409, 'Las preguntas están cerradas');
      const [r] = await q(
        `select count(*)::int as n from preguntas where dispositivo = $1 and creado > now() - interval '1 minute'`,
        [dispositivo],
      );
      if (r.n >= LIMITES.preguntasPorMinuto) throw new ErrorApi(429, 'Esperá un minuto antes de mandar otra');
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
      await q('insert into apoyos (pregunta_id, dispositivo) values ($1, $2) on conflict do nothing', [id, dispositivo]);
      return { ok: true };
    },

    async login(req, cuerpo) {
      if (!PIN || !SECRETO) throw new ErrorApi(500, 'Falta configurar el PIN del presentador (variable REMOTE_PIN)');
      const h = huella(ipCliente(req));
      await q(`delete from intentos_pin where creado < now() - interval '1 hour'`);
      const [c] = await q(
        `select count(*) filter (where huella = $1)::int as propios, count(*)::int as todos
           from intentos_pin where creado > now() - ($2 || ' minutes')::interval`,
        [h, String(LIMITES.ventanaPinMin)],
      );
      if (c.propios >= LIMITES.intentosPin || c.todos >= LIMITES.intentosGlobales) {
        throw new ErrorApi(429, `Demasiados intentos. Esperá ${LIMITES.ventanaPinMin} minutos.`);
      }
      if (!iguales(String(cuerpo.pin || ''), PIN)) {
        await q('insert into intentos_pin (huella) values ($1)', [h]);
        await espera(350);
        throw new ErrorApi(401, 'PIN incorrecto');
      }
      return { token: crearToken() };
    },

    // La presentación avisa qué votaciones trae. Si es otra charla, se cierran las anteriores.
    async definir(req, cuerpo) {
      exigirToken(req);
      const id = String(cuerpo.id || '');
      if (!/^[a-z0-9]{4,16}$/i.test(id)) throw new ErrorApi(400, 'Presentación inválida');
      await q(
        `update estado set
            encuestas = case when charla = $1 then encuestas else '{}' end,
            charla = $1, titulo_charla = $2, definiciones = $3::jsonb, actualizado = now()
          where id = 1`,
        [id, String(cuerpo.titulo || '').slice(0, 160), JSON.stringify(limpiarDefiniciones(cuerpo.encuestas))],
      );
      return { ok: true };
    },

    async comando(req, cuerpo) {
      exigirToken(req);
      if (!['siguiente', 'anterior', 'ir', 'blanco', 'reloj', 'tomar'].includes(cuerpo.tipo)) throw new ErrorApi(400, 'Comando inválido');
      const valor = cuerpo.valor === undefined ? null : JSON.stringify(cuerpo.valor);
      const [c] = await q('insert into comandos (tipo, valor) values ($1, $2::jsonb) returning seq', [cuerpo.tipo, valor]);
      return { seq: Number(c.seq) };
    },

    async presentador(req, cuerpo) {
      exigirToken(req);
      const [e] = await q('select definiciones from estado where id = 1');
      const encuestas = (Array.isArray(cuerpo.encuestas) ? cuerpo.encuestas : []).filter((id) => e.definiciones[id]).slice(0, 4);
      await q(
        `update estado set
            diapositiva = $1, paso = $2, pasos = $3, total = $4, titulo = $5, notas = $6,
            abierta = case
              when cardinality($7::text[]) = 0 then false
              when $7::text[] <> encuestas then true
              else abierta end,
            encuestas = $7::text[], momento = $8,
            indice = coalesce($9::jsonb, indice),
            reloj_inicio = coalesce($10::timestamptz, reloj_inicio),
            latido = now(), actualizado = now()
          where id = 1`,
        [
          Number(cuerpo.diapositiva) || 1,
          Number(cuerpo.paso) || 0,
          Number(cuerpo.pasos) || 0,
          Number(cuerpo.total) || 0,
          String(cuerpo.titulo || '').slice(0, 160),
          String(cuerpo.notas || '').slice(0, 4000),
          encuestas,
          String(cuerpo.momento || '').slice(0, 20),
          Array.isArray(cuerpo.indice) ? JSON.stringify(cuerpo.indice.slice(0, 300)) : null,
          cuerpo.relojInicio || null,
        ],
      );
      return { ok: true };
    },

    async votacion(req, cuerpo) {
      exigirToken(req);
      await q('update estado set abierta = $1, actualizado = now() where id = 1', [Boolean(cuerpo.abierta)]);
      return { ok: true };
    },

    async recepcion(req, cuerpo) {
      exigirToken(req);
      await q('update estado set recibe_preguntas = $1, actualizado = now() where id = 1', [Boolean(cuerpo.recibe)]);
      return { ok: true };
    },

    async moderar(req, cuerpo) {
      exigirToken(req);
      const id = Number(cuerpo.id);
      if (!['aprobada', 'rechazada', 'respondida'].includes(cuerpo.estado) || !id) throw new ErrorApi(400, 'Datos inválidos');
      await q('update preguntas set estado = $1 where id = $2', [cuerpo.estado, id]);
      return { ok: true };
    },

    async ocultar(req, cuerpo) {
      exigirToken(req);
      await q('update palabras set oculta = true where encuesta = $1 and clave = $2', [String(cuerpo.encuesta || ''), String(cuerpo.clave || '')]);
      return { ok: true };
    },

    async limpiar(req, cuerpo) {
      exigirToken(req);
      const id = String(cuerpo.encuesta || '');
      if (!/^[a-z0-9-]{3,40}$/i.test(id)) throw new ErrorApi(400, 'Pregunta inválida');
      await q('delete from votos where encuesta = $1', [id]);
      await q('delete from palabras where encuesta = $1', [id]);
      await q('update estado set ronda = ronda + 1, actualizado = now() where id = 1');
      await q(`insert into comandos (tipo, valor) values ('limpio', $1::jsonb)`, [JSON.stringify(id)]);
      return { ok: true };
    },

    async reiniciar(req) {
      exigirToken(req);
      // Los comandos se borran sin reiniciar su numeración: la presentación sigue escuchando desde el último.
      await q('truncate votos, apoyos, preguntas, palabras restart identity cascade');
      await q('delete from comandos');
      await q('update estado set abierta = true, reloj_inicio = null, ronda = ronda + 1, actualizado = now() where id = 1');
      await q(`insert into comandos (tipo, valor) values ('limpio', 'null'::jsonb)`);
      return { ok: true };
    },
  };

  const privadasGet = {
    // Espera larga: responde apenas hay comandos nuevos, o a los 8 segundos.
    async sincro(req) {
      exigirToken(req);
      const desde = Number(req.query.desde) || 0;
      const hasta = Date.now() + (Number(entorno.ESPERA_SINCRO_MS) || 8000);
      do {
        const filas = await q('select seq, tipo, valor from comandos where seq > $1 order by seq limit 20', [desde]);
        if (filas.length) return { comandos: filas.map((f) => ({ ...f, seq: Number(f.seq) })) };
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
      const [e] = await q('select *, now() as ahora from estado where id = 1');
      const deTexto = e.encuestas.filter((id) => e.definiciones[id]?.tipo === 'texto');
      const [pendientes, aprobadas, resultados, personas, ...nubes] = await Promise.all([
        q(`select id::int as id, texto, creado from preguntas where estado = 'pendiente' order by id limit 30`),
        preguntasVisibles(),
        conteos(e.encuestas, e.definiciones),
        q('select count(*)::int as n from (select dispositivo from votos union select dispositivo from palabras) x'),
        ...deTexto.map(nube),
      ]);
      return {
        charla: e.titulo_charla,
        diapositiva: e.diapositiva,
        paso: e.paso,
        pasos: e.pasos,
        total: e.total,
        titulo: e.titulo,
        notas: e.notas,
        abierta: e.abierta,
        recibePreguntas: e.recibe_preguntas,
        encuestas: publicasDe(e.encuestas, e.definiciones),
        indice: e.indice,
        relojInicio: e.reloj_inicio,
        latido: e.latido,
        ahora: e.ahora,
        pendientes,
        aprobadas,
        conteos: resultados,
        palabras: Object.fromEntries(deTexto.map((id, i) => [id, nubes[i]])),
        participantes: personas[0].n,
      };
    },
  };

  function responder(res, estado, datos, cache) {
    res.statusCode = estado;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', cache === 'rapido' ? 'public, s-maxage=1' : cache ? 'public, s-maxage=1, stale-while-revalidate=2' : 'no-store');
    res.end(JSON.stringify(datos));
  }

  return async function manejar(req, res) {
    // La presentación se abre como archivo local, así que la API acepta cualquier origen.
    // Lo privado se protege con el token del PIN, no con el origen.
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
      await preparar();
      if (req.method === 'GET' && Object.hasOwn(publicas, accion)) {
        const cache = accion === 'salud' ? false : accion === 'estado' ? 'rapido' : true;
        return responder(res, 200, await publicas[accion](req), cache);
      }
      if (req.method === 'GET' && Object.hasOwn(privadasGet, accion)) return responder(res, 200, await privadasGet[accion](req));
      if (req.method === 'POST' && Object.hasOwn(acciones, accion)) {
        const cuerpo = req.body && typeof req.body === 'object' ? req.body : {};
        return responder(res, 200, await acciones[accion](req, cuerpo));
      }
      return responder(res, 404, { error: 'No encontrado' });
    } catch (e) {
      if (e instanceof ErrorApi) return responder(res, e.estado, { error: e.message });
      if (e.sinBase) return responder(res, 500, { error: 'Falta conectar la base de datos: agregá Neon desde Storage en Vercel y volvé a desplegar.' });
      console.error('api', accion, e?.message);
      return responder(res, 500, { error: 'Error del servidor' });
    }
  };
}
