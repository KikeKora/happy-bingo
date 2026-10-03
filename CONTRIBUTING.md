# Proponer mejoras

Gracias por ayudar a mejorar Happy Bingo. El propietario decide qué propuestas se incorporan.

## Permiso para preparar y enviar mejoras

Lee el [permiso limitado para contribuciones](LICENSE). Puedes crear un fork, descargar
el código, modificarlo y ejecutar pruebas para preparar una mejora del proyecto oficial.
Puedes publicar la propuesta en tu fork y enviarla como Pull Request; no necesitas pagar
ni solicitar acceso al servidor. Este permiso no autoriza crear un servicio público independiente,
revender el proyecto o reutilizarlo en otros productos.

Al enviar una aportación conservas su autoría y concedes a KikeKora los derechos descritos
en LICENSE para incorporarla, modificarla y publicar Happy Bingo. Solo aporta código que puedas
licenciar; declara las dependencias y condiciones de terceros. La aceptación siempre la decide el propietario.

## Pasos

1. Abre un Issue para explicar el problema o la idea. No incluyas datos privados.
2. Crea un **fork** del repositorio y una rama para un solo cambio.
3. Instala con `npm ci`; ejecuta `npm test`.
4. Prueba el diseño en `/simulador`, en computadora y anchos de 390 y 320 píxeles.
5. Abre un **Pull Request** hacia `main`, con explicación, capturas y pruebas realizadas.
6. Espera la revisión del propietario; corrige lo que solicite.

Para cambios de balance, explica qué categoría, héroe o incompatibilidad se corrige.
Conserva pruebas de diversidad y compatibilidad; una captura bonita no verifica las reglas.

No pruebes eventos, recuperaciones, altas masivas o scripts sobre el servidor oficial.
No incluyas `ADMIN_TOKEN`, `EVENT_TOKEN`, códigos de recuperación, configuración privada,
registros de jugadores ni archivos de investigación. Usa datos ficticios.

Las propuestas no reciben acceso al servidor ni permiso de publicación. No añadas procesos
de despliegue o solicitudes de secretos al flujo de revisión. Los cambios de autenticación,
base de datos, Actions, dependencias y licencias requieren revisión especialmente cuidadosa.

Reporta vulnerabilidades de forma privada siguiendo SECURITY.md, no mediante un Issue público.
