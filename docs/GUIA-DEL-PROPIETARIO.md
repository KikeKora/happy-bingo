# Tu flujo de revisión

## Permiso de contribuciones elegido

LICENSE permite a la comunidad copiar, modificar y probar el proyecto para proponerte mejoras.
Las propuestas se envían mediante forks y Pull Requests. Es un permiso limitado de contribución;
su texto no autoriza reutilizar el proyecto en otros productos o desplegar otro servicio público.
Los autores conservan su autoría y te conceden permiso para mantener sus aportaciones en Happy Bingo.
Este documento expresa permisos de uso; los controles de acceso a GitHub y al servidor son separados.

## Configuración inicial de la cuenta y repositorio

1. Crea y verifica tu cuenta en https://github.com/signup; el plan Free sirve para este proyecto público.
2. Activa 2FA en Settings → Password and authentication. Guarda los códigos de respaldo.
3. Repositorio público `happy-bingo`: tú conservas la administración; los seguidores usan forks.
4. En Settings → Rules/Branches, protege `main`: exige Pull Request, una aprobación y las pruebas
   `checks`, descarta aprobaciones cuando cambie el código, exige resolver conversaciones y bloquea
   force push/borrado. Añade CODEOWNERS con tu usuario para exigir tu revisión cuando esté configurado.
5. Activa reportes privados y protección/detección de secretos en Security/Settings según la interfaz.
6. En Actions, deja permisos de lectura y exige aprobar los flujos de colaboradores externos.
7. No guardes claves oficiales en GitHub ni habilites despliegue automático al aceptar propuestas.

Los nombres de opciones pueden cambiar. Las reglas no están activadas solo porque existan estos documentos.
Para cambios tuyos, tu propia aprobación no cuenta como revisión de tu propuesta: usa otro revisor confiable
o una excepción administrativa explícita. No concedas a seguidores permisos de escritura para resolver eso.

## Cuando llega una propuesta

1. Abre **Pull requests** y selecciona la propuesta.
2. Lee qué cambia. En **Files changed**, mira también Actions, dependencias y cambios de seguridad.
3. Confirma que las pruebas estén verdes y revisa capturas de computadora/celular.
4. Prueba la propuesta en una copia aislada con datos ficticios y sin credenciales oficiales.
5. En **Review changes**, usa **Request changes** si falta algo o **Approve** si te convence.
6. Usa **Squash and merge** para incorporarla cuando cumpla las reglas. Si no la quieres, **Close**.
7. Decide por separado cuándo publicarla en el servidor. Aceptarla en GitHub no cambia el stream.

Si no sabes interpretar un cambio, pasa el enlace de la propuesta a Codex para revisarlo contigo antes de aprobar.

## Referencias oficiales

- Registro: https://docs.github.com/en/account-and-profile/how-tos/account-management/creating-an-account-on-github
- 2FA: https://docs.github.com/en/authentication/securing-your-account-with-two-factor-authentication-2fa
- Protección: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches
- Secretos: https://docs.github.com/en/code-security/concepts/secret-security/push-protection
- Seguridad de Actions: https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target
- Licencias: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository
