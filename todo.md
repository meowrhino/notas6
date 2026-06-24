# notas6 — todo

Backlog de mejoras. Sale de una sesión de ideación (5 lentes + síntesis crítica).
Impacto (I) y esfuerzo (E) en escala 1-5. Lo de más arriba, mejor ratio.

---

## ✅ Hecho (sesión 24 jun 2026)
- Río de fichas por fecha de creación + hora · histograma de actividad · búsqueda full-text · lector.
- Estética "expediente / archivo confidencial".
- **PIEZA Nº** (cadena de custodia, folio estable).
- **Entrada escalonada** de fichas (stagger) + bloque `prefers-reduced-motion`.
- **Navegación por teclado** (`j`/`k`/flechas/Enter/Esc/`/`) + fichas enfocables (a11y).
- **Cabecera de informe** en el lector (CASO · PIEZA · APERTURA · CLASIF · ADJUNTOS).
- **Lector con anterior/siguiente** (← →) + **copiar enlace** a la pieza.
- **Textura de papel** (grano feTurbulence + envejecido + sombra del punch + tinta que cala en la hoja).
- **Atmósfera selvática**: marco lateral + viñeta + tinte húmedo, con toggle 🌿 (recuerda preferencia).
- Audio verificado en lector · favicon · repo público + GitHub Pages.

---

## ⏳ Depende de ti
- [ ] **Ordenar las notas que faltan** → al meterlas en `iCloud/notas6/<categoría>/`, correr `python3 _build/build.py` y `git push`.
- [ ] **Foto de la selva**: optimizar a **webp, <250KB, ~1600px** y guardar como `media/selva.webp`; luego en `css/style.css` cambiar `--selva:none;` por `--selva:url('media/selva.webp');`. (Hoy hay un fallback oscuro verdoso.) Sin optimizar arruinaría el arranque.

---

## 🌿 Atmósfera / fondo
- [ ] **Foto de selva real** (ver arriba). La técnica ya está montada: anclada a `.body::before` (no scrollea), río 100% opaco encima, viñeta + clima. (I5/E2 una vez exista el asset)
- [ ] **Portada de entrada** (tapa del expediente sobre la selva, "abrir expediente"). Auto-skip si entras por `#id`; recordar en sessionStorage. Depende del asset. (I4/E3)

## 🎞 Movimiento / animaciones
- [ ] **Apertura del lector como carpeta que se despliega** (rotateX sutil + fade, terminar en 0). (I4/E3)
- [ ] **Crossfade del río al filtrar** (anima el contenedor, no las 444 fichas). (I4/E2)
- [ ] **Sello que "cae" con golpe (thunk)** al hover de ficha (escala 1.18→.94→1 manteniendo su rotación). (I4/E2)
- [ ] **Resaltado de búsqueda que se "pinta"** (sweep de marcador). (I3/E1)
- [ ] **Pestañas que asoman** al hover + realce de la pestaña activa (no solo atenuar el resto). (I3/E2)

## 🗞 Material / textura
- [ ] **Manchas de café/humedad** esporádicas (1 de cada ~7 fichas, por hash; mix-blend multiply). (I4/E2)
- [ ] **Bordes desgastados / papel rasgado** — empezar SOLO por la hoja del lector. (I3/E3)
- [ ] **Pliegue/doblez** diagonal en algunas fichas + horizontal fijo en la hoja. (I2/E2)

## 🔪 Concepto / narrativa
- [ ] **Sellos de clasificación** deterministas (VISTO/ARCHIVADO/PRUEBA/CONFIDENCIAL), máx 1 por ficha; CONFIDENCIAL solo en dolor/diario. (I4/E2)
- [ ] **Portada de sub-expediente** al filtrar (new lemuria → "EXPEDICIÓN · continente-jungla"; dolor → "SECCIÓN RESERVADA"). (I4/E2)
- [ ] **Redaction / texto censurado** en preview de `dolor` (revelar al hover; nunca en el lector). Gesto fuerte, curar bien. (I4/E2)
- [ ] **Hilo rojo** entre las 7 notas multi-categoría (clip metálico + "EXPEDIENTES VINCULADOS" en el lector). Easter egg. (I3/E3)

## 🧭 Interfaz / UX
- [ ] **Búsqueda con operadores**: `cat:diario`, `"frases exactas"`, `-excluir`. (I4/E2)
- [ ] **Barra de acciones**: orden asc/desc, "ir a una pieza aleatoria", "limpiar filtro". (I3/E2)
- [ ] **Estado vacío accionable** (botón "quitar filtros") + `aria-live` en el contador de resultados. (I3/E1)
- [ ] **Histograma en móvil** como panel desplegable (hoy roba ancho y las etiquetas quedan a 9px). (I3/E2)

## ⚙️ Rendimiento
- [ ] **Quitar el reflow forzado del histograma** (hoy `offsetTop` ×444 por render) → IntersectionObserver observando solo la 1ª ficha de cada mes. (I4/E3)

## 🔧 Varios pendientes
- [ ] Probar a fondo **vídeo** en el lector cuando haya alguno (audio ya verificado).
- [ ] Estilizar el reproductor de audio nativo para que pegue con el manila.
- [ ] Posible **candado** para alguna categoría sensible si la quieres semi-privada.
- [ ] Calibrar opacidades de la atmósfera con la foto real puesta.
