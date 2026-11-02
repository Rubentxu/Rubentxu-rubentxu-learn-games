# Normas de mantenimiento
- Usar la skill `learning-game-html` cuando esté disponible: mapa protagonista, escena jugable, feedback útil y controles de teclado/touch.
- El código explica su funcionamiento; la documentación describe contratos y decisiones no evidentes. El historial del desarrollo pertenece a Git, no a comentarios.
- Mantener separadas las responsabilidades de dominio, estado, persistencia, vista y contenido educativo.
- No eliminar el progreso al reiniciar una ronda. Conservar identificadores y claves `localStorage`.
- Sin anuncios, telemetría, autenticación ni datos personales sin autorización expresa.
- Interfaces accesibles, responsive y respetuosas con `prefers-reduced-motion`; incluir Español y Euskara cuando proceda.
- No incluir secretos ni tokens de despliegue en archivos. Probar `python3 scripts/check_site.py --check-js` antes de publicar.
- Las pruebas de navegador se deben ejecutar y documentar; no deducir su éxito de pasar un linter.