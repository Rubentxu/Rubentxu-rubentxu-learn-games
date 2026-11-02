# Rubentxu Learn Games · Atlas Quest

Portal bilingüe de juegos educativos sobre geografía. La portada incluye dos minijuegos con mapas interactivos:

- [Países y capitales](public/capitales/index.html): geografía mundial, estudio y puzles.
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
python3 scripts/check_site.py --check-js
python3 -m http.server 8000 --directory public
```

El estado de aprendizaje de cada juego se conserva en el almacenamiento local del navegador. Cambiar de `file://` a una web HTTPS requiere una migración explícita del progreso.

## Publicación y secretos

El workflow usa el secreto de Environment `CLOUDFLARE_API_TOKEN`, con permisos **Cloudflare Pages Edit**. Para seleccionar un Environment de nombre distinto, definir la variable de repositorio `CLOUDFLARE_ENVIRONMENT`; por defecto utiliza el Environment `CLOUDFLARE_API_TOKEN`. El ID de cuenta de Cloudflare no es una credencial.

Se mantiene también un Worker histórico en `atlas-quest-learn-games.rubentxu74.workers.dev`, pero **Pages es el origen de publicación principal**. No conectar el dominio personalizado a ambos servicios a la vez.

[Guía detallada de publicación y DNS](docs/DEPLOYMENT.md).
