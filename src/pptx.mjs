// Lee un .pptx y devuelve su contenido como datos simples:
// { titulo, colores, diapositivas: [{ n, titulo, subtitulo, items, imagenes, tablas, notas, seccion, disposicion }], avisos }
import { abrirZip } from './zip.mjs';
import { leerXml, hijo, hijos, ruta, todos } from './xml.mjs';

const TIPOS_IMAGEN = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', bmp: 'image/bmp' };
const TITULO_GENERICO = /^(presentaci[oó]n( de powerpoint)?|powerpoint presentation|diapositiva \d+|slide \d+|untitled|sin t[ií]tulo)$/i;

export function escaparHtml(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function aBase64(b) {
  if (typeof Buffer !== 'undefined') return Buffer.from(b.buffer, b.byteOffset, b.byteLength).toString('base64');
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}

function resolverRuta(base, destino) {
  if (destino.startsWith('/')) return destino.slice(1);
  const partes = base.split('/');
  partes.pop();
  for (const s of destino.split('/')) {
    if (s === '..') partes.pop();
    else if (s !== '.') partes.push(s);
  }
  return partes.join('/');
}

async function relacionesDe(zip, archivo) {
  const carpeta = archivo.replace(/[^/]+$/, '');
  const txt = await zip.texto(carpeta + '_rels/' + archivo.slice(carpeta.length) + '.rels');
  const mapa = {};
  if (!txt) return mapa;
  for (const r of todos(leerXml(txt), 'Relationship')) {
    const externo = r.a.TargetMode === 'External';
    mapa[r.a.Id] = { tipo: String(r.a.Type || '').split('/').pop(), destino: externo ? r.a.Target : resolverRuta(archivo, r.a.Target), externo };
  }
  return mapa;
}

// Párrafos de un cuadro de texto: nivel de sangría, texto plano y HTML con negritas y cursivas.
function parrafosDe(txBody) {
  const salida = [];
  for (const p of hijos(txBody, 'a:p')) {
    let html = '';
    let texto = '';
    let tam = 0;
    let negrita = 0;
    let largo = 0;
    for (const r of p.c) {
      if (r.n === 'a:br') { html += '<br>'; texto += ' '; continue; }
      if (r.n !== 'a:r' && r.n !== 'a:fld') continue;
      const t = hijo(r, 'a:t')?.t ?? '';
      if (!t) continue;
      const pr = hijo(r, 'a:rPr')?.a ?? {};
      let h = escaparHtml(t);
      if (pr.i === '1') h = '<i>' + h + '</i>';
      if (pr.b === '1') { h = '<b>' + h + '</b>'; negrita += t.trim().length; }
      if (pr.sz) tam = Math.max(tam, +pr.sz);
      html += h;
      texto += t;
      largo += t.trim().length;
    }
    texto = texto.replace(/\s+/g, ' ').trim();
    if (!texto) continue;
    html = html.replace(/<\/b>(\s*)<b>/g, '$1').replace(/^(<br>)+|(<br>)+$/g, '').trim();
    // Si todo el párrafo está en negrita es un estilo, no un énfasis.
    if (negrita >= largo) html = html.replace(/<\/?b>/g, '');
    const pp = hijo(p, 'a:pPr');
    salida.push({ nivel: +(pp?.a.lvl || 0), html, texto, tam });
  }
  return salida;
}

function cajaDe(n) {
  const x = ruta(n, 'p:spPr', 'a:xfrm') || hijo(n, 'p:xfrm');
  const off = hijo(x, 'a:off');
  const ext = hijo(x, 'a:ext');
  return { x: +(off?.a.x ?? 0), y: +(off?.a.y ?? 0), w: +(ext?.a.cx ?? 0), h: +(ext?.a.cy ?? 0) };
}

function recorrerFormas(arbol, f) {
  if (!arbol) return;
  for (const n of arbol.c) {
    if (n.n === 'p:grpSp') recorrerFormas(n, f);
    else if (n.n === 'mc:AlternateContent') recorrerFormas(hijo(n, 'mc:Fallback') || hijo(n, 'mc:Choice'), f);
    else f(n);
  }
}

const unir = (pars) => ({ html: pars.map((p) => p.html).join('<br>'), texto: pars.map((p) => p.texto).join(' ') });

async function leerDiapositiva(zip, archivo, ctx) {
  const txt = await zip.texto(archivo);
  const sld = txt ? hijo(leerXml(txt), 'p:sld') : null;
  if (!sld || sld.a.show === '0') return null;
  const rels = await relacionesDe(zip, archivo);
  const d = { titulo: null, subtitulo: null, items: [], imagenes: [], tablas: [], notas: '', disposicion: '', avisos: [] };
  const cuerpos = [];
  const sueltos = [];
  const fotos = [];

  recorrerFormas(ruta(sld, 'p:cSld', 'p:spTree'), (n) => {
    if (n.n === 'p:sp') {
      const ph = ruta(n, 'p:nvSpPr', 'p:nvPr', 'p:ph');
      const tipo = ph ? ph.a.type || 'body' : '';
      if (['dt', 'ftr', 'sldNum', 'hdr'].includes(tipo)) return;
      const pars = parrafosDe(hijo(n, 'p:txBody'));
      if (!pars.length) return;
      if ((tipo === 'title' || tipo === 'ctrTitle') && !d.titulo) d.titulo = unir(pars);
      else if (tipo === 'subTitle' && !d.subtitulo) d.subtitulo = unir(pars);
      else if (ph) cuerpos.push(pars);
      else sueltos.push({ caja: cajaDe(n), pars, tam: Math.max(...pars.map((p) => p.tam)) });
    } else if (n.n === 'p:pic') {
      fotos.push(n);
    } else if (n.n === 'p:graphicFrame') {
      const tabla = todos(n, 'a:tbl')[0];
      if (tabla) {
        d.tablas.push(hijos(tabla, 'a:tr').map((tr) => hijos(tr, 'a:tc').map((tc) => parrafosDe(hijo(tc, 'a:txBody')).map((p) => p.html).join('<br>'))));
      } else if (todos(n, 'c:chart').length) {
        d.avisos.push('tiene un gráfico que no se pudo convertir. Pegalo como imagen en el PowerPoint y volvé a convertir.');
      } else if (todos(n, 'dgm:relIds').length) {
        d.avisos.push('tiene un SmartArt que no se pudo convertir. Pasalo a texto o pegalo como imagen.');
      }
    }
  });

  // Presentaciones hechas en Canva o Google Slides no usan marcadores: el título es el texto más grande.
  if (!d.titulo && sueltos.length) {
    const conTam = sueltos.filter((s) => s.tam > 0);
    const candidato = conTam.length
      ? conTam.reduce((a, b) => (b.tam > a.tam ? b : a))
      : sueltos.reduce((a, b) => (b.caja.y < a.caja.y ? b : a));
    const texto = candidato.pars.map((p) => p.texto).join(' ');
    if (texto.length <= 160 && candidato.pars.length <= 3) {
      d.titulo = unir(candidato.pars);
      sueltos.splice(sueltos.indexOf(candidato), 1);
    }
  }
  sueltos.sort((a, b) => (Math.abs(a.caja.y - b.caja.y) > 200000 ? a.caja.y - b.caja.y : a.caja.x - b.caja.x));
  for (const pars of cuerpos) d.items.push(...pars);
  for (const s of sueltos) d.items.push(...s.pars);

  for (const n of fotos) {
    const rel = rels[ruta(n, 'p:blipFill', 'a:blip')?.a['r:embed']];
    if (!rel || rel.externo) continue;
    const caja = cajaDe(n);
    const area = caja.w && caja.h ? (caja.w * caja.h) / (ctx.ancho * ctx.alto) : 1;
    if (todos(hijo(n, 'p:nvPicPr'), 'a:videoFile').length) d.avisos.push('tiene un video: en el HTML queda solo su imagen de portada.');
    if (area < 0.012) continue; // íconos y logos chicos de la plantilla
    const ext = rel.destino.split('.').pop().toLowerCase();
    const mime = TIPOS_IMAGEN[ext];
    if (!mime) {
      d.avisos.push('tiene una imagen en formato .' + ext + ' que el navegador no muestra. Guardala como PNG y volvé a convertir.');
      continue;
    }
    const bytes = await zip.bytes(rel.destino);
    if (bytes) d.imagenes.push({ src: 'data:' + mime + ';base64,' + aBase64(bytes), area, proporcion: caja.h ? caja.w / caja.h : 0 });
  }
  d.imagenes.sort((a, b) => b.area - a.area);

  const relNotas = Object.values(rels).find((r) => r.tipo === 'notesSlide');
  const xmlNotas = relNotas ? await zip.texto(relNotas.destino) : null;
  if (xmlNotas) {
    const partes = [];
    recorrerFormas(ruta(hijo(leerXml(xmlNotas), 'p:notes'), 'p:cSld', 'p:spTree'), (n) => {
      if (n.n === 'p:sp' && ruta(n, 'p:nvSpPr', 'p:nvPr', 'p:ph')?.a.type === 'body') {
        partes.push(...parrafosDe(hijo(n, 'p:txBody')).map((p) => p.texto));
      }
    });
    d.notas = partes.join('\n');
  }

  const relDisp = Object.values(rels).find((r) => r.tipo === 'slideLayout');
  if (relDisp) {
    if (!ctx.disposiciones.has(relDisp.destino)) {
      const x = await zip.texto(relDisp.destino);
      ctx.disposiciones.set(relDisp.destino, x ? hijo(leerXml(x), 'p:sldLayout')?.a.type || '' : '');
    }
    d.disposicion = ctx.disposiciones.get(relDisp.destino);
  }
  return d;
}

export async function leerPptx(datos, nombreArchivo) {
  const zip = await abrirZip(datos);
  const xmlPres = await zip.texto('ppt/presentation.xml');
  if (!xmlPres) throw new Error('El archivo no es una presentación .pptx. Si es .ppt, Keynote o Google Slides, exportalo como .pptx.');
  const pres = hijo(leerXml(xmlPres), 'p:presentation');
  const rels = await relacionesDe(zip, 'ppt/presentation.xml');
  const tam = hijo(pres, 'p:sldSz');
  const ctx = { ancho: +(tam?.a.cx || 12192000), alto: +(tam?.a.cy || 6858000), disposiciones: new Map() };

  const secciones = new Map();
  for (const s of todos(pres, 'p14:section')) {
    for (const id of todos(s, 'p14:sldId')) secciones.set(id.a.id, s.a.name || '');
  }

  const modelo = { titulo: '', colores: null, diapositivas: [], avisos: [] };
  for (const id of hijos(hijo(pres, 'p:sldIdLst'), 'p:sldId')) {
    const rel = rels[id.a['r:id']];
    const d = rel ? await leerDiapositiva(zip, rel.destino, ctx) : null;
    if (!d) continue;
    d.n = modelo.diapositivas.length + 1;
    d.seccion = secciones.get(id.a.id) || '';
    for (const a of d.avisos) modelo.avisos.push('Diapositiva ' + d.n + ': ' + a);
    delete d.avisos;
    modelo.diapositivas.push(d);
  }
  if (!modelo.diapositivas.length) throw new Error('La presentación no tiene diapositivas visibles.');
  // Una sola sección es la que PowerPoint crea por defecto: no aporta nada.
  if (new Set(modelo.diapositivas.map((d) => d.seccion)).size <= 1) modelo.diapositivas.forEach((d) => { d.seccion = ''; });

  const core = await zip.texto('docProps/core.xml');
  const tituloDoc = core ? (todos(leerXml(core), 'dc:title')[0]?.t || '').trim() : '';
  modelo.titulo = (tituloDoc && !TITULO_GENERICO.test(tituloDoc) ? tituloDoc : '')
    || modelo.diapositivas[0].titulo?.texto
    || String(nombreArchivo || 'Presentación').replace(/\.pptx$/i, '');

  const relTema = Object.values(rels).find((r) => r.tipo === 'theme');
  const xmlTema = relTema ? await zip.texto(relTema.destino) : null;
  if (xmlTema) {
    const esquema = todos(leerXml(xmlTema), 'a:clrScheme')[0];
    const color = (nombre) => {
      const c = hijo(esquema, nombre);
      const v = hijo(c, 'a:srgbClr')?.a.val || hijo(c, 'a:sysClr')?.a.lastClr;
      return v ? '#' + v.toUpperCase() : null;
    };
    const c1 = color('a:accent1');
    if (c1) modelo.colores = [c1, color('a:accent2') || c1];
  }
  return modelo;
}
