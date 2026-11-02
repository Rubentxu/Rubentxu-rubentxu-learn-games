# Rubentxu Learn Games

Portal bilingüe de juegos educativos Atlas Quest.

## Juegos

- [Países y capitales](public/capitales/index.html): mapa interactivo y puzles.
- [Ríos y montañas de Europa](public/relieve/index.html): retos geográficos español/euskera.

## Desarrollo

Para validar: `python3 scripts/check_site.py --check-js` (requiere Node.js).
Para jugar localmente: `python3 -m http.server 8000 --directory public`.

## Despliegue

El workflow de GitHub Actions publica en Cloudflare Pages (`atlas-quest-games`) cuando se configuran los secretos `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` y la variable `CLOUDFLARE_DEPLOY_ENABLED=true`.

Consulta [la guía](docs/DEPLOYMENT.md) para el DNS de `juegos.rubentxu.dev` y las comprobaciones de publicación.
