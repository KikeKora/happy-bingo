# Happy Bingo · Happy Games

Versión comunitaria **1.0.0**, basada en la versión publicada el 3 de octubre de 2026.
Bingo en vivo conectado a Dota 2, con Happy ID, puntos persistentes, tarjetas por héroe,
Happy Swap, reconocimientos y overlays de OBS. Interfaz en español para computadora y celular.

- Juego oficial: https://happy-bingo-online.kikekora.workers.dev/
- Simulador oficial con datos ficticios: https://happy-bingo-online.kikekora.workers.dev/simulador
- Cómo proponer cambios: [CONTRIBUTING.md](CONTRIBUTING.md)
- Seguridad: [SECURITY.md](SECURITY.md)
- Guía para quien administra: [docs/GUIA-DEL-PROPIETARIO.md](docs/GUIA-DEL-PROPIETARIO.md)

## Arquitectura y carpetas

`Dota 2 GSI → bridge local (127.0.0.1:4010) → Cloudflare Worker + Durable Object + D1 → WebSocket → jugadores y OBS`

| Carpeta | Contenido |
| --- | --- |
| `public/` | Pantallas, estilos, ilustraciones, iconos y simulador |
| `src/worker.js` | Reglas, balance, sala, puntos, Happy ID y API |
| `local/` | Bridge de Dota, análisis y pruebas con datos ficticios |
| `migrations/` | Esquema D1; no contiene registros de jugadores |
| `.github/` | Pruebas de propuestas y plantilla de revisión |

## Desarrollo local

Requisitos: Node.js 22 o superior y npm. Las pruebas funcionan sin cuenta de Cloudflare.

```sh
npm ci
npm test
```

Para explorar las pantallas con datos ficticios:

```sh
npm run dev
```

Abre `http://localhost:8787/simulador`. El simulador usa las pantallas del proyecto,
pero mantiene sus identidades, puntos y eventos en memoria. No necesita el bridge ni partidas reales.

Para probar el juego con base local:

```sh
# Copia .dev.vars.example como .dev.vars; usa valores solo locales.
npx wrangler d1 migrations apply HAPPY_DB --local
npm run dev
```

El identificador de base del `wrangler.jsonc` público es un marcador ficticio.
No apunta a la base oficial. Las pruebas de eventos usan puertos 14010 y 14011,
un servidor falso y credenciales ficticias; no envían eventos al juego oficial.

## Bridge de Dota 2

Solo se necesita para partidas reales en una instalación propia:

1. Copia `local/happy-bingo-online-config.example.json` como `local/happy-bingo-online-config.json`.
2. Configura la URL de **tu propia instalación** y su `EVENT_TOKEN`.
3. Configura Dota GSI para enviar a `http://127.0.0.1:4010/`.
4. Ejecuta `node local/happy-bingo-online-bridge.cjs`.

El bridge genera registros y datos de investigación locales que se excluyen de Git.
El propietario conserva su configuración oficial fuera del repositorio público.

## Publicación del proyecto oficial

La guía de [despliegue](docs/DESPLIEGUE.md) está destinada al propietario y a quienes
tengan su autorización para publicar el proyecto oficial. Aceptar una propuesta en GitHub
no publica cambios automáticamente. Este proyecto no incluye credenciales de despliegue en Actions.

## Licencias e imágenes

El [permiso limitado para contribuciones](LICENSE) permite copiar el código, modificarlo,
probarlo localmente y enviar mejoras al proyecto oficial mediante forks y Pull Requests.
No exige pago. No autoriza venderlo, reutilizarlo en otros productos ni ofrecer otro servicio
público sin permiso adicional. Es una licencia propia, no una licencia abierta como MIT.
Consulta [CONTRIBUTING.md](CONTRIBUTING.md) y [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
para las condiciones de aportaciones, imágenes y referencias a Dota 2.
No se incluyen claves, perfiles reales, exportaciones de la base ni historiales privados de partidas.
