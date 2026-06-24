/*
 * notas6 — app
 * expediente: un río de fichas por fecha de creación (lo nuevo arriba),
 * pestañas de categoría, histograma de actividad, búsqueda full-text,
 * lector (hoja mecanografiada con cabecera de informe), atmósfera selvática.
 */
import { CATS, NOTAS } from './notas.js';

const COL = {
  diario:'#d8584f', essays:'#5a83b8', work:'#7aa23c', dolor:'#cf6a2e',
  comentarios:'#3aa78a', '!':'#e3a23a', demos:'#9079c4', 'sueños':'#c0a0d6',
  'new lemuria':'#5fa8b0', '?':'#cf7f9e', songs:'#5a9ec4', main:'#bba63f',
};
const col = c => COL[c] || '#cdbf99';
const MESES = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

// PIEZA Nº — folio de cadena de custodia, estable (orden global, no cambia al filtrar).
// NOTAS va nuevo→viejo, así la nota más ANTIGUA es la Nº001.
const PIEZA = new Map(NOTAS.map((n,i)=>[n.id, String(NOTAS.length-i).padStart(3,'0')]));

const $ = id => document.getElementById(id);
const rio = $('rio'), tabsEl = $('tabs'), idx = $('idx');
const buscar = $('buscar'), res = $('res'), sub = $('sub');
const lector = $('lector'), hoja = $('hoja'), hojaWrap = $('hoja-wrap');
const lPrev = $('lector-prev'), lNext = $('lector-next'), lCopy = $('lector-copy'), atmos = $('atmos');

let activeCat = null, query = '', lista = NOTAS;
let cur = -1;       // ficha seleccionada por teclado (índice en lista)
let curOpen = -1;   // nota abierta en el lector (índice en lista)

// ── utilidades ──
const strip = s => s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const escAttr = s => esc(s).replace(/"/g,'&quot;');

function accentRe(q){
  const e = strip(q).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
    .replace(/a/g,'[aáàäâ]').replace(/e/g,'[eéèëê]').replace(/i/g,'[iíìïî]')
    .replace(/o/g,'[oóòöô]').replace(/u/g,'[uúùüû]').replace(/n/g,'[nñ]');
  return new RegExp('('+e+')','gi');
}
function hl(text, q){ return q ? esc(text).replace(accentRe(q),'<mark>$1</mark>') : esc(text); }

function stampText(n){ const [Y,M,D]=n.iso.split('-'); return `${D} ${MESES[+M-1]} ${Y.slice(2)} · ${n.hora}`; }
function stampRot(n){ return (parseInt(n.id.slice(0,4),16) % 15) - 7; }
function stampHtml(n){ return `<div class="stamp" style="transform:rotate(${stampRot(n)}deg)">${stampText(n)}</div>`; }
function catsHtml(cats){ return cats.map(c=>`<span class="fctab" style="background:${col(c)}">${c}</span>`).join(''); }
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
    l = l.filter(n => strip(n.titulo).includes(q) || strip(n.preview).includes(q) || strip(n.texto).includes(q));
  }
  return l;
}

// ── río de fichas ──
function render(){
  lista = filtrar();
  cur = -1;
  res.textContent = (query||activeCat) ? `${lista.length}` : '';
  sub.textContent = `expediente nº6 · ${lista.length} piezas · por fecha`;

  if(!lista.length){ rio.innerHTML = '<div class="vacio">— sin pruebas —</div>'; idx.innerHTML=''; return; }

  rio.innerHTML = lista.map((n,i)=>`
    <div class="ficha" data-id="${n.id}" style="--i:${i}" tabindex="0" role="button" aria-label="Pieza ${PIEZA.get(n.id)}: ${escAttr(n.titulo)} — ${stampText(n)}">
      <span class="punch"></span>
      <div class="top">
        <div class="topleft"><span class="pieza">Nº ${PIEZA.get(n.id)}</span><div class="cats">${catsHtml(n.cats)}</div></div>
        ${stampHtml(n)}
      </div>
      <div class="ttl">${hl(n.titulo, query)}</div>
      ${n.preview ? `<div class="pv">${hl(n.preview, query)}</div>` : ''}
      ${badgesHtml(n)}
    </div>`).join('');

  rio.scrollTop = 0;
  requestAnimationFrame(buildIdx);
}
rio.addEventListener('click', e=>{ const f=e.target.closest('.ficha'); if(f) abrir(f.dataset.id); });
rio.addEventListener('keydown', e=>{
  const f=e.target.closest('.ficha'); if(!f) return;
  if(e.key==='Enter'||e.key===' '){ e.preventDefault(); abrir(f.dataset.id); }
});

// ── búsqueda ──
let tBuscar;
buscar.addEventListener('input', ()=>{
  clearTimeout(tBuscar);
  tBuscar = setTimeout(()=>{ query = buscar.value.trim(); render(); }, 90);
});

// ── navegación por teclado en el río ──
function selFicha(i){
  i = Math.max(0, Math.min(i, lista.length-1));
  cur = i;
  const el = rio.children[i]; if(!el) return;
  [...rio.children].forEach(c=>c.classList.remove('sel'));
  el.classList.add('sel');
  el.scrollIntoView({block:'nearest'});
  el.focus({preventScroll:true});
}
document.addEventListener('keydown', e=>{
  // lector abierto: ← → pasan de pieza, Esc cierra
  if(!lector.classList.contains('hidden')){
    if(e.key==='Escape') cerrar();
    else if(e.key==='ArrowRight') navLector(1);
    else if(e.key==='ArrowLeft') navLector(-1);
    return;
  }
  if(document.activeElement === buscar){ if(e.key==='Escape') buscar.blur(); return; }
  if(e.key==='/'){ e.preventDefault(); buscar.focus(); return; }
  if(e.key==='Escape'){
    if(activeCat||query){ activeCat=null; query=''; buscar.value='';
      [...tabsEl.children].forEach(x=>x.classList.remove('off')); render(); }
    return;
  }
  if(e.key==='j'||e.key==='ArrowDown'){ e.preventDefault(); selFicha((cur<0?-1:cur)+1); }
  else if(e.key==='k'||e.key==='ArrowUp'){ e.preventDefault(); selFicha((cur<0?0:cur)-1); }
  else if(e.key==='Enter' && cur>=0){ abrir(lista[cur].id); }
});

// ── histograma de actividad por mes ──
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
    row.innerHTML = `<span class="mbar" style="width:${Math.max(7,Math.round(cnt[ym]/max*100))}%"></span><span class="mlbl">${lbl}</span>`;
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

// ── markdown → html ──
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
      html += `<h${Math.min(3,m[1].length)}>${inline(m[2])}</h${Math.min(3,m[1].length)}>`;
    } else if(!l.trim()){ flush(); }
    else { buf.push(inline(l)); }
  }
  flush();
  return html;
}

// ── lector ──
function abrir(id){
  const n = NOTAS.find(x=>x.id===id); if(!n) return;
  curOpen = lista.findIndex(x=>x.id===id);
  $('lector-cats').innerHTML = catsHtml(n.cats);
  const st = $('lector-stamp'); st.textContent = stampText(n); st.style.transform = `rotate(${stampRot(n)}deg)`;

  const adj = [n.links&&'LNK', n.img&&'IMG', n.video&&'VID', n.audio&&'AUD'].filter(Boolean).join(' ') || '—';
  const caso = `EXP6·${n.iso.slice(0,7)}·${n.id.slice(0,4).toUpperCase()}`;
  hoja.innerHTML =
    `<div class="informe">`
    + `<div><b>CASO</b> ${caso}</div>`
    + `<div><b>PIEZA</b> Nº ${PIEZA.get(n.id)}</div>`
    + `<div><b>APERTURA</b> ${n.dia} ${n.fecha} · ${n.hora}</div>`
    + `<div><b>CLASIF.</b> ${esc(n.cats.join(' / '))}</div>`
    + `<div><b>ADJUNTOS</b> ${adj}</div>`
    + `</div>` + mdToHtml(n.texto);
  hojaWrap.scrollTop = 0;
  lector.classList.remove('hidden');
  updateNav();
  if(location.hash !== '#'+id) history.pushState(null,'','#'+id);
}
function updateNav(){
  lPrev.disabled = !(curOpen > 0);
  lNext.disabled = !(curOpen >= 0 && curOpen < lista.length-1);
}
function navLector(d){
  if(curOpen < 0) return;
  const i = curOpen + d;
  if(i>=0 && i<lista.length) abrir(lista[i].id);
}
function cerrar(){
  lector.classList.add('hidden');
  if(location.hash) history.pushState(null,'',location.pathname+location.search);
}
$('cerrar').addEventListener('click', cerrar);
lPrev.addEventListener('click', ()=>navLector(-1));   // anterior = más nueva (arriba)
lNext.addEventListener('click', ()=>navLector(1));    // siguiente = más antigua (abajo)
lCopy.addEventListener('click', ()=>{
  if(curOpen<0 || !navigator.clipboard) return;
  navigator.clipboard.writeText(location.origin+location.pathname+'#'+lista[curOpen].id)
    .then(()=>{ const t=lCopy.textContent; lCopy.textContent='copiado ✓'; setTimeout(()=>lCopy.textContent=t,1200); });
});
window.addEventListener('popstate', ()=>{
  const id = location.hash.slice(1);
  if(id && NOTAS.find(x=>x.id===id)) abrir(id); else cerrar();
});

// ── toggle de atmósfera selvática ──
if(localStorage.getItem('n6-sin-atmosfera')==='1') document.body.classList.add('sin-atmosfera');
atmos.addEventListener('click', ()=>{
  const off = document.body.classList.toggle('sin-atmosfera');
  localStorage.setItem('n6-sin-atmosfera', off ? '1' : '0');
});

// ── init ──
if('scrollRestoration' in history) history.scrollRestoration = 'manual';
renderTabs();
render();
const startId = location.hash.slice(1);
if(startId && NOTAS.find(x=>x.id===startId)) abrir(startId);
