# NY27

Guía web móvil del viaje a Nueva York (21 a 27 de marzo de 2027). Web estática, sin compilación. Publicable en GitHub Pages (usuario.github.io/ny27/).

## Estructura
- `index.html`, `css/styles.css`, `js/app.js`
- `data/dia-1.json` … `dia-6.json`: contenido. Cambiar un dato aquí no exige tocar el código.
- `fonts/`: Inter 400, 500 y 700 (licencia SIL OFL).
- `img/cabecera.png` e `icons/*.svg`: provisionales; sustituir por los de Figma.
- `manifest.webmanifest`, `service-worker.js`, `icons/app-icon-*.png`: instalación y modo sin conexión.

## Formato de cada día (`data/dia-N.json`)
- `fecha` ("2027-03-21"), `transporte` (`minutos`, `linea`, `salida`, `direccion`, `transbordos`, `llegada`).
- `tramos`: lista con `etiqueta` ("Mañana", "Comida", "Tarde") y `zonas`.
- Cada zona: `id`, `nombre`, `descripcion` (opcional) y las listas `lugares`, `comer`, `tiendas`, `cine`, `wc`.
- Cada elemento: `nombre`, `direccion` y `descripcion` (opcional). Con nombre y dirección se construye el enlace a Google Maps.
- Una lista vacía o ausente no se muestra. Los campos que empiezan por `_` se ignoran.

## Sin conexión
Red primero y copia guardada como respaldo. Si se añaden o renombran archivos, añadirlos a `PRECACHE` en `service-worker.js` y subir `CACHE` (`ny27-v1` → `ny27-v2`).

## Tiempo
Open-Meteo (gratuito, sin clave), Manhattan. Pide atribución (CC BY 4.0).
