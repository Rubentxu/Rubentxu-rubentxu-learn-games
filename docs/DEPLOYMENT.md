# Publicación de Atlas Quest

## Estado de la publicación (2 de noviembre de 2026)

El repositorio `Rubentxu/Rubentxu-rubentxu-learn-games` está conectado a Cloudflare Pages **a través de GitHub Actions + Wrangler**. Se usa la modalidad Direct Upload del proyecto Pages ya existente, no la integración nativa de GitHub de Cloudflare.

- **Producción activa:** https://atlas-quest-games.pages.dev/
- **Capitales:** https://atlas-quest-games.pages.dev/capitales/
- **Relieve:** https://atlas-quest-games.pages.dev/relieve/
- **CI/CD:** `.github/workflows/publish.yml` desplegó correctamente y verificó las tres rutas.
- **Validación:** `.github/workflows/validate.yml` comprueba los archivos locales.
- **Dominio personalizado:** `juegos.rubentxu.dev`, todavía pendiente de verificación DNS en Cloudflare. Cloudflare indica `CNAME record not set`.

## 1. GitHub Actions

El workflow de publicación se ejecuta al modificar `public/`, el validador o su propia configuración en la rama `main`, y admite ejecución manual.

Configuración:
- Nombre del Environment predeterminado: `CLOUDFLARE_API_TOKEN` (configurable mediante variable de repositorio `CLOUDFLARE_ENVIRONMENT`).
- Secreto de Environment: `CLOUDFLARE_API_TOKEN` (token con permiso Account → Cloudflare Pages → Edit).
- El ID de cuenta se incluye en el workflow; **no es una credencial**.

No imprimir el token ni almacenarlo en Git. Para desactivar despliegues, deshabilitar el workflow en GitHub Actions o retirar el secreto del Environment.

## 2. Asignar el subdominio en el proveedor DNS autoritativo

Antes de modificar registros, confirmar que el dominio `rubentxu.dev` tiene sus DNS gestionados en Squarespace. La zona DNS no está disponible en la conexión Cloudflare utilizada.

En **Squarespace Domains → rubentxu.dev → DNS Settings → Custom Records** crear el registro:

| Campo | Valor |
| --- | --- |
| Type | CNAME |
| Host | `juegos` |
| Data / Target | `atlas-quest-games.pages.dev` |
| TTL | Predeterminado / Auto |

No introducir el prefijo `https://` en el destino. No borrar ni modificar registros del dominio principal, blog o correo. Si ya existe un registro con host `juegos`, comprobarlo antes de cambiarlo.

En Cloudflare Workers & Pages → `atlas-quest-games` → Custom domains, comprobar el estado de `juegos.rubentxu.dev`. El dominio ya está añadido; no es necesario añadirlo otra vez. Cuando el DNS se resuelva y Cloudflare emita su certificado TLS, verificar las tres rutas con HTTPS.

## 3. Validación y mantenimiento

```sh
python3 scripts/check_site.py --check-js
python3 -m http.server 8000 --directory public
```

La validación automática comprueba código y rutas básicas; no sustituye las pruebas manuales de navegación, experiencia móvil, accesibilidad, mapas y puzles.

Crear una rama por mejora, pasar las comprobaciones de CI y fusionar a `main` para publicar. Cada juego conserva sus rutas y claves de `localStorage` para no romper el progreso.

## 4. Worker histórico

El Worker `atlas-quest-learn-games` se desplegó antes de finalizar Pages, y permanece accesible en `https://atlas-quest-learn-games.rubentxu74.workers.dev/`. El código para reconstruirlo está en `scripts/build_worker.py`, con `wrangler.jsonc`. No es el destino definitivo del dominio ni se actualiza con el workflow de Pages.

No asociar `juegos.rubentxu.dev` al Worker y a Pages simultáneamente.
