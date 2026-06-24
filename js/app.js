/*
 * notas6 — app
 * expediente: un río de fichas por fecha de creación (lo nuevo arriba),
 * pestañas de categoría para filtrar, histograma de actividad a la derecha,
 * búsqueda full-text, y lector a página entera (hoja mecanografiada).
 */
import { CATS, NOTAS } from './notas.js';

// ── colores de categoría (pestañas de archivo) ──
const COL = {
  diario:'#d8584f', essays:'#5a83b8', work:'#7aa23c', dolor:'#cf6a2e',
  comentarios:'#3aa78a', '!':'#e3a23a', demos:'#9079c4', 'sueños':'#c0a0d6',
  'new lemuria':'#5fa8b0', '?':'#cf7f9e', songs:'#5a9ec4', main:'#bba63f',
};
const col = c => COL[c] || '#cdbf99';
const MESES = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

// ── refs ──
const $ = id => document.getElementById(id);
const rio = $('rio'), tabsEl = $('tabs'), idx = $('idx');
const buscar = $('buscar'), res = $('res'), sub = $('sub');
const lector = $('lector'), hoja = $('hoja'), hojaWrap = $('hoja-wrap');

// ── estado ──
let activeCat = null;
let query = '';
let lista = NOTAS;          // notas actualmente mostradas

// ── utilidades ──
const strip = s => s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function accentRe(q){
  const e = strip(q).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
    .replace(/a/g,'[aáàäâ]').replace(/e/g,'[eéèëê]').replace(/i/g,'[iíìïî]')
    .replace(/o/g,'[oóòöô]').replace(/u/g,'[uúùüû]').replace(/n/g,'[nñ]');
  return new RegExp('('+e+')','gi');
}
function hl(text, q){
  if(!q) return esc(text);
  return esc(text).replace(accentRe(q),'<mark>$1</mark>');
}

// sello: fecha + hora en UNA línea, rotación estable por nota (-7..+7)
function stampText(n){ const [Y,M,D]=n.iso.split('-'); return `${D} ${MESES[+M-1]} ${Y.slice(2)} · ${n.hora}`; }
function stampRot(n){ return (parseInt(n.id.slice(0,4),16) % 15) - 7; }
function stampHtml(n){ return `<div class="stamp" style="transform:rotate(${stampRot(n)}deg)">${stampText(n)}</div>`; }

function catsHtml(cats){
  return cats.map(c=>`<span class="fctab" style="background:${col(c)}">${c}</span>`).join('');
}
function badgesHtml(n){
  let b='';
  if(n.links) b+='<span class="badge">LNK</span>';
  if(n.img)   b+='<span class="badge">IMG</span>';
  if(n.video) b+='<span class="badge">VID</span>';
  if(n.audio) b+='<span class="badge">AUD</span>';
  return b ? `<div class="badges">${b}</div>` : '';
}

// ── pestañas de categoría (filtro) ──
function renderTabs(){
  const orden = Object.entries(CATS).sort((a,b)=>b[1]-a[1]);
  tabsEl.innerHTML = orden.map(([c,n])=>
    `<span class="tab" data-cat="${c}" style="background:${col(c)}">${c}<span class="c">${n}</span></span>`
  ).join('');
}
tabsEl.addEventListener('click', e=>{
  const t = e.target.closest('.tab'); if(!t) return;
  activeCat = (activeCat === t.dataset.cat) ? null : t.dataset.cat;
  [...tabsEl.children].forEach(x=>x.classList.toggle('off', activeCat && x.dataset.cat!==activeCat));
  render();
});

// ── filtrado ──
function filtrar(){
  let l = NOTAS;
  if(activeCat) l = l.filter(n=>n.cats.includes(activeCat));
  if(query){
    const q = strip(query);
    l = l.filter(n =>
      strip(n.titulo).includes(q) || strip(n.preview).includes(q) || strip(n.texto).includes(q));
  }
  return l;
}

// ── río de fichas ──
function render(){
  lista = filtrar();
  res.textContent = (query||activeCat) ? `${lista.length}` : '';
  sub.textContent = `expediente nº6 · ${lista.length} piezas · por fecha`;

  if(!lista.length){ rio.innerHTML = '<div class="vacio">— sin pruebas —</div>'; idx.innerHTML=''; return; }

  rio.innerHTML = lista.map(n=>`
    <div class="ficha" data-id="${n.id}">
      <span class="punch"></span>
      <div class="top">
        <div class="cats">${catsHtml(n.cats)}</div>
        ${stampHtml(n)}
      </div>
      <div class="ttl">${hl(n.titulo, query)}</div>
      ${n.preview ? `<div class="pv">${hl(n.preview, query)}</div>` : ''}
      ${badgesHtml(n)}
    </div>`).join('');

  rio.scrollTop = 0;
  requestAnimationFrame(buildIdx);
}
rio.addEventListener('click', e=>{
  const f = e.target.closest('.ficha'); if(!f) return;
  abrir(f.dataset.id);
});

// ── búsqueda ──
let tBuscar;
buscar.addEventListener('input', ()=>{
  clearTimeout(tBuscar);
  tBuscar = setTimeout(()=>{ query = buscar.value.trim(); render(); }, 90);
});

// ── histograma de actividad por mes (cajón índice) ──
// cada mes = una barra cuya longitud es el nº de notas; arrastra/clica para saltar.
let monthRows = [], offs = [];
function buildIdx(){
  idx.innerHTML = '';
  monthRows = [];
  offs = [...rio.children].map(el=>el.offsetTop);
  if(!lista.length) return;

  const order=[], cnt={}, first={};
  lista.forEach((n,i)=>{ const ym=n.iso.slice(0,7);
    if(!(ym in cnt)){ cnt[ym]=0; order.push(ym); first[ym]=i; } cnt[ym]++; });
  const max = Math.max(...order.map(ym=>cnt[ym]));

  let prevY = null;
  order.forEach(ym=>{
    const [Y,M] = ym.split('-');
    const lbl = MESES[+M-1].toLowerCase() + (Y!==prevY ? " '"+Y.slice(2) : '');
    prevY = Y;
    const row = document.createElement('div');
    row.className = 'mrow'; row.dataset.ym = ym; row.dataset.i = first[ym];
    row.title = `${cnt[ym]} nota${cnt[ym]>1?'s':''} · ${MESES[+M-1].toLowerCase()} ${Y}`;
    row.innerHTML = `<span class="mbar" style="width:${Math.max(7,Math.round(cnt[ym]/max*100))}%"></span>`
                  + `<span class="mlbl">${lbl}</span>`;
    idx.appendChild(row);
    monthRows.push({ym, i:first[ym]});
  });
  syncIdx();
}
function jumpToIdx(i){ const el = rio.children[i]; if(el) rio.scrollTop = Math.max(0, el.offsetTop - 6); }
function syncIdx(){
  if(!lista.length || !rio.children.length) return;
  const st = rio.scrollTop; let top=0;
  for(let k=0;k<offs.length;k++){ if(offs[k] <= st+4) top=k; else break; }
  const ym = lista[top] && lista[top].iso.slice(0,7);
  [...idx.children].forEach(r=>r.classList.toggle('on', r.dataset.ym===ym));
}
let raf;
rio.addEventListener('scroll', ()=>{ if(raf) return; raf=requestAnimationFrame(()=>{ syncIdx(); raf=0; }); });

let drag=false;
function jumpY(clientY){
  if(!monthRows.length) return;
  const r = idx.getBoundingClientRect();
  const frac = Math.max(0, Math.min(.999, (clientY-r.top)/r.height));
  jumpToIdx(monthRows[Math.floor(frac*monthRows.length)].i);
}
idx.addEventListener('mousedown', e=>{ drag=true; jumpY(e.clientY); });
window.addEventListener('mousemove', e=>{ if(drag) jumpY(e.clientY); });
window.addEventListener('mouseup', ()=>{ drag=false; });
idx.addEventListener('touchstart', e=>{ jumpY(e.touches[0].clientY); }, {passive:true});
idx.addEventListener('touchmove',  e=>{ jumpY(e.touches[0].clientY); }, {passive:true});
window.addEventListener('resize', ()=>requestAnimationFrame(buildIdx));

// ── markdown → html (hoja) ──
function inline(s){
  return s
    .replace(/!\[[^\]]*\]\(([^)]+)\)/g, (_,src)=>`<img src="${src}" loading="lazy">`)
    .replace(/\[([^\]]+)\]\(([^)]+\.(?:mp4|mov|webm))\)/gi, (_,t,src)=>`<video src="${src}" controls playsinline preload="metadata"></video>`)
    .replace(/\[([^\]]+)\]\(([^)]+\.(?:m4a|mp3|ogg|wav|flac))\)/gi, (_,t,src)=>`<audio src="${src}" controls></audio>`)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/(?<![">=\]\/])(https?:\/\/[^\s<)]+[^\s<).,;:!?])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|\s)\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/^- \[ \]\s?/,'☐ ').replace(/^- \[x\]\s?/i,'☑ ').replace(/^[-*] /,'• ');
}
function mdToHtml(md){
  const lines = esc(md).split('\n');
  let html='', buf=[];
  const flush=()=>{ if(buf.length){ html+='<p>'+buf.join('\n')+'</p>'; buf=[]; } };
  for(const raw of lines){
    const l = raw.replace(/\r$/,'');
    if(/^#{1,6}\s/.test(l.trim())){
      flush();
      const m = l.trim().match(/^(#{1,6})\s+(.*)$/);
      const lvl = Math.min(3, m[1].length);
      html += `<h${lvl}>${inline(m[2])}</h${lvl}>`;
    } else if(!l.trim()){
      flush();
    } else {
      buf.push(inline(l));
    }
  }
  flush();
  return html;
}

// ── lector ──
function abrir(id){
  const n = NOTAS.find(x=>x.id===id); if(!n) return;
  $('lector-cats').innerHTML = catsHtml(n.cats);
  const st = $('lector-stamp');
  st.textContent = stampText(n);
  st.style.transform = `rotate(${stampRot(n)}deg)`;
  hoja.innerHTML = `<div class="meta">${n.dia} · ${n.fecha} · ${n.hora} · ${n.cats.join(' / ')}</div>` + mdToHtml(n.texto);
  hojaWrap.scrollTop = 0;
  lector.classList.remove('hidden');
  if(location.hash !== '#'+id) history.pushState(null,'','#'+id);
}
function cerrar(){
  lector.classList.add('hidden');
  if(location.hash) history.pushState(null,'',location.pathname+location.search);
}
$('cerrar').addEventListener('click', cerrar);
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && !lector.classList.contains('hidden')) cerrar(); });
window.addEventListener('popstate', ()=>{
  const id = location.hash.slice(1);
  if(id && NOTAS.find(x=>x.id===id)) abrir(id); else cerrar();
});

// ── init ──
if('scrollRestoration' in history) history.scrollRestoration = 'manual';
renderTabs();
render();
const startId = location.hash.slice(1);
if(startId && NOTAS.find(x=>x.id===startId)) abrir(startId);
