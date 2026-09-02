# Preparación PWA Android

## Cambios locales (2 de septiembre de 2026)

- Identidad estable del manifiesto: `/`, mismo inicio y alcance.
- Iconos de instalación de 192 y 512 píxeles reales; recurso maskable separado.
- Pantalla sin conexión autónoma, sin dependencias CDN. No se promete navegación offline.
- Datos JSON sin caché responden con 503, no con una respuesta vacía.
- Limpieza del Service Worker limitada a cachés propias `moronabus-shell-*`.
- Ubicación inicial con tiempo máximo de 15 segundos y alternativa de exploración sin GPS.
- Mensajes diferentes para permiso rechazado, timeout y ubicación no disponible.

## Verificación reproducible

Desde la raíz: `node scripts/test-pwa.cjs`.
Valida manifiesto, dimensiones PNG y respuestas offline del Service Worker mediante simulación.
No sustituye una prueba real de instalación en Android.

## Pendientes antes de empaquetar/publicar

1. Desplegar estos cambios y comprobar en Chrome Android instalación, apertura, botón Atrás, enlaces externos, permisos denegados y pérdida/recuperación de red.
2. Probar con un Service Worker anterior instalado y después con instalación nueva.
3. Revisar política de privacidad y tratamiento de ubicación, analítica y servicios externos. No se ha publicado una política sin validar esos tratamientos.
4. Generar el proyecto TWA/AAB y establecer identificador y firma. No se ha creado `assetlinks.json` con valores inventados.
5. Verificar firma de Play App Signing, requisitos vigentes de Play y pruebas de cuenta.

## Límites conocidos

El mapa depende de bibliotecas CDN y servicios de red. El fallback de navegación muestra la pantalla offline incluso si algunos datos están guardados, evitando prometer una aplicación completa sin sus dependencias.
El enlace de descarga Android existente apunta a Google Drive; no es una ficha de Google Play y debe sustituirse solo cuando exista una publicación real.
La disponibilidad de GPS no demuestra cobertura de transporte. Los cambios de esta fase no alteran los algoritmos de rutas.
