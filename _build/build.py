#!/usr/bin/env python3
"""
notas6 — generador del índice

Lee las notas de iCloud/notas6/<categoría>/*.md y genera js/notas.js con:
  - todas las notas ordenadas por fecha de CREACIÓN (descendente, lo nuevo arriba)
  - fecha + hora reales (st_birthtime == fecha de creación de Apple Notes, verificado)
  - duplicados fusionados en 1 nota con varias etiquetas (cats)
  - texto completo empotrado (búsqueda global y lectura instantáneas, sin fetch)
  - media copiada a media/ y rutas reescritas

Uso:  python3 _build/build.py
"""

import os, re, json, hashlib, shutil
from datetime import datetime

ROOT     = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC      = os.path.join(ROOT, 'iCloud', 'notas6')
OUT_JS   = os.path.join(ROOT, 'js', 'notas.js')
MEDIA    = os.path.join(ROOT, 'media')

SKIP_DIRS  = {'images', 'attachments', '.git', '.claude'}
DIAS_ES    = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

MEDIA_EXT = r'png|jpe?g|gif|svg|webp|heic|mp4|mov|webm|mp3|ogg|m4a|wav|flac'
# solo rutas relativas que terminan en una extensión de media conocida
# (así no reescribimos prosa que mencione "images/..." sin ser un adjunto real)
MEDIA_REF = re.compile(r'(images|attachments)/([^)\s]+\.(?:' + MEDIA_EXT + r'))', re.I)


def extraer_titulo(lines):
    """Primer encabezado # como título. Maneja el caso 'título truncado…' +
    línea completa debajo que dejó la exportación de Apple Notes."""
    titulo, drop_idx = '', None
    for i, ln in enumerate(lines):
        s = ln.strip()
        if re.match(r'^#{1,6}\s', s):           # encabezado real (requiere espacio, como mdToHtml)
            titulo = re.sub(r'^#+\s*', '', s)
            # ¿truncado por la elipsis "…" que mete Apple Notes, completado en la línea siguiente?
            if titulo.endswith('…'):
                base = titulo[:-1].strip()
                for j in range(i + 1, len(lines)):
                    nxt = lines[j].strip()
                    if not nxt:
                        continue
                    # exigir que la siguiente línea sea de verdad la versión completa
                    if base and nxt.lower().startswith(base.lower()) and len(nxt) > len(base):
                        titulo, drop_idx = nxt, i
                    break
            break
    return titulo, drop_idx


def procesar(path, categoria):
    with open(path, 'r', encoding='utf-8') as f:
        contenido = f.read()

    lines = contenido.split('\n')
    titulo, drop_idx = extraer_titulo(lines)
    if drop_idx is not None:
        lines[drop_idx] = ''          # quitar el encabezado truncado duplicado
    if not titulo:
        titulo = os.path.splitext(os.path.basename(path))[0]

    texto = '\n'.join(lines).strip()

    # cuerpo sin encabezados (incl. "# " vacíos), para preview; deja pasar #hashtags
    cuerpo = [l.strip() for l in lines
              if l.strip() and not re.match(r'^#{1,6}(\s|$)', l.strip())]
    preview = ' '.join(cuerpo)[:160]

    has_img   = bool(re.search(r'\.(png|jpe?g|gif|svg|webp|heic)\)', contenido, re.I))
    has_video = bool(re.search(r'\.(mp4|mov|webm)\)', contenido, re.I))
    has_audio = bool(re.search(r'\.(mp3|ogg|m4a|wav|flac)\)', contenido, re.I))
    has_links = bool(re.search(r'\]\(https?://', contenido)) or \
                bool(re.search(r'(?<!\()https?://\S+', contenido))

    st = os.stat(path)
    bt = getattr(st, 'st_birthtime', None)         # fecha de creación (macOS == Apple Notes)
    if bt is None:                                 # otros SO/FS sin birthtime: degradar avisando
        bt = st.st_mtime
        print(f'⚠ sin st_birthtime, uso mtime: {os.path.basename(path)}')
    dt = datetime.fromtimestamp(bt)

    return {
        'titulo':  titulo,
        'cats':    [categoria],
        'fecha':   dt.strftime('%d/%m/%y'),
        'hora':    dt.strftime('%H:%M'),
        'dia':     DIAS_ES[dt.weekday()],
        'sort':    bt,
        'iso':     dt.strftime('%Y-%m-%d'),
        'preview': preview,
        'texto':   texto,
        'img':   has_img, 'video': has_video, 'audio': has_audio, 'links': has_links,
        '_src':  os.path.dirname(path),          # para resolver media
        '_hash': hashlib.md5(texto.encode('utf-8')).hexdigest(),
    }


def main():
    notas, vacias = [], 0

    for cat in sorted(os.listdir(SRC)):
        cdir = os.path.join(SRC, cat)
        if not os.path.isdir(cdir) or cat.startswith('.') or cat in SKIP_DIRS:
            continue
        for fn in sorted(os.listdir(cdir)):
            if not fn.endswith('.md') or fn.startswith('.'):
                continue
            info = procesar(os.path.join(cdir, fn), cat)
            # descartar notas vacías ("Nueva nota" sin cuerpo); tolera encabezado indentado
            cuerpo_real = re.sub(r'^\s*#{1,6}\s.*$', '', info['texto'], flags=re.M).strip()
            if not cuerpo_real:
                vacias += 1
                continue
            notas.append(info)

    # ── dedup por contenido: misma nota → 1 con varias etiquetas ──
    by_hash = {}
    for n in notas:
        h = n['_hash']
        if h in by_hash:
            o = by_hash[h]
            for c in n['cats']:
                if c not in o['cats']:
                    o['cats'].append(c)
            if n['sort'] < o['sort']:            # conservar la creación más antigua
                o['sort'], o['fecha'], o['hora'], o['dia'], o['iso'] = \
                    n['sort'], n['fecha'], n['hora'], n['dia'], n['iso']
        else:
            by_hash[h] = n
    notas = list(by_hash.values())

    # ── copiar media referenciada y reescribir rutas a media/ ──
    os.makedirs(MEDIA, exist_ok=True)
    copiadas = set()
    for n in notas:
        for kind, fname in MEDIA_REF.findall(n['texto']):
            srcf = os.path.join(n['_src'], kind, fname)
            if os.path.exists(srcf) and fname not in copiadas:
                shutil.copy2(srcf, os.path.join(MEDIA, fname))
                copiadas.add(fname)
        n['texto'] = MEDIA_REF.sub(lambda m: 'media/' + m.group(2), n['texto'])

    # ── orden: por fecha de creación, lo nuevo arriba ──
    notas.sort(key=lambda n: n['sort'], reverse=True)

    # longitud de id que GARANTIZA unicidad para el routing (#id); empieza en 8
    id_len = 8
    while id_len < 32 and len({n['_hash'][:id_len] for n in notas}) != len(notas):
        id_len += 2

    # limpieza de campos internos y conteo por categoría
    cats_count = {}
    out = []
    for n in notas:
        for c in n['cats']:
            cats_count[c] = cats_count.get(c, 0) + 1
        out.append({
            'id':      n['_hash'][:id_len],
            'titulo':  n['titulo'],
            'cats':    n['cats'],
            'fecha':   n['fecha'], 'hora': n['hora'], 'dia': n['dia'], 'iso': n['iso'],
            'preview': n['preview'], 'texto': n['texto'],
            'img': n['img'], 'video': n['video'], 'audio': n['audio'], 'links': n['links'],
        })

    os.makedirs(os.path.dirname(OUT_JS), exist_ok=True)
    with open(OUT_JS, 'w', encoding='utf-8') as f:
        f.write('// Auto-generado por _build/build.py — no editar a mano\n')
        f.write('export const CATS = ' + json.dumps(cats_count, ensure_ascii=False) + ';\n')
        f.write('export const NOTAS = ' + json.dumps(out, ensure_ascii=False) + ';\n')

    print(f'✓ {OUT_JS}')
    print(f'  {len(out)} notas únicas · {len(cats_count)} categorías · '
          f'{len(copiadas)} media · {vacias} vacías descartadas')
    print('  rango:', out[-1]['iso'], '→', out[0]['iso'])
    for c, n in sorted(cats_count.items(), key=lambda x: -x[1]):
        print(f'    {n:>4}  {c}')

    # aviso (no censura): posibles datos sensibles que se PUBLICARÍAN tal cual
    LINT = re.compile(r'/Users/\w+|[\w.+-]+@[\w-]+\.\w{2,}|sk-[A-Za-z0-9]{12,}|ghp_[A-Za-z0-9]{20,}')
    flag = [(n['titulo'], LINT.findall(n['texto'])) for n in out if LINT.search(n['texto'])]
    if flag:
        print(f'\n⚠ posibles datos sensibles en {len(flag)} notas PÚBLICAS (revísalas antes de publicar):')
        for t, hits in flag[:25]:
            print(f'    · {t[:42]:42}  →  {", ".join(sorted(set(hits))[:3])}')


if __name__ == '__main__':
    main()
