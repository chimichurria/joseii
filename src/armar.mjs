// Arma la presentación HTML (un solo archivo) a partir del contenido leído del .pptx.
import { escaparHtml } from './pptx.mjs';

const RE_VOTO = /^\s*(votar|voto|votaci[oó]n|encuesta|poll|vote)\s*[:：]\s*/i;
const RE_NUBE = /^\s*(nube|palabras|cloud|wordcloud)\s*[:：]\s*/i;
const RE_PREGUNTAS = /^\s*(preguntas\s*[:：].*|[¿¡]?\s*(preguntas( y respuestas)?|consultas|dudas|q\s*&\s*a|questions)\s*[?!]*)\s*$/i;
const RE_NUMERO = /^([^\d]{0,4})(\d[\d.,]*)(\s?[^\d\s].{0,7})?$/;
const LETRAS = 'ABCDEFGHIJ';

function huella(t) {
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
  return h.toString(36).padStart(6, '0').slice(-6);
}

function rgbDe(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const v = parseInt(m[1], 16);
  let c = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  // Un color muy claro no se lee sobre blanco: se oscurece hasta que tenga contraste.
  const luz = (x) => (0.2126 * x[0] + 0.7152 * x[1] + 0.0722 * x[2]) / 255;
  while (luz(c) > 0.62) c = c.map((x) => Math.round(x * 0.88));
  return c;
}
const aHex = (c) => '#' + c.map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();

// Título con una parte destacada, como en la charla original: las negritas del PowerPoint mandan;
// si no hay, se destaca el final de la frase.
function tituloHtml(t) {
  if (!t) return '';
  const html = t.html.replace(/<br>/g, ' ').replace(/<\/?i>/g, '');
  if (/<b>/.test(html)) return html.replace(/<b>/g, '<span class="grad">').replace(/<\/b>/g, '</span>');
  const txt = t.texto;
  const corte = /^(.*[,:;–—])\s+([^,:;–—]+)$/.exec(txt);
  if (corte && corte[1].length > 3 && corte[2].split(' ').length <= 6) {
    return escaparHtml(corte[1]) + ' <span class="grad">' + escaparHtml(corte[2]) + '</span>';
  }
  const palabras = txt.split(' ');
  if (palabras.length < 2) return '<span class="grad">' + escaparHtml(txt) + '</span>';
  const k = palabras.length >= 4 ? 2 : 1;
  return escaparHtml(palabras.slice(0, -k).join(' ')) + ' <span class="grad">' + escaparHtml(palabras.slice(-k).join(' ')) + '</span>';
}

function tamTitulo(texto) {
  const l = (texto || '').length;
  return l <= 34 ? ' xl' : l <= 80 ? '' : l <= 130 ? ' s' : ' xs';
}

// Agrupa los párrafos en puntos principales con sus sub-puntos.
function arbolDe(items) {
  if (!items.length) return [];
  const base = Math.min(...items.map((i) => i.nivel));
  const salida = [];
  for (const it of items) {
    if (it.nivel <= base || !salida.length) salida.push({ ...it, hijos: [] });
    else salida[salida.length - 1].hijos.push(it);
  }
  return salida;
}

function numeroDe(texto) {
  const m = RE_NUMERO.exec(texto.trim());
  if (!m || texto.trim().length > 16) return null;
  const crudo = m[2].replace(/[.,]$/, '');
  let valor;
  let loc = 'es';
  let dec = 0;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(crudo)) {
    valor = parseFloat(crudo.replace(/\./g, '').replace(',', '.'));
    dec = (crudo.split(',')[1] || '').length;
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(crudo)) {
    valor = parseFloat(crudo.replace(/,/g, ''));
    dec = (crudo.split('.')[1] || '').length;
    loc = 'en';
  } else if (/^\d+([.,]\d+)?$/.test(crudo)) {
    valor = parseFloat(crudo.replace(',', '.'));
    dec = (crudo.split(/[.,]/)[1] || '').length;
    loc = crudo.includes('.') ? 'en' : 'es';
  } else return null;
  if (!isFinite(valor)) return null;
  return { antes: m[1] || '', despues: m[3] || '', valor, dec, loc, original: crudo };
}

export function armarHtml(modelo, opciones, piezas) {
  const o = { evento: '', vivo: false, api: '', pasos: true, colores: null, logo: '', notas: true, ...opciones };
  const avisos = [...modelo.avisos];
  const c1 = rgbDe(o.colores?.[0]) || [255, 51, 0];
  const c2 = rgbDe(o.colores?.[1]) || (o.colores?.[0] ? c1 : [255, 153, 0]);
  const tituloCharla = (o.titulo || modelo.titulo || 'Presentación').trim();
  const idCharla = huella(tituloCharla + '|' + modelo.diapositivas.map((d) => d.titulo?.texto || '').join('|'));
  const encuestas = {};
  const resumen = { diapositivas: 0, votaciones: 0, nubes: 0, preguntas: 0 };
  const secciones = [];
  let nroSeccion = 0;
  let pasosDe = 0;

  // Clase y atributo de aparición: de a un clic (.f) o en cascada al entrar (.a).
  const aparece = (i, conPasos) => {
    if (conPasos) { pasosDe = Math.max(pasosDe, i); return ' f" data-f="' + i; }
    return ' a d' + Math.min(i + 1, 6);
  };

  const unirse = (texto) => '<div class="unirse a d3"><div class="qrframe"><i></i><i></i><i></i><i></i><div class="qrimg" data-qr="sala"></div></div>'
    + '<p class="live">' + texto + '</p><p class="url" data-url="sala"></p></div>';

  // `angosto`: el texto comparte la diapositiva con una imagen, así que no hay lugar para tarjetas en fila.
  function cuerpoPuntos(nodos, angosto) {
    const conPasos = o.pasos && nodos.length >= 2 && nodos.length <= 8;
    const largo = (n) => n.texto.length + n.hijos.reduce((a, h) => a + h.texto.length, 0);
    const maximo = Math.max(...nodos.map(largo));
    if (nodos.length === 1 && !nodos[0].hijos.length) return '<p class="parrafo a d2">' + nodos[0].html + '</p>';
    if (angosto) {
      // sigue a las variantes de filas o lista
    } else if (nodos.length >= 2 && nodos.length <= 4 && nodos.every((n) => n.hijos.length) && maximo <= 260) {
      return '<div class="grilla" style="--cols:' + nodos.length + '">' + nodos.map((n, i) =>
        '<div class="card' + (nodos.length > 2 && i === nodos.length - 1 ? ' dark' : '') + aparece(i + 1, conPasos) + '"><div class="dot' + (i === nodos.length - 1 && nodos.length > 2 ? ' s' : '') + '">' + (i + 1) + '</div><h3>' + n.html + '</h3><ul>'
        + n.hijos.map((h) => '<li>' + h.html + '</li>').join('') + '</ul></div>').join('') + '</div>';
    }
    else if (nodos.length >= 2 && nodos.length <= 3 && maximo <= 110 && nodos.every((n) => !n.hijos.length)) {
      return '<div class="grilla" style="--cols:' + nodos.length + '">' + nodos.map((n, i) =>
        '<div class="card' + aparece(i + 1, conPasos) + '"><div class="dot">' + (i + 1) + '</div><p class="grande">' + n.html + '</p></div>').join('') + '</div>';
    }
    if (nodos.length <= 6 && maximo <= 170) {
      return '<div class="filas">' + nodos.map((n, i) =>
        '<div class="fila' + aparece(i + 1, conPasos) + '"><div class="dot">' + (i + 1) + '</div><div><p class="ft">' + n.html + '</p>'
        + (n.hijos.length ? '<p class="fs">' + n.hijos.map((h) => h.html).join(' · ') + '</p>' : '') + '</div></div>').join('') + '</div>';
    }
    const lineas = nodos.reduce((a, n) => a + 1 + n.hijos.length, 0);
    return '<ul class="lista' + (lineas > 12 && !angosto ? ' dos-col' : '') + '">' + nodos.map((n, i) =>
      '<li class="' + aparece(i + 1, conPasos).trim() + '">' + n.html
      + (n.hijos.length ? '<ul>' + n.hijos.map((h) => '<li>' + h.html + '</li>').join('') + '</ul>' : '') + '</li>').join('') + '</ul>';
  }

  function tablaHtml(filas) {
    const [cabeza, ...resto] = filas;
    if (!resto.length) return '<table class="tabla a d2"><tbody><tr>' + cabeza.map((c) => '<td>' + c + '</td>').join('') + '</tr></tbody></table>';
    return '<table class="tabla a d2"><thead><tr>' + cabeza.map((c) => '<th>' + c + '</th>').join('') + '</tr></thead><tbody>'
      + resto.map((f) => '<tr>' + f.map((c) => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
  }

  const fotosHtml = (imagenes, maximo) => {
    const l = imagenes.slice(0, maximo);
    return '<div class="fotos marco a d2" style="--cols:' + (l.length > 2 ? 2 : l.length) + '">' + l.map((im) => '<img src="' + im.src + '" alt="">').join('') + '</div>';
  };

  const secciones_html = modelo.diapositivas.map((d, indice) => {
    pasosDe = 0;
    const tituloTxt = d.titulo?.texto || '';
    const nodos = arbolDe(d.items);
    let clase = 'slide';
    let extra = '';
    let etiqueta = d.seccion || o.evento || tituloCharla;
    let dentro = '';
    let tituloVisible = tituloTxt;

    const esVoto = RE_VOTO.test(tituloTxt);
    const esNube = RE_NUBE.test(tituloTxt);
    const esPreguntas = RE_PREGUNTAS.test(tituloTxt);
    const limpio = tituloTxt.replace(RE_VOTO, '').replace(RE_NUBE, '').replace(/^\s*preguntas\s*[:：]\s*/i, '').trim();
    const tituloLimpio = { html: escaparHtml(limpio), texto: limpio };
    const cabeza = (t, tam) => '<div class="kicker" data-text="' + escaparHtml(etiqueta) + '"></div>'
      + (t && t.texto ? '<h2 class="t' + (tam ?? tamTitulo(t.texto)) + '">' + tituloHtml(t) + '</h2>' : '');

    if (o.vivo && esVoto && nodos.length >= 2) {
      const id = idCharla + '-' + (indice + 1);
      if (nodos.length > 10) avisos.push('Diapositiva ' + d.n + ': la votación tiene más de 10 opciones; se usan las primeras 10.');
      encuestas[id] = { pregunta: limpio, ayuda: d.subtitulo?.texto || '', tipo: 'opciones', opciones: nodos.slice(0, 10).map((n, i) => ({ id: LETRAS[i], texto: n.texto.slice(0, 160) })) };
      resumen.votaciones++;
      clase += ' voto';
      extra = ' data-encuesta="' + id + '"';
      etiqueta = 'Votación en vivo';
      tituloVisible = limpio;
      dentro = '<canvas class="puntitos" width="1600" height="900"></canvas>' + cabeza(tituloLimpio)
        + '<div class="cuerpo"><div class="in"><div class="envivo"><div class="zona a d2"><div class="tally" data-key="' + id + '"></div>'
        + '<div class="total"><span class="live">EN VIVO</span><span><b data-total="' + id + '">0</b> <span data-plural="' + id + '">personas votaron</span></span></div></div>'
        + unirse('ESCANEÁ Y VOTÁ') + '</div></div></div>';
    } else if (o.vivo && esNube) {
      const id = idCharla + '-' + (indice + 1);
      encuestas[id] = { pregunta: limpio, ayuda: d.subtitulo?.texto || nodos[0]?.texto || 'Escribí tu respuesta y mirá la pantalla.', tipo: 'texto', opciones: [] };
      resumen.nubes++;
      clase += ' voto';
      extra = ' data-encuesta="' + id + '"';
      etiqueta = 'En vivo · Respondé desde el celular';
      tituloVisible = limpio;
      dentro = cabeza(tituloLimpio) + '<div class="cuerpo"><div class="in"><div class="envivo"><div class="zona a d2"><div class="nube" data-key="' + id + '"><div class="nubeVacia">Escribí tu respuesta en el celular y aparece acá</div></div>'
        + '<div class="total"><span class="live">EN VIVO</span><span>Ya contestaron: <b data-total="' + id + '">0</b></span></div></div>'
        + unirse('ESCANEÁ Y CONTESTÁ') + '</div></div></div>';
    } else if (o.vivo && esPreguntas) {
      resumen.preguntas++;
      extra = ' data-momento="preguntas"';
      etiqueta = 'Preguntas de la sala';
      const t = limpio && !RE_PREGUNTAS.test(limpio) ? tituloLimpio : { html: '¿Preguntas?', texto: '¿Preguntas?' };
      tituloVisible = t.texto;
      dentro = cabeza(t, ' xl') + '<div class="cuerpo"><div class="in"><div class="envivo"><div class="zona a d2"><ol class="pregs"></ol>'
        + '<p class="pregsVacia">Escribí tu pregunta desde el celular. Es anónima, y las más apoyadas aparecen acá.</p></div>'
        + unirse('ESCANEÁ Y PREGUNTÁ') + '</div></div></div>';
    } else {
      // Sin modo en vivo, las diapositivas marcadas quedan como diapositivas comunes, sin el prefijo.
      const t = esVoto || esNube ? tituloLimpio : d.titulo;
      if (esVoto || esNube) tituloVisible = limpio;
      const primero = nodos[0];
      // Muchas plantillas marcan las secciones con un número solo ("01", "2"): eso es un separador.
      const nroPropio = nodos.length === 1 && !nodos[0].hijos.length && !d.imagenes.length && /^\d{1,2}$/.test(nodos[0].texto.trim()) ? +nodos[0].texto.trim() : 0;
      const soloTitulo = (!nodos.length || nroPropio) && !d.imagenes.length && !d.tablas.length;
      const numero = nodos.length && nodos.length <= 2 && !nodos[0].hijos.length ? numeroDe(primero.texto) : null;
      const esCita = nodos.length && nodos.length <= 2 && !d.imagenes.length && /^[“"«‘']/.test(primero.texto) && primero.texto.length > 20;

      if (indice === 0 || d.disposicion === 'title' || d.disposicion === 'ctrTitle') {
        clase += ' portada';
        etiqueta = indice === 0 ? (o.evento || 'Presentación') : etiqueta;
        const bajada = d.subtitulo?.html || nodos.map((n) => n.html).join(' · ');
        dentro = '<canvas class="puntitos" width="1600" height="900"></canvas>'
          + (d.imagenes.length ? '<img class="foto-portada a d2" src="' + d.imagenes[0].src + '" alt="">' : '<div class="adorno a d2"><i></i><i></i><i></i><b></b></div>')
          + '<div class="kicker" data-text="' + escaparHtml(etiqueta) + '"></div>'
          + '<h1 class="t' + (tituloTxt.length <= 48 ? '' : tituloTxt.length <= 90 ? ' s' : ' xs') + '">' + tituloHtml(t) + '</h1>'
          + (bajada ? '<p class="sub a d3">' + bajada + '</p>' : '');
      } else if (d.disposicion === 'secHead' || soloTitulo) {
        clase += ' seccion';
        nroSeccion = nroPropio || nroSeccion + 1;
        dentro = '<div class="nro grad a">' + String(nroSeccion).padStart(2, '0') + '</div>'
          + '<h2 class="t' + (tituloTxt.length <= 40 ? '' : tituloTxt.length <= 80 ? ' s' : ' xs') + '">' + tituloHtml(t) + '</h2>'
          + (d.subtitulo || (nodos.length && !nroPropio) ? '<p class="sub a d3">' + (d.subtitulo?.html || nodos.map((n) => n.html).join(' · ')) + '</p>' : '');
      } else if (esCita) {
        dentro = cabeza(t) + '<div class="cuerpo"><div class="in"><div class="quote a d1">' + primero.html + '</div>'
          + (nodos[1] ? '<p class="autor a d3">— ' + nodos[1].html.replace(/^[—–-]\s*/, '') + '</p>' : '') + '</div></div>';
      } else if (numero) {
        dentro = cabeza(t) + '<div class="cuerpo"><div class="in"><div class="big a d1">' + escaparHtml(numero.antes)
          + '<span class="grad" data-count="' + numero.valor + '" data-dec="' + numero.dec + '" data-loc="' + numero.loc + '">' + escaparHtml(numero.original) + '</span>' + escaparHtml(numero.despues) + '</div>'
          + (nodos[1] ? '<p class="parrafo a d3">' + nodos[1].html + '</p>' : d.subtitulo ? '<p class="parrafo a d3">' + d.subtitulo.html + '</p>' : '') + '</div></div>';
      } else {
        let cuerpo = '';
        if (d.tablas.length) {
          cuerpo = (nodos.length ? '<p class="parrafo a d1" style="margin-bottom:.7em">' + nodos.map((n) => n.html).join(' · ') + '</p>' : '') + d.tablas.map(tablaHtml).join('');
        } else if (d.imagenes.length && nodos.length) {
          cuerpo = '<div class="dos"><div class="col">' + cuerpoPuntos(nodos, true) + '</div>' + fotosHtml(d.imagenes, 2) + '</div>';
        } else if (d.imagenes.length) {
          cuerpo = fotosHtml(d.imagenes, 4);
        } else {
          cuerpo = cuerpoPuntos(nodos);
        }
        dentro = cabeza(t) + (d.subtitulo ? '<p class="sub a d1">' + d.subtitulo.html + '</p>' : '') + '<div class="cuerpo"><div class="in">' + cuerpo + '</div></div>';
      }
    }

    const lineasTotales = d.items.length + d.tablas.reduce((a, t) => a + t.length, 0);
    if (lineasTotales > 24) avisos.push('Diapositiva ' + d.n + ' («' + (tituloVisible || 'sin título').slice(0, 50) + '»): tiene ' + lineasTotales + ' líneas de texto y se va a ver muy chica. Conviene dividirla, o pegarla como imagen si es un diagrama.');
    if (d.seccion && !secciones.includes(d.seccion)) secciones.push(d.seccion);
    resumen.diapositivas++;
    const notas = o.notas && d.notas ? ' data-notes="' + escaparHtml(d.notas) + '"' : '';
    return '<section class="' + clase + '" data-titulo="' + escaparHtml(tituloVisible || 'Diapositiva ' + d.n) + '"' + (d.seccion ? ' data-seccion="' + escaparHtml(d.seccion) + '"' : '')
      + (pasosDe ? ' data-steps="' + pasosDe + '"' : '') + extra + notas + '>\n' + dentro + '\n</section>';
  });

  const conVivo = o.vivo && (resumen.votaciones || resumen.nubes || resumen.preguntas);
  if (o.vivo && !conVivo) {
    avisos.push('Pediste el modo en vivo, pero ninguna diapositiva tiene un título que empiece con "VOTAR:", "NUBE:" o que sea "Preguntas". La presentación quedó sin votaciones.');
  }
  const config = { id: idCharla, titulo: tituloCharla, vivo: !!conVivo, api: String(o.api || '').trim().replace(/\/+$/, ''), encuestas };
  const estiloColores = ':root{--c1:' + aHex(c1) + ';--c2:' + aHex(c2) + ';--c1-rgb:' + c1.join(',') + ';--c2-rgb:' + c2.join(',') + '}';
  const quitarExport = (js) => js.replace(/^export\s+/gm, '');
  const ayuda = '→ o espacio: avanzar · ←: volver · F: pantalla completa · N: notas · G: ir a · B: en blanco' + (conVivo ? ' · C: conexión' : '');

  const panelVivo = conVivo ? `<div class="capa" id="cfg"><div class="box">
  <h3>Modo en vivo</h3>
  <p id="cfgEstado"></p>
  <form id="cfgForm">
    <label for="cfgUrl">Dirección de tu servidor</label>
    <input id="cfgUrl" type="url" inputmode="url" autocomplete="off" placeholder="https://mi-charla.vercel.app">
    <div id="cfgEntrar"><label for="cfgPin">PIN del presentador</label>
    <input id="cfgPin" type="password" inputmode="numeric" maxlength="8" autocomplete="off"></div>
    <div class="acts" style="justify-content:flex-start;margin-top:14px"><button class="btn" type="submit">Conectar</button><button class="btn ghost" id="cfgSalir" type="button">Desconectar</button><button class="btn ghost" id="retomar" type="button" style="display:none">Retomar el control</button></div>
  </form>
  <div class="cfgqr" id="cfgQrs"><figure><div class="qrimg" data-qr="control"></div><figcaption>Tu control remoto: escanealo antes de conectar el proyector.<br><span data-url="control"></span></figcaption></figure><figure><div class="qrimg" data-qr="sala"></div><figcaption>Para la sala.<br><span data-url="sala"></span></figcaption></figure></div>
  <div class="acts"><button class="btn ghost" id="resetV" type="button">Limpiar todos los datos</button><button class="btn" id="cerrarCfg" type="button">Listo</button></div>
</div></div>
` : '';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="joseii · github.com/chimichurria/joseii">
<title>${escaparHtml(tituloCharla)}</title>
<style>
${piezas.css}
${estiloColores}
</style>
</head>
<body${conVivo ? ' class="sinapi"' : ''}>
<div id="viewport"><div id="stage">
<div class="gridbg"></div>
<canvas id="bg"></canvas>
<div class="glow g1"></div><div class="glow g2"></div>
${secciones_html.join('\n')}
<div class="foot"><span class="izq">${escaparHtml(o.evento || tituloCharla)}</span><span class="num" id="num" title="Ir a otra diapositiva"></span><span class="der">${conVivo ? '<button class="chipv off" id="chipVivo" type="button">Sin servidor</button>' : ''}${o.logo ? '<img src="' + o.logo + '" alt="">' : ''}</span></div>
<div id="avisoRed">Sin conexión · conteo manual con + y −</div>
</div></div>
<div id="blanco"></div>
<div id="prog"></div>
<div id="notes"><div class="hd"><span id="nt"></span><span id="clock">00:00</span></div><div id="nx"></div><div id="nsig"></div></div>
<div id="help">${ayuda}</div>
<div class="capa" id="indice"><div class="box"><h3>Ir a…</h3><div id="indiceLista"></div></div></div>
${panelVivo}<script id="charla" type="application/json">${JSON.stringify(config).replace(/</g, '\\u003c')}</script>
<script>
${conVivo ? quitarExport(piezas.qr) : ''}
${piezas.js}
</script>
</body>
</html>
`;
  return { html, avisos, resumen, config };
}
