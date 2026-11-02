# Rubentxu Learn Games · Atlas Quest

Portal bilingüe de juegos educativos sobre geografía. La portada incluye dos minijuegos con mapas interactivos:

- [Países y capitales](public/capitales/index.html): geografía mundial, estudio y puzles, en español y euskera.
- [Ríos y montañas de Europa](public/relieve/index.html): ríos, cordilleras y cumbres, en español y euskera.

## Web publicada

**Cloudflare Pages (producción):** https://atlas-quest-games.pages.dev/

| Página | URL |
| --- | --- |
| Portal | https://atlas-quest-games.pages.dev/ |
| Capitales | https://atlas-quest-games.pages.dev/capitales/ |
| Relieve | https://atlas-quest-games.pages.dev/relieve/ |

El despliegue se realiza automáticamente mediante [GitHub Actions](.github/workflows/publish.yml) al modificar `public/` en `main`. El workflow valida el código, despliega con Wrangler y comprueba las tres rutas HTTP. La primera ejecución terminó correctamente el 2 de noviembre de 2026.

**Dominio personalizado previsto:** `https://juegos.rubentxu.dev`. Cloudflare Pages tiene el dominio añadido pero sigue pendiente del registro CNAME externo: `juegos` → `atlas-quest-games.pages.dev`.

## Desarrollo

```sh
python3 scripts/check_site.py --check-js   # HTML, enlaces, sintaxis JS, cartografía y código compartido
python3 -m http.server 8000 --directory public
node scripts/browser_check.mjs http://localhost:8000 [carpeta-capturas]   # pruebas de navegador (requiere Playwright)
```

### Organización

| Ruta | Contenido |
| --- | --- |
| `public/` | Lo que se publica: portal y un HTML autocontenido por juego (funciona sin red y con `file://`). |
| `shared/mapkit.js`, `shared/mapkit.css` | Motor de mapas común: proyecciones (Lambert acimutal, Equal Earth), cámara con pellizco, rueda, doble toque y teclado, HUD de misión sobre el mapa. |
| `scripts/sync_shared.py` | Copia `shared/` dentro de cada juego (bloques `mapkit-css` y `mapkit-js`). Editar siempre `shared/` y ejecutar este script. |
| `scripts/build_geodata.py` | Regenera siluetas que faltaban y tierra de contexto a partir de Natural Earth (dominio público). |
| `scripts/browser_check.mjs` | Recorrido de extremo a extremo en escritorio y móvil (iPhone 13). |

**Sin conexión e instalable.** `public/sw.js` guarda los juegos tras la primera visita (las páginas se piden primero a la red, con 2,5 s de margen, para que lleguen las actualizaciones) y `public/manifest.webmanifest` permite instalarlos como app. Al añadir archivos a `public/` hay que incluirlos en la lista `PRECACHE` de `sw.js`; `check_site.py` comprueba que existan.

**Idiomas.** El portal y los dos juegos comparten el idioma elegido (`atlasquest:portal:lang`). En Capitales los nombres en euskera de Estados y capitales siguen la norma 38 de Euskaltzaindia (`COUNTRIES_EU`), y las respuestas escritas se aceptan en ambas lenguas. Las mnemotecnias son juegos de palabras en castellano: en euskera se muestra un ancla genérica y la pista original como «gaztelaniazko gakoa».

Cada vista tiene su enlace directo (`capitales/#mapa`, `#puzzles`, `#hoy`; `relieve/#map`, `#play`, `#puzzles`…), y el portal lleva directamente a lo que toca repasar.

El estado de aprendizaje de cada juego se conserva en el almacenamiento local del navegador. Cambiar de `file://` a una web HTTPS requiere una migración explícita del progreso.

## Publicación y secretos

El workflow usa el secreto de Environment `CLOUDFLARE_API_TOKEN`, con permisos **Cloudflare Pages Edit**. Para seleccionar un Environment de nombre distinto, definir la variable de repositorio `CLOUDFLARE_ENVIRONMENT`; por defecto utiliza el Environment `CLOUDFLARE_API_TOKEN`. El ID de cuenta de Cloudflare no es una credencial.

Se mantiene también un Worker histórico en `atlas-quest-learn-games.rubentxu74.workers.dev`, pero **Pages es el origen de publicación principal**. No conectar el dominio personalizado a ambos servicios a la vez.

[Guía detallada de publicación y DNS](docs/DEPLOYMENT.md).
