/* Motor de la presentación: navegación, pasos, notas, reloj y, si se activó, el modo en vivo. */
(function(){
'use strict';
var C=JSON.parse(document.getElementById('charla').textContent),PRE='charla_'+C.id+'_';
var LS={get:function(k){try{return localStorage.getItem(PRE+k)}catch(e){return null}},set:function(k,v){try{localStorage.setItem(PRE+k,v)}catch(e){}}};
function $(i){return document.getElementById(i)}
function cada(sel,f,raiz){[].forEach.call((raiz||document).querySelectorAll(sel),f)}
var stage=$('stage'),calma=matchMedia('(prefers-reduced-motion:reduce)').matches;
var est=getComputedStyle(document.documentElement),C1=(est.getPropertyValue('--c1-rgb')||'255,51,0').trim(),C2=(est.getPropertyValue('--c2-rgb')||'255,153,0').trim();
function fit(){var s=Math.min(innerWidth/1600,innerHeight/900);stage.style.transform='scale('+s+')'}
addEventListener('resize',fit);fit();
var slides=[].slice.call(document.querySelectorAll('.slide')),cur=0,step=0,VIVO=!!C.vivo;

/* red de partículas del fondo */
var bg=$('bg'),bx=bg.getContext('2d'),P=[],KB=1;
function bgSize(){var s=Math.min(innerWidth/1600,innerHeight/900),d=Math.min(window.devicePixelRatio||1,2);KB=Math.max(.4,s*d);bg.width=Math.round(1600*KB);bg.height=Math.round(900*KB);
 if(!P.length)for(var i=0;i<58;i++)P.push({x:Math.random()*1600,y:Math.random()*900,vx:(Math.random()-.5)*.25,vy:(Math.random()-.5)*.25,r:Math.random()<.12?2.6:1.6,c:Math.random()<.12})}
addEventListener('resize',bgSize);bgSize();
(function loop(){bx.setTransform(KB,0,0,KB,0,0);bx.clearRect(0,0,1600,900);var i,j,p;
 for(i=0;i<P.length;i++){p=P[i];p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>1600)p.vx*=-1;if(p.y<0||p.y>900)p.vy*=-1}
 for(i=0;i<P.length;i++)for(j=i+1;j<P.length;j++){var a=P[i],b=P[j],dx=a.x-b.x,dy=a.y-b.y,d=dx*dx+dy*dy;if(d<16000){bx.strokeStyle='rgba(72,84,88,'+(.10*(1-d/16000))+')';bx.lineWidth=1;bx.beginPath();bx.moveTo(a.x,a.y);bx.lineTo(b.x,b.y);bx.stroke()}}
 for(i=0;i<P.length;i++){p=P[i];bx.fillStyle=p.c?'rgba('+C1+',.55)':'rgba(72,84,88,.28)';bx.beginPath();bx.arc(p.x,p.y,p.r,0,7);bx.fill()}
 if(!calma)requestAnimationFrame(loop)})();

/* títulos palabra por palabra y etiqueta que se escribe sola */
cada('.t',function(h){var nodos=[].slice.call(h.childNodes),k=0;h.textContent='';
 function pieza(contenido){var w=document.createElement('span'),inn=document.createElement('span');w.className='w';inn.style.transitionDelay=(k++*.05+.1)+'s';if(typeof contenido==='string')inn.textContent=contenido;else inn.appendChild(contenido);w.appendChild(inn);h.appendChild(w)}
 nodos.forEach(function(n){if(n.nodeType===3){n.textContent.split(/(\s+)/).forEach(function(t){if(!t)return;if(/^\s+$/.test(t))h.appendChild(document.createTextNode(' '));else pieza(t)})}else pieza(n)})});
var typeT;
function typeK(s){var k=s.querySelector('.kicker[data-text]');if(!k)return;clearInterval(typeT);var tx=k.dataset.text,i=0;k.textContent='';var sp=document.createElement('span'),c=document.createElement('i');c.className='cur';k.appendChild(sp);k.appendChild(c);
 if(calma){sp.textContent=tx;return}
 typeT=setInterval(function(){sp.textContent=tx.slice(0,++i);if(i>=tx.length)clearInterval(typeT)},22)}

/* campo de puntos de las diapositivas destacadas */
function puntos(cv){var cx=cv.getContext('2d'),pts=[],x,y,n=0,s=cv.closest('.slide');for(y=36;y<900;y+=24)for(x=36;x<1600;x+=24)pts.push([x,y]);pts.sort(function(){return Math.random()-.5});cx.clearRect(0,0,1600,900);
 (function f(){if(!s.classList.contains('active'))return;for(var k=0;k<36&&n<pts.length;k++,n++){var p=pts[n];cx.fillStyle=n%11===0?'rgb('+C1+')':(n%7===0?'rgb('+C2+')':'#C9CED0');cx.beginPath();cx.arc(p[0],p[1],3.6,0,7);cx.fill()}if(n<pts.length&&!calma)requestAnimationFrame(f)})()}

/* números que cuentan */
function fmt(v,e){var d=+(e.dataset.dec||0);return v.toLocaleString(e.dataset.loc==='en'?'en-US':'es-AR',{minimumFractionDigits:d,maximumFractionDigits:d})}
function contar(s){cada('[data-count]',function(e){var fin=+e.dataset.count,t0=performance.now();if(calma){e.textContent=fmt(fin,e);return}
 (function f(t){var u=Math.min(1,(t-t0)/1100);e.textContent=fmt(fin*(1-Math.pow(1-u,3)),e);if(u<1&&s.classList.contains('active'))requestAnimationFrame(f);else e.textContent=fmt(fin,e)})(t0)},s)}

/* si el contenido no entra en la diapositiva, se achica hasta que entre */
function ajustar(s){var c=s.querySelector('.cuerpo'),i=c&&c.querySelector('.in');if(!i||c.dataset.listo)return;var k=1;i.style.setProperty('--k',k);
 while(k>.4&&(i.offsetHeight>c.clientHeight+2||i.scrollWidth>c.clientWidth+2)){k-=.04;i.style.setProperty('--k',k.toFixed(2))}
 c.classList.toggle('desborda',i.offsetHeight>c.clientHeight+2);c.dataset.listo='1'}
function ajustarTodo(){slides.forEach(function(s){var c=s.querySelector('.cuerpo');if(c)delete c.dataset.listo;ajustar(s)})}
addEventListener('load',ajustarTodo);

/* barras de votación: los votos de la sala se suman a los cargados a mano con + y − */
var T={};
cada('.tally',function(t){var k=t.dataset.key,def=C.encuestas[k];if(!def)return;var guardado={};try{guardado=JSON.parse(LS.get('t'+k)||'{}')}catch(e){}
 var v={},sv={};T[k]={el:t,v:v,s:sv};
 def.opciones.forEach(function(o){v[o.id]=guardado[o.id]||0;sv[o.id]=0;var r=document.createElement('div');r.className='trow';r.dataset.o=o.id;
  r.innerHTML='<div class="lb"><b></b><span></span></div><div class="track"><div class="fill"></div></div><div class="ct">0</div><div class="ctl"><button data-d="-1" aria-label="Restar">−</button><button data-d="1" aria-label="Sumar">+</button></div>';
  r.querySelector('b').textContent=o.id;r.querySelector('span').textContent=o.texto;t.appendChild(r)});
 t.addEventListener('click',function(e){e.stopPropagation();var b=e.target.closest('button');if(!b)return;var o=b.closest('.trow').dataset.o;v[o]=Math.max(0,v[o]+(+b.dataset.d));LS.set('t'+k,JSON.stringify(v));renderT(k)});renderT(k)});
function votos(k,o){return T[k].v[o]+(T[k].s[o]||0)}
function renderT(k){var t=T[k],vals=Object.keys(t.v).map(function(o){return votos(k,o)}),tot=vals.reduce(function(a,b){return a+b},0),mx=Math.max.apply(null,vals);
 cada('.trow',function(r){var v=votos(k,r.dataset.o);r.querySelector('.fill').style.width=(tot?v/tot*100:0)+'%';r.querySelector('.ct').textContent=v;r.classList.toggle('win',v>0&&v===mx)},t.el);
 cada('[data-total="'+k+'"]',function(e){e.textContent=tot});
 cada('[data-plural="'+k+'"]',function(e){e.textContent=tot===1?'persona votó':'personas votaron'})}

/* modo en vivo: la presentación habla con el servidor de la sala */
var base='',token=null,seq=0,conectado=false,fallos=0,indiceListo=false,sincronizando=false,cedido=false,SID=Math.random().toString(36).slice(2),relojInicio=+(LS.get('reloj')||0)||null,cfg=$('cfg');
function api(r,d){if(!base)return Promise.reject(new Error('Falta la dirección del servidor'));var h={},o={headers:h,cache:'no-store'};if(token)h.Authorization='Bearer '+token;if(d){o.method='POST';h['Content-Type']='application/json';o.body=JSON.stringify(d)}
 return fetch(base+'/api/'+r,o).then(function(x){return x.json().then(function(j){if(!x.ok){var e=new Error(j.error||'Error');e.estado=x.status;throw e}return j})})}
function red(ok){fallos=ok?0:fallos+1;document.body.classList.toggle('sinred',!!base&&fallos>=2)}
function pintarAcceso(){document.body.classList.toggle('sinapi',!base);if(!base)return;var corta=base.replace(/^https?:\/\//,'');
 cada('[data-qr]',function(e){try{e.innerHTML=qrSvg(base+(e.dataset.qr==='control'?'/control':'/'))}catch(x){e.textContent=''}});
 cada('[data-url]',function(e){e.textContent=corta+(e.dataset.url==='control'?'/control':'')})}
function encuestasDe(s){return s.dataset.encuesta?[s.dataset.encuesta]:[]}
var repT=null;function reportar(){if(!VIVO)return;clearTimeout(repT);repT=setTimeout(enviarEstado,40)}
function enviarEstado(){if(!token||!conectado)return;var s=slides[cur],d={charla:C.id,diapositiva:cur+1,paso:step,pasos:+(s.dataset.steps||0),total:slides.length,titulo:s.dataset.titulo||'',notas:s.dataset.notes||'',encuestas:encuestasDe(s),momento:s.dataset.momento||''};
 if(relojInicio)d.relojInicio=new Date(relojInicio).toISOString();
 if(!indiceListo)d.indice=slides.map(function(x,i){return {n:i+1,titulo:x.dataset.titulo||''}});
 api('presentador',d).then(function(){indiceListo=true;red(true)}).catch(function(e){red(false);if(e.estado===401)salirSesion()})}
function ejecutar(c){if(c.tipo==='siguiente')next();else if(c.tipo==='anterior')prev();else if(c.tipo==='ir')go((+c.valor)-1);else if(c.tipo==='blanco')$('blanco').classList.toggle('on',!!c.valor);else if(c.tipo==='reloj')iniciarReloj();else if(c.tipo==='limpio')limpioLocal(c.valor);else if(c.tipo==='tomar'&&c.valor!==SID){cedido=true;conectado=false;estadoCfg()}}
function limpioLocal(id){for(var k in T){if(id&&k!==id)continue;for(var o in T[k].v){T[k].v[o]=0;T[k].s[o]=0}LS.set('t'+k,'{}');renderT(k)}
 if(!id){relojInicio=null;LS.set('reloj','')}leer();reportar()}
function sincro(){if(sincronizando||!token)return;sincronizando=true;(function ciclo(){if(!token||cedido){sincronizando=false;return}
 api('sincro?desde='+seq).then(function(r){red(true);r.comandos.forEach(function(c){seq=c.seq;ejecutar(c)});ciclo()}).catch(function(e){red(false);if(e.estado===401){sincronizando=false;salirSesion();return}setTimeout(ciclo,1800)})})()}
function salirSesion(){token=null;conectado=false;LS.set('token','');estadoCfg()}
function conectar(){if(!base||!token){estadoCfg();return}
 api('definir',{id:C.id,titulo:C.titulo,encuestas:C.encuestas}).then(function(){return api('ultimo')}).then(function(r){seq=r.seq;conectado=true;cedido=false;indiceListo=false;red(true);estadoCfg();api('comando',{tipo:'tomar',valor:SID}).catch(function(){});sincro();enviarEstado()})
  .catch(function(e){if(e.estado===401)salirSesion();else{red(false);estadoCfg();setTimeout(conectar,3000)}})}
function iniciarReloj(){relojInicio=Date.now();LS.set('reloj',relojInicio);t0=relojInicio;reportar()}
function leerResultados(k){api('resultados?e='+k+'&t='+Math.floor(Date.now()/1000)).then(function(r){red(true);if(r.conteos[k]&&T[k]){T[k].s=r.conteos[k];renderT(k)}}).catch(function(){red(false)})}
var nubes={};
function leerNube(k,el){api('palabras?e='+k+'&t='+Math.floor(Date.now()/1000)).then(function(r){red(true);var l=r.palabras,mx=l.length?l[0].n:1,vistas={},tot=0,mapa=nubes[k]||(nubes[k]={}),orden=[];
  el.querySelector('.nubeVacia').style.display=l.length?'none':'flex';
  l.forEach(function(w,i){if(i%2)orden.push(w);else orden.unshift(w)});
  orden.forEach(function(w){tot+=w.n;vistas[w.clave]=1;var s=mapa[w.clave];if(s)s.style.animation='none';else{s=document.createElement('span');s.className='ficha n'+(w.clave.length%3);mapa[w.clave]=s}s.textContent=w.texto;s.style.fontSize=Math.round(26+84*Math.sqrt(w.n/mx))+'px';s.classList.toggle('top',w===l[0]);el.appendChild(s)});
  Object.keys(mapa).forEach(function(c){if(!vistas[c]){mapa[c].remove();delete mapa[c]}});
  cada('[data-total="'+k+'"]',function(e){e.textContent=tot})}).catch(function(){red(false)})}
function leerPreguntas(ol){api('preguntas?t='+Math.floor(Date.now()/1000)).then(function(r){var l=r.preguntas.filter(function(p){return p.estado==='aprobada'}).slice(0,5),f=JSON.stringify(l);if(f===ol.dataset.f)return;
  var primera=!ol.dataset.f;ol.dataset.f=f;ol.textContent='';l.forEach(function(p){var li=document.createElement('li'),b=document.createElement('b'),t=document.createElement('span');b.textContent='▲'+p.apoyos;t.textContent=p.texto;li.appendChild(b);li.appendChild(t);if(!primera)li.style.animation='none';ol.appendChild(li)});
  var v=ol.parentNode.querySelector('.pregsVacia');if(v)v.style.display=l.length?'none':'block'}).catch(function(){})}
var tic=0;
function leer(){if(!VIVO||!base||document.hidden)return;var s=slides[cur],k=s.dataset.encuesta,n=s.querySelector('.nube'),ol=s.querySelector('.pregs');tic++;
 if(k&&n)leerNube(k,n);else if(k)leerResultados(k);
 if(ol&&tic%2===0)leerPreguntas(ol)}

/* panel de conexión */
function estadoCfg(){if(!VIVO)return;var e=$('cfgEstado'),ch=$('chipVivo');$('retomar').style.display=cedido?'':'none';$('cfgSalir').style.display=token?'':'none';$('cfgEntrar').style.display=token?'none':'';$('cfgQrs').style.display=base?'flex':'none';
 e.textContent=!base?'Sin servidor: las votaciones se cuentan a mano con + y −. Para que la sala vote desde el celular, pegá la dirección de tu servidor.':!token?'Ingresá tu PIN para que los celulares sigan la presentación.':cedido?'Otra pantalla tomó el control de la charla.':conectado?'Conectada. Los celulares siguen la presentación.':'Conectando…';
 ch.textContent=!base?'Sin servidor':!token?'Sin conectar':cedido?'Otra pantalla':conectado?'En vivo':'Conectando';ch.className='chipv'+(!base||!token||cedido?' off':conectado?'':' espera')}
function abrirCfg(){if(!VIVO)return;$('cfgUrl').value=base;estadoCfg();cfg.classList.add('on');setTimeout(function(){(base&&!token?$('cfgPin'):$('cfgUrl')).focus()},60)}
function entrar(){var u=$('cfgUrl').value.trim().replace(/\/+$/,''),pin=$('cfgPin').value.trim(),m=$('cfgEstado');if(u&&!/^https?:\/\//i.test(u))u='https://'+u;
 if(u!==base){base=u;LS.set('api',base);token=null;conectado=false;LS.set('token','');pintarAcceso()}
 if(!base||!pin){estadoCfg();return}
 m.textContent='Verificando…';api('login',{pin:pin}).then(function(r){token=r.token;LS.set('token',token);$('cfgPin').value='';conectar();setTimeout(function(){if(conectado)cfg.classList.remove('on')},1200)}).catch(function(e){$('cfgPin').value='';m.textContent=e.estado?e.message:'No se pudo conectar con el servidor. Revisá la dirección e internet.'})}
if(VIVO){base=(LS.get('api')||C.api||'').replace(/\/+$/,'');token=LS.get('token')||null;pintarAcceso();
 $('cfgForm').addEventListener('submit',function(ev){ev.preventDefault();entrar()});
 $('chipVivo').addEventListener('click',function(e){e.stopPropagation();abrirCfg()});
 $('retomar').onclick=function(){cedido=false;conectar()};
 $('cfgSalir').onclick=salirSesion;
 $('cerrarCfg').onclick=function(){cfg.classList.remove('on')};
 $('resetV').onclick=function(){if(!confirm('Se borran los votos, las palabras y las preguntas. ¿Seguro?'))return;limpioLocal(null);if(token)api('reiniciar',{}).then(enviarEstado).catch(function(){})};
 cfg.addEventListener('click',function(e){e.stopPropagation();if(e.target===cfg)cfg.classList.remove('on')});
 setInterval(leer,1000);setInterval(enviarEstado,8000)}

/* índice para saltar a cualquier diapositiva */
var indice=$('indice');
function abrirIndice(){var l=$('indiceLista');l.textContent='';slides.forEach(function(s,i){var b=document.createElement('button'),n=document.createElement('b'),t=document.createElement('span');b.type='button';n.textContent=('0'+(i+1)).slice(-2);t.textContent=s.dataset.titulo||'';b.appendChild(n);b.appendChild(t);if(i===cur)b.className='act';b.onclick=function(){indice.classList.remove('on');go(i)};l.appendChild(b)});indice.classList.add('on')}
indice.addEventListener('click',function(e){e.stopPropagation();if(e.target===indice)indice.classList.remove('on')});
$('num').addEventListener('click',function(e){e.stopPropagation();abrirIndice()});

/* navegación */
function applyStep(){var s=slides[cur];cada('.f',function(e){e.classList.toggle('on',+e.dataset.f<=step)},s);reportar()}
function cambiar(n,st){slides[cur].classList.remove('active');cur=n;step=st||0;var s=slides[cur];s.classList.add('active');
 typeK(s);cada('canvas.puntitos',puntos,s);contar(s);ajustar(s);applyStep();
 $('num').textContent=('0'+(cur+1)).slice(-2)+' / '+('0'+slides.length).slice(-2);
 $('prog').style.width=((cur+1)/slides.length*100)+'%';
 $('nt').textContent='Diapositiva '+(cur+1)+' de '+slides.length;$('nx').textContent=s.dataset.notes||'Sin notas en esta diapositiva.';
 $('nsig').textContent=cur<slides.length-1?'Sigue: '+(slides[cur+1].dataset.titulo||''):'Última diapositiva';
 leer();try{history.replaceState(null,'','#'+(cur+1))}catch(e){}}
var enCurso=null;
function terminar(){if(!enCurso)return;var x=enCurso;enCurso=null;clearTimeout(x.t);x.f()}
function go(n,st){n=Math.max(0,Math.min(slides.length-1,n));terminar();if(n===cur){step=st||0;applyStep();return}
 if(calma||document.hidden||Math.abs(n-cur)>1){cambiar(n,st);return}
 var sale=slides[cur];sale.classList.add('sale');enCurso={t:setTimeout(terminar,290),f:function(){sale.classList.remove('sale');cambiar(n,st)}}}
function next(){terminar();if(cur===0&&step===0&&!relojInicio)iniciarReloj();var max=+(slides[cur].dataset.steps||0);if(step<max){step++;applyStep()}else if(cur<slides.length-1)go(cur+1)}
function prev(){terminar();if(step>0){step--;applyStep()}else if(cur>0)go(cur-1,+(slides[cur-1].dataset.steps||0))}
window.__go=go;window.__estado=function(){return {cur:cur+1,step:step,total:slides.length}};
var t0=relojInicio||Date.now();
function capaAbierta(){return document.querySelector('.capa.on')}
addEventListener('keydown',function(e){var c=capaAbierta();if(c){if(e.key==='Escape')c.classList.remove('on');return}
 if(e.metaKey||e.ctrlKey||e.altKey)return;
 if(/^(INPUT|TEXTAREA)$/.test(e.target.tagName))return;
 var k=e.key;
 if(['ArrowRight','ArrowDown','PageDown',' ','Enter'].indexOf(k)>=0){e.preventDefault();next()}
 else if(['ArrowLeft','ArrowUp','PageUp','Backspace'].indexOf(k)>=0){e.preventDefault();prev()}
 else if(k==='Home')go(0);else if(k==='End')go(slides.length-1);
 else if(k==='f'||k==='F'){if(document.fullscreenElement)document.exitFullscreen();else if(document.documentElement.requestFullscreen)document.documentElement.requestFullscreen().catch(function(){})}
 else if(k==='n'||k==='N'){var nn=$('notes');nn.style.display=nn.style.display==='block'?'none':'block'}
 else if(k==='g'||k==='G')abrirIndice();
 else if(k==='c'||k==='C')abrirCfg();
 else if(k==='t'||k==='T'){relojInicio=Date.now();LS.set('reloj',relojInicio);t0=relojInicio;reportar()}
 else if(k==='b'||k==='B'||k==='.')$('blanco').classList.toggle('on')});
$('viewport').addEventListener('click',function(e){if(e.target.closest('input,label,button,a,.tally,.capa'))return;next()});
var tx=null;
addEventListener('touchstart',function(e){tx=e.touches.length===1?e.touches[0].clientX:null},{passive:true});
addEventListener('touchend',function(e){if(tx===null||capaAbierta())return;var d=e.changedTouches[0].clientX-tx;tx=null;if(d>60)prev();else if(d<-60)next()},{passive:true});
addEventListener('beforeprint',function(){cada('.kicker[data-text]',function(k){k.textContent=k.dataset.text})});
setInterval(function(){var s=Math.floor((Date.now()-t0)/1000);$('clock').textContent=('0'+Math.floor(s/60)).slice(-2)+':'+('0'+s%60).slice(-2)},1000);
setTimeout(function(){$('help').style.opacity=0},7000);
var hh=parseInt(location.hash.slice(1),10);cur=isNaN(hh)?0:Math.max(0,Math.min(slides.length-1,hh-1));cambiar(cur,0);
if(VIVO){conectar();estadoCfg()}
})();
