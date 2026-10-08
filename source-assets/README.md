# Imágenes originales

Originales a resolución completa de las imágenes que se sirven desde `public/assets/`. Esta carpeta no se publica: Wrangler solo despliega `public/`.

`public/assets/` contiene versiones WebP ajustadas al tamaño con que se muestra cada imagen, para que las páginas carguen rápido con conexiones móviles lentas. Si cambias una imagen, edita aquí el original y exporta un nuevo WebP a `public/assets/`. `npm run test-assets` comprueba que ninguna imagen supere 300 KB.
