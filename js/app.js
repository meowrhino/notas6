/*
 * notas6 — app
 * expediente: río de fichas por fecha de creación, pestañas de categoría,
 * histograma de actividad, búsqueda full-text, lector (diálogo modal con
 * cabecera de informe), atmósfera selvática. Navegación por teclado + a11y.
 */
import { CATS, NOTAS } from './notas.js';

const COL = {
  diario:'#d8584f', essays:'#5a83b8', work:'#7aa23c', dolor:'#cf6a2e',
  comentarios:'#3aa78a', '!':'#e3a23a', demos:'#9079c4', 'sueños':'#c0a0d6',
  'new lemuria':'#5fa8b0', '?':'#cf7f9e', songs:'#5a9ec4', main:'#bba63f',
};
const col = c => COL[c] || '#cdbf99';
const MESES = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

// PIEZA Nº — folio de cadena de custodia, estable (la nota más antigua = Nº001).
const PIEZA = new Map(NOTAS.map((n,i)=>[n.id, String(NOTAS.length-i).padStart(3,'0')]));

const $ = id => document.getElementById(id);
const appEl = $('app');
const rio = $('rio'), tabsEl = $('tabs'), idx = $('idx');
const buscar = $('buscar'), res = $('res'), sub = $('sub');
const lector = $('lector'), hoja = $('hoja'), hojaWrap = $('hoja-wrap');
const lPrev = $('lector-prev'), lNext = $('lector-next'), lCopy = $('lector-copy'), atmos = $('atmos');

let activeCat = null, query = '', lista = NOTAS;
let cur = -1;          // ficha seleccionada por teclado
let curOpen = -1;      // nota abierta en el lector
let prevFocus = null;  // foco a restaurar al cerrar el lector
let pushedByOpen = false;

// ── utilidades ──
const strip = s => s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const escAttr = s => esc(s).replace(/"/g,'&quot;');      // para texto crudo en un atributo
const qesc = s => s.replace(/"/g,'&quot;');              // texto ya esc()-ado → solo comillas

// índice de búsqueda precomputado UNA vez (evita normalizar ~600KB por tecla)
NOTAS.forEach(n => { n._s = strip((n.titulo||'') + '\n' + (n.preview||'') + '\n' + (n.texto||'')); });

function accentRe(q){
  const e = strip(q).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
    .replace(/a/g,'[aáàäâ]').replace(/e/g,'[eéèëê]').replace(/i/g,'[iíìïî]')
    .replace(/o/g,'[oóòöô]').replace(/u/g,'[uúùüû]').replace(/n/g,'[nñ]');
  return new RegExp('('+e+')','gi');
}
// resalta SOBRE el texto crudo y escapa por tramos → nunca parte una entidad HTML
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

// ── pestañas de categoría (filtro) — botones, operables por teclado ──
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

// ── río de fichas ──
function render(){
  lista = filtrar();
  cur = -1;
  res.textContent = (query||activeCat) ? `${lista.length} piezas` : '';
  sub.textContent = `expediente nº6 · ${lista.length} piezas · por fecha`;

  if(!lista.length){ rio.innerHTML = '<div class="vacio">— sin pruebas —</div>'; idx.innerHTML=''; return; }

  rio.innerHTML = lista.map((n,i)=>`
    <div class="ficha" data-id="${n.id}" style="--i:${i}" tabindex="0" role="button" aria-label="Pieza ${PIEZA.get(n.id)}: ${escAttr(n.titulo)} — ${escAttr(stampText(n))}">
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
// viñetas/checkbox PRIMERO (si no, '* ' lo consume la cursiva); URLs van con escAttr.
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
    if(wasOpen) history.replaceState(null,'','#'+id);   // navegar entre piezas no añade historial
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
function cerrar(){   // cierre iniciado por el usuario (botón / Esc)
  if(lector.classList.contains('hidden')) return;
  cerrarUI();                                     // cerrar de inmediato (no esperar a popstate)
  if(pushedByOpen){ pushedByOpen = false; history.back(); }              // retira el #id del historial
  else if(location.hash){ history.replaceState(null,'',location.pathname+location.search); }
}
$('cerrar').addEventListener('click', cerrar);
lPrev.addEventListener('click', ()=>navLector(-1));   // anterior = más nueva
lNext.addEventListener('click', ()=>navLector(1));    // siguiente = más antigua
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
if(localStorage.getItem('n6-sin-atmosfera')==='1') document.body.classList.add('sin-atmosfera');
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
