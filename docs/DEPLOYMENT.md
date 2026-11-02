# Publicación de Atlas Quest

## Estado verificado (2 de noviembre de 2026)

- GitHub: `Rubentxu/Rubentxu-rubentxu-learn-games` (rama `main`, juegos y portada disponibles).
- Cloudflare Worker **desplegado**: `atlas-quest-learn-games`, subdominio Workers activo:
  `https://atlas-quest-learn-games.rubentxu74.workers.dev/`.
- Cloudflare Pages `atlas-quest-games` existe, pero tiene **cero despliegues**.
- `juegos.rubentxu.dev` se ha asociado al proyecto Pages, pero la verificación DNS sigue pendiente.
- GitHub Actions `validate.yml` está instalado y pasando; `publish.yml` **NO está incorporado** a `main`.
- La verificación HTTP de Workers desde este entorno quedó bloqueada por restricciones de acceso a la red. La API de Cloudflare confirma el despliegue y el subdominio activo.

## Reproducir la versión de Workers

```sh
python3 scripts/check_site.py --check-js
python3 scripts/build_worker.py
npx wrangler deploy
```

Esto usa `wrangler.jsonc` y genera el Worker desde los HTML originales del directorio `public/`. No mantiene dos copias del código del juego. El token de acceso se configura localmente con Wrangler; no escribir credenciales en el repositorio.

## Publicar en juegos.rubentxu.dev sin mover DNS

**Ruta más sencilla con el Pages existente:**

1. En Cloudflare > Workers & Pages > `atlas-quest-games` > Create a deployment > Production, subir el directorio `public/` o un ZIP que contenga `index.html`, `capitales/index.html` y `relieve/index.html` en su raíz.
2. Verificar `https://atlas-quest-games.pages.dev/`, `/capitales/`, `/relieve/`.
3. En Squarespace (solo si sus nameservers son autoritativos para `rubentxu.dev`), crear **CNAME**: host `juegos` → `atlas-quest-games.pages.dev`. No cambiar los nameservers de todo el dominio ni otros registros. Si ya existe el host `juegos`, inspeccionarlo antes de cambiarlo.
4. Esperar a que Cloudflare confirme el dominio personalizado y HTTPS, luego probar las tres rutas.

El CNAME de Pages no apunta al Worker publicado y **no debe darse de alta antes del primer despliegue de Pages** si se quiere evitar una web vacía.

## Evolución continua

Se recomienda mantener los juegos en GitHub y proteger `main` con la acción de validación. Para publicar desde GitHub Actions al proyecto Pages Direct Upload se necesitan secretos de repositorio `CLOUDFLARE_API_TOKEN` (Cloudflare Pages Edit) y `CLOUDFLARE_ACCOUNT_ID` y un workflow de Wrangler. Esos secretos y el workflow de publicación no están configurados todavía.

Alternativamente, para Git integration nativa de Pages, habría que reparar la autorización de GitHub de Cloudflare y crear un **nuevo** Pages project conectado al repositorio; los proyectos Direct Upload existentes no pueden cambiar su tipo.

No almacenar credenciales en código, comentarios o archivos de configuración públicos. La migración de progreso desde HTML `file://` a dominio HTTPS requiere exportación e importación desde cada juego.
