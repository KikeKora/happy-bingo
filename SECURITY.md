# Seguridad

La referencia mantenida inicialmente es Happy Bingo 1.0.0. Esta preparación para publicación
no sustituye una auditoría completa de la aplicación.

## Reportar un problema

Usa **Security → Advisories → Report a vulnerability** cuando el propietario habilite
los reportes privados en GitHub. Si no está disponible, solicita al propietario un canal privado
sin publicar detalles de explotación, claves, identidades o datos de jugadores en Issues.
No ejecutes pruebas intrusivas en el servidor oficial.

## Separación de accesos

- `ADMIN_TOKEN`: controla las operaciones administrativas y exportaciones de analytics.
- `EVENT_TOKEN`: permite al bridge enviar eventos. Es distinto del token administrativo.
- Las claves viven en secretos de Cloudflare y archivos locales excluidos de Git.
- Los colaboradores trabajan en forks y solicitan revisión; no necesitan ninguna clave oficial.
- El bridge escucha solo en `127.0.0.1`. No expongas el puerto GSI a Internet.
- Happy ID depende de un identificador de dispositivo y un código de recuperación.
  Trata ambos como credenciales; no compartas localStorage, enlaces con clientId ni capturas del código.
- El panel administrativo guarda el token en el navegador. Usa un navegador confiable y no compartido.

## GitHub

Habilita autenticación de dos factores y guarda los códigos de respaldo fuera del repositorio.
Habilita detección de secretos, protección de envíos y reportes privados donde estén disponibles.
Protege `main`: propuestas obligatorias, revisión del propietario, comprobaciones aprobadas,
sin borrado ni force push. No concedas permisos de escritura por defecto a la comunidad.

Las pruebas de Actions usan `pull_request`, permiso `contents: read`, sin secretos del servidor,
sin publicación, sin credenciales persistentes en checkout y sin ejecutores propios.
No cambies a `pull_request_target` para ejecutar código de terceros.
Aprueba ejecuciones de nuevos colaboradores solo después de revisar los cambios del flujo de trabajo.

## Si se publica una clave accidentalmente

Revócala o rótala primero en el servicio afectado. Borrar el archivo o el commit no invalida
la clave ni elimina las copias que otros hayan descargado. Revisa el historial y el acceso posterior.

## Límites de la versión actual

La publicación no añade login externo ni una auditoría de resistencia al abuso. La recuperación
de Happy ID y los endpoints públicos merecen revisión adicional de límites de solicitudes.
No uses este sistema como plataforma de pagos o para proteger información sensible.
