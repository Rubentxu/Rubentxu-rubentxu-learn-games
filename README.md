# Rubentxu Learn Games · Atlas Quest

Portal bilingüe de juegos educativos con mapas interactivos, puzles y aprendizaje local.

## Juegos

- [Países y capitales](public/capitales/index.html): mapa y puzles de geografía mundial.
- [Ríos y montañas de Europa](public/relieve/index.html): ríos, cordilleras y cumbres, ES/EU.

## Publicación actual

**Cloudflare Worker desplegado:** https://atlas-quest-learn-games.rubentxu74.workers.dev/

Rutas:
- `/capitales/`
- `/relieve/`

Cloudflare confirma un despliegue y subdominio Workers activo; la comprobación HTTP desde el entorno de desarrollo no fue posible por bloqueo de acceso a la red.

**Dominio final previsto:** `juegos.rubentxu.dev` — pendiente de configuración de DNS en el proveedor autoritativo y asociación del destino definitivo.

Existe un proyecto Cloudflare Pages separado, `atlas-quest-games`, sin despliegues. Su integración Git directa devuelve un error de instalación, por lo que la publicación inicial se realizó en Workers. No usar el CNAME de Pages para el Worker sin configurar correctamente el servicio de destino.

## Desarrollo y validación

```sh
python3 scripts/check_site.py --check-js
python3 -m http.server 8000 --directory public
```

Las rutas se revisan automáticamente en GitHub Actions mediante `.github/workflows/validate.yml`. La validación por scripts no sustituye las pruebas manuales con el navegador.

## Evolución continua

Trabajar mediante ramas y PR; conservar las claves de progreso y los identificadores de contenido. La publicación continua a Cloudflare requerirá credenciales de CI o arreglar la vinculación de GitHub de la cuenta Cloudflare. No almacenar tokens en Git.

Consulta [la guía de publicación](docs/DEPLOYMENT.md).
