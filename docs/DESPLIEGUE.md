# Despliegue manual

Los aportes públicos se prueban sin claves oficiales. El propietario publica una revisión aprobada
por separado, desde un entorno confiable; nunca ejecuta directamente una rama de un fork con sus claves.

Para una **instalación nueva propia**, inicia sesión en tu propia cuenta Cloudflare:

```sh
npm ci
npx wrangler login
npx wrangler d1 create happy-bingo-community
```

Copia `wrangler.jsonc` como `wrangler.production.jsonc` (excluido de Git).
Coloca allí el nombre de tu Worker y el `database_id` que Cloudflare mostró al crear tu base.

```sh
npx wrangler d1 migrations apply HAPPY_DB --remote --config wrangler.production.jsonc
npx wrangler secret put ADMIN_TOKEN --config wrangler.production.jsonc
npx wrangler secret put EVENT_TOKEN --config wrangler.production.jsonc
npx wrangler deploy --config wrangler.production.jsonc
```

Usa dos claves aleatorias largas y diferentes. Los comandos de secretos piden el valor sin
guardarlo en el código. No escribas las claves en parámetros, Issues, capturas o comentarios.

Para el servicio oficial existente, conserva su configuración privada y base existente.
No crees ni reemplaces la base oficial siguiendo los pasos de instalación nueva.
Antes de publicar: revisar diff y dependencias, probar `/simulador`, `npm test`, hacer respaldo
de datos si hay migraciones y conservar la revisión previa para volver atrás.
Verifica `/api/health` y las pantallas después. Las migraciones destructivas necesitan plan y respaldo.

Los comandos `Start-Happy-Bingo.cmd` y `Preflight-Happy-Bingo.cmd` son auxiliares para Windows.
El preflight con configuración real consulta la instalación configurada: no lo uses desde un fork
con las credenciales oficiales.
