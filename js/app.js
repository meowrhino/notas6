/*
 * notas6 — app
 * río de fichas por fecha (agrupadas por mes con encabezado pegajoso),
 * pestañas de categoría, scrubber de tiempo fino, búsqueda full-text,
 * lector (diálogo modal). Navegación por teclado + a11y.
 */
import { CATS, NOTAS } from './notas.js';

const COL = {
  diario:'#e5897e', essays:'#8aa9d6', work:'#a9c47e', dolor:'#e0a075',
  comentarios:'#7fc9b2', '!':'#eccb86', demos:'#b8a6dc', 'sueños':'#d6c0e2',
  'new lemuria':'#90c6cb', '?':'#dca7bd', songs:'#92bcd6', main:'#d4c98f',
};
const col = c => COL[c] || '#d8cdb2';
const MESES = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
const MES_LARGO = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

// PIEZA Nº — folio estable (la nota más antigua = Nº001).
const PIEZA = new Map(NOTAS.map((n,i)=>[n.id, String(NOTAS.length-i).padStart(3,'0')]));

const $ = id => document.getElementById(id);
const appEl = $('app');
const rio = $('rio'), tabsEl = $('tabs'), idx = $('idx');
const buscar = $('buscar'), res = $('res'), sub = $('sub');
const lector = $('lector'), hoja = $('hoja'), hojaWrap = $('hoja-wrap');
const lPrev = $('lector-prev'), lNext = $('lector-next'), lCopy = $('lector-copy'), atmos = $('atmos');

let activeCat = null, query = '', lista = NOTAS;
let cur = -1, curOpen = -1, prevFocus = null, pushedByOpen = false;
let fichaEls = [], offs = [], thumb = null;

// ── utilidades ──
const strip = s => s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const escAttr = s => esc(s).replace(/"/g,'&quot;');
const qesc = s => s.replace(/"/g,'&quot;');

NOTAS.forEach(n => { n._s = strip((n.titulo||'') + '\n' + (n.preview||'') + '\n' + (n.texto||'')); });

function accentRe(q){
  const e = strip(q).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
    .replace(/a/g,'[aáàäâ]').replace(/e/g,'[eéèëê]').replace(/i/g,'[iíìïî]')
    .replace(/o/g,'[oóòöô]').replace(/u/g,'[uúùüû]').replace(/n/g,'[nñ]');
  return new RegExp('('+e+')','gi');
}
function hl(text, q){
  if(!q) return esc(text);
  const re = accentRe(q); re.lastIndex = 0;
  let out = '', last = 0, m;
  while((m = re.exec(text)) !== null){
    out += esc(text.slice(last, m.index)) + '<mark>' + esc(m[0]) + '</mark>';
    last = m.index + m[0].length;
    if(m[0].length === 0) re.lastIndex++;
  }
  return out + esc(text.slice(last));
}

function stampText(n){ const [Y,M,D]=n.iso.split('-'); return `${D} ${MESES[+M-1]} ${Y.slice(2)} · ${n.hora}`; }
function stampRot(n){ return (parseInt(n.id.slice(0,4),16) % 7) - 3; }   // -3..3, sutil
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
function mesLabel(iso){ const [Y,M]=iso.split('-'); return `${MES_LARGO[+M-1]} ${Y}`; }

// ── pestañas de categoría (filtro) ──
function renderTabs(){
  const orden = Object.entries(CATS).sort((a,b)=>b[1]-a[1]);
  tabsEl.innerHTML = orden.map(([c,n])=>
    `<button class="tab" type="button" data-cat="${escAttr(c)}" aria-pressed="false" aria-label="filtrar por ${escAttr(c)} (${n} notas)" style="background:${col(c)}">${esc(c)}<span class="c">${n}</span></button>`
  ).join('');
}
tabsEl.addEventListener('click', e=>{
  const t = e.target.closest('.tab'); if(!t) return;
  activeCat = (activeCat === t.dataset.cat) ? null : t.dataset.cat;
  [...tabsEl.children].forEach(x=>{
    const on = x.dataset.cat === activeCat;
    x.classList.toggle('off', activeCat && !on);
    x.setAttribute('aria-pressed', String(on));
  });
  render();
});

// ── filtrado ──
function filtrar(){
  let l = NOTAS;
  if(activeCat) l = l.filter(n=>n.cats.includes(activeCat));
  if(query){ const q = strip(query); l = l.filter(n => n._s.includes(q)); }
  return l;
}

// ── río de fichas (agrupadas por mes) ──
function render(){
  lista = filtrar();
  cur = -1;
  res.textContent = (query||activeCat) ? `${lista.length} piezas` : '';
  sub.textContent = `${lista.length} piezas · por fecha`;

  if(!lista.length){ rio.innerHTML = '<div class="vacio">— sin pruebas —</div>'; idx.innerHTML=''; fichaEls=[]; return; }

  const count = {};
  lista.forEach(n=>{ const ym=n.iso.slice(0,7); count[ym]=(count[ym]||0)+1; });

  let html='', prevYM=null;
  lista.forEach((n,i)=>{
    const ym = n.iso.slice(0,7);
    if(ym !== prevYM){ prevYM = ym; html += `<div class="mes">${mesLabel(n.iso)}<span class="n">${count[ym]}</span></div>`; }
    html += `<article class="ficha" data-id="${n.id}" style="--i:${i}" tabindex="0" role="button" aria-label="Pieza ${PIEZA.get(n.id)}: ${escAttr(n.titulo)} — ${escAttr(stampText(n))}">
      <div class="top">
        <div class="topleft"><span class="pieza">Nº ${PIEZA.get(n.id)}</span><div class="cats">${catsHtml(n.cats)}</div></div>
        ${stampHtml(n)}
      </div>
      <h3 class="ttl">${hl(n.titulo, query)}</h3>
      ${n.preview ? `<p class="pv">${hl(n.preview, query)}</p>` : ''}
      ${badgesHtml(n)}
    </article>`;
  });
  rio.innerHTML = html;
  fichaEls = [...rio.querySelectorAll('.ficha')];
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
  i = Math.max(0, Math.min(i, fichaEls.length-1));
  cur = i;
  const el = fichaEls[i]; if(!el) return;
  fichaEls.forEach(c=>c.classList.remove('sel'));
  el.classList.add('sel');
  el.scrollIntoView({block:'nearest'});
  el.focus({preventScroll:true});
}
document.addEventListener('keydown', e=>{
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
      [...tabsEl.children].forEach(x=>{ x.classList.remove('off'); x.setAttribute('aria-pressed','false'); });
      render(); }
    return;
  }
  if(e.key==='j'||e.key==='ArrowDown'){ e.preventDefault(); selFicha((cur<0?-1:cur)+1); }
  else if(e.key==='k'||e.key==='ArrowUp'){ e.preventDefault(); selFicha((cur<0?0:cur)-1); }
  else if(e.key==='Enter' && cur>=0){ abrir(lista[cur].id); }
});

// ── scrubber de tiempo (fino tipo barra) ──
function buildIdx(){
  offs = fichaEls.map(el=>el.offsetTop);
  if(!fichaEls.length){ idx.innerHTML=''; thumb=null; return; }
  const SH = rio.scrollHeight || 1;
  const seen = new Set();
  let years = '';
  fichaEls.forEach((el,i)=>{
    const y = lista[i].iso.slice(0,4);
    if(!seen.has(y)){ seen.add(y);
      const top = Math.min(96, (el.offsetTop / SH) * 100);
      years += `<span class="idx-year" style="top:${top.toFixed(1)}%">'${y.slice(2)}</span>`;
    }
  });
  idx.innerHTML = `<div class="idx-track"></div>${years}<div class="idx-thumb" id="idx-thumb"><span></span></div>`;
  thumb = $('idx-thumb');
  syncIdx();
}
function syncIdx(){
  if(!fichaEls.length || !thumb) return;
  const SH = rio.scrollHeight || 1, vh = rio.clientHeight, trackH = idx.clientHeight;
  const th = Math.max(30, vh / SH * trackH);
  thumb.style.height = th + 'px';
  thumb.style.top = Math.min(trackH - th, (rio.scrollTop / SH) * trackH) + 'px';
  let i = 0; const st = rio.scrollTop;
  for(let k=0;k<offs.length;k++){ if(offs[k] <= st+4) i=k; else break; }
  const iso = lista[i] && lista[i].iso;
  if(iso){ const [Y,M] = iso.split('-'); thumb.firstChild.textContent = `${MES_LARGO[+M-1]} '${Y.slice(2)}`; }
}
let raf;
rio.addEventListener('scroll', ()=>{ if(raf) return; raf=requestAnimationFrame(()=>{ syncIdx(); raf=0; }); });
let drag=false;
function jumpY(clientY){
  const r = idx.getBoundingClientRect();
  const frac = Math.max(0, Math.min(1, (clientY-r.top)/r.height));
  rio.scrollTop = frac * rio.scrollHeight;
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
    .replace(/^- \[ \]\s?/,'☐ ').replace(/^- \[x\]\s?/i,'☑ ').replace(/^[-*] /,'• ')
    .replace(/!\[[^\]]*\]\(([^)]+)\)/g, (_,src)=>`<img src="${qesc(src)}" loading="lazy">`)
    .replace(/\[([^\]]+)\]\(([^)]+\.(?:mp4|mov|webm))\)/gi, (_,t,src)=>`<video src="${qesc(src)}" controls playsinline preload="metadata"></video>`)
    .replace(/\[([^\]]+)\]\(([^)]+\.(?:m4a|mp3|ogg|wav|flac))\)/gi, (_,t,src)=>`<audio src="${qesc(src)}" controls></audio>`)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_,t,u)=>`<a href="${qesc(u)}" target="_blank" rel="noopener">${t}</a>`)
    .replace(/(?<![">=\]\/])(https?:\/\/[^\s<)]+[^\s<).,;:!?])/g, m=>`<a href="${qesc(m)}" target="_blank" rel="noopener">${m}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|\s)\*([^*\n]+)\*/g, '$1<em>$2</em>');
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

// ── lector (diálogo modal) ──
function abrir(id){
  const n = NOTAS.find(x=>x.id===id); if(!n) return;
  const wasOpen = !lector.classList.contains('hidden');
  if(!wasOpen){ prevFocus = document.activeElement; appEl.inert = true; }
  curOpen = lista.findIndex(x=>x.id===id);

  $('lector-cats').innerHTML = catsHtml(n.cats);
  const st = $('lector-stamp'); st.textContent = stampText(n); st.style.transform = `rotate(${stampRot(n)}deg)`;
  lector.setAttribute('aria-label', `Pieza Nº ${PIEZA.get(n.id)}: ${n.titulo}`);

  const adj = [n.links&&'LNK', n.img&&'IMG', n.video&&'VID', n.audio&&'AUD'].filter(Boolean).join(' ') || '—';
  const caso = `EXP6·${n.iso.slice(0,7)}·${n.id.slice(0,4).toUpperCase()}`;
  hoja.innerHTML =
    `<div class="informe">`
    + `<div><b>CASO</b> ${esc(caso)}</div>`
    + `<div><b>PIEZA</b> Nº ${PIEZA.get(n.id)}</div>`
    + `<div><b>APERTURA</b> ${esc(n.dia)} ${esc(n.fecha)} · ${esc(n.hora)}</div>`
    + `<div><b>CLASIF.</b> ${esc(n.cats.join(' / '))}</div>`
    + `<div><b>ADJUNTOS</b> ${adj}</div>`
    + `</div>` + mdToHtml(n.texto);
  hojaWrap.scrollTop = 0;
  lector.classList.remove('hidden');
  updateNav();
  if(!wasOpen) lector.focus();

  if(location.hash !== '#'+id){
    if(wasOpen) history.replaceState(null,'','#'+id);
    else { history.pushState(null,'','#'+id); pushedByOpen = true; }
  }
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
function cerrarUI(){
  if(lector.classList.contains('hidden')) return;
  lector.classList.add('hidden');
  appEl.inert = false;
  if(prevFocus && prevFocus.focus) prevFocus.focus();
  prevFocus = null;
}
function cerrar(){
  if(lector.classList.contains('hidden')) return;
  cerrarUI();
  if(pushedByOpen){ pushedByOpen = false; history.back(); }
  else if(location.hash){ history.replaceState(null,'',location.pathname+location.search); }
}
$('cerrar').addEventListener('click', cerrar);
lPrev.addEventListener('click', ()=>navLector(-1));
lNext.addEventListener('click', ()=>navLector(1));
lCopy.addEventListener('click', ()=>{
  if(curOpen<0 || !navigator.clipboard) return;
  navigator.clipboard.writeText(location.origin+location.pathname+'#'+lista[curOpen].id)
    .then(()=>{ const t=lCopy.textContent; lCopy.textContent='copiado ✓'; setTimeout(()=>lCopy.textContent=t,1200); });
});
window.addEventListener('popstate', ()=>{
  const id = location.hash.slice(1);
  if(id && NOTAS.find(x=>x.id===id)) abrir(id);
  else { pushedByOpen = false; cerrarUI(); }
});

// ── toggle de atmósfera selvática ──
function syncAtmos(){ atmos.setAttribute('aria-pressed', String(!document.body.classList.contains('sin-atmosfera'))); }
if(localStorage.getItem('n6-sin-atmosfera') !== '0') document.body.classList.add('sin-atmosfera'); // por defecto: limpio
syncAtmos();
atmos.addEventListener('click', ()=>{
  const off = document.body.classList.toggle('sin-atmosfera');
  localStorage.setItem('n6-sin-atmosfera', off ? '1' : '0');
  syncAtmos();
});

// ── init ──
if('scrollRestoration' in history) history.scrollRestoration = 'manual';
renderTabs();
render();
const startId = location.hash.slice(1);
if(startId && NOTAS.find(x=>x.id===startId)) abrir(startId);
