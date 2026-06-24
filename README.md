# notas6

Archivo personal de notas — edición 6. Estética "fichero", un río de notas
ordenadas por fecha de creación con cajón índice de tiempo y búsqueda full-text.

## Cómo añadir / actualizar notas
1. Organiza las notas en Apple Notes dentro de las carpetas de categoría.
2. Expórtalas a `iCloud/notas6/<categoría>/*.md` (la fecha de creación viaja
   como `birthtime` del archivo == fecha de Apple Notes).
3. Regenera el índice:  `python3 _build/build.py`
   - lee fecha+hora de creación de cada `.md`
   - fusiona duplicados en 1 nota con varias etiquetas
   - copia la media a `media/` y reescribe las rutas
   - escribe `js/notas.js`
4. Sube a GitHub Pages.

## Previsualizar en local
`python3 _build/serve.py`  →  http://127.0.0.1:8765

## Estructura publicable
`index.html`, `css/`, `js/`, `media/`, `.nojekyll`
(la carpeta `iCloud/` y `_build/` son la fuente/herramientas, no hace falta publicarlas)
