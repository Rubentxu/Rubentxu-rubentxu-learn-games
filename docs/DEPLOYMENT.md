# Publicación en Cloudflare Pages

El repositorio GitHub es `Rubentxu/Rubentxu-rubentxu-learn-games`.
Cloudflare Pages ya tiene un proyecto separado llamado `atlas-quest-games` (Direct Upload).
El nombre de la cuenta Cloudflare del propietario no debe introducirse en archivos públicos como una credencial.

## 1. Activar CI/CD
En GitHub > Settings > Secrets and variables > Actions:

- Secreto **CLOUDFLARE_ACCOUNT_ID**: identificador de la cuenta Cloudflare.
- Secreto **CLOUDFLARE_API_TOKEN**: token con permisos **Account → Cloudflare Pages → Edit**, restringido a la cuenta.
- Variable **CLOUDFLARE_DEPLOY_ENABLED**: poner `true` al verificar los dos secretos.

No subir nunca los secretos a Git. En cada `push` a `main` la acción `publish.yml` validará el sitio y ejecutará `wrangler pages deploy public --project-name=atlas-quest-games --branch=main`.
Se usa Wrangler porque el proyecto Cloudflare existente se creó para Direct Upload; no hay que sustituirlo por otro proyecto.

## 2. Validación
La acción `validate.yml` comprueba HTML, enlaces locales, dependencias externas y la sintaxis del JavaScript embebido con Node.js.
Comprobar manualmente una ronda con acierto y fallo en ambas aplicaciones y navegar en móvil y escritorio antes de habilitar despliegues automáticos.

## 3. URLs esperadas
- https://atlas-quest-games.pages.dev/
- https://atlas-quest-games.pages.dev/capitales/
- https://atlas-quest-games.pages.dev/relieve/

## 4. DNS externo
En Squarespace, **solo si allí están los servidores DNS autoritativos** de `rubentxu.dev`:
DNS → DNS Settings → Custom Records → Add Record.
Tipo CNAME, Host `juegos`, Data `atlas-quest-games.pages.dev`. No modificar ni borrar registros preexistentes del dominio principal, correo o blog.
El dominio `juegos.rubentxu.dev` ya figura en Cloudflare Pages, con validación pendiente hasta crear el CNAME.
Una vez validado, comprobar HTTPS y las tres rutas.

## 5. Evolución
Crear rama y PR, comprobar la acción de validación, fusionar a `main` para publicar, y revertir el commit si surge una regresión. Añadir juegos en nuevos directorios de `public/`; no romper las rutas ni claves de almacenamiento existentes.