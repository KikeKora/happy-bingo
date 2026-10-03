# Video de introducción

La pantalla inicial ofrece **Cómo jugar · ver video (1:39)** junto a las instrucciones.
Se abre dentro del juego y se cierra con **Cerrar · volver a jugar**, Escape o al pulsar fuera.
El cierre detiene la reproducción y devuelve el foco al botón, sin perder el nombre escrito.

## Carga y formatos

El documento inicial no incluye reproductor ni URL de video en elementos multimedia.
`happy-intro-video.js` crea el reproductor y asigna su archivo únicamente al pulsar el botón.
Se usa la versión vertical en pantallas de hasta 767 px en orientación vertical;
en las demás se muestra la horizontal. El formato se decide al abrir, de modo que una
rotación durante la reproducción no reinicie el video. Al cerrarlo se libera el archivo.

Los dos MP4 están en `public/media/`, con H.264/AAC y cabecera al inicio para reproducir
sin esperar la descarga completa. No hay reproductores externos, cookies de video ni
consultas nuevas a cuentas, puntos o eventos. Los archivos están optimizados a 720p.

## Contenido y actualización

El video explica entrada, Happy ID, modos, objetivos automáticos, bonos 5×5, Happy Swap,
perfil, acumulación de puntos, recuperación, Happy Sprint y premios futuros.
Los puntos persisten en el Happy ID y se suman entre partidas.
Happy Swap se presenta entre los minutos 10 y 20; actualmente el servidor elige 12, 14,
16 o 18. Permite hasta dos cambios de casillas pendientes en 90 segundos.

Para cambiar el video, exportar las dos versiones, optimizarlas a menos de 25 MiB por
archivo, cambiar el sufijo de versión de sus nombres y actualizar las rutas del script.
Actualizar también la duración visible y revisar los bonos contra `src/worker.js`.
El [guion](GUION-INTRODUCCION.md) permite revisar el contenido sin reproducirlo.

Las imágenes de la marca y la narración se publican bajo las condiciones del proyecto;
las referencias a Dota 2 siguen sujetas a `THIRD_PARTY_NOTICES.md`.
