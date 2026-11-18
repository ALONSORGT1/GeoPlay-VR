# Estado de publicación

Repositorio: https://github.com/ALONSORGT1/Laboratorio-inmersivo-de-clasificaci-n-geom-trica-con-gravedad-y-colisiones-Meta-Quest-3

URL: https://alonsorgt1.github.io/Laboratorio-inmersivo-de-clasificaci-n-geom-trica-con-gravedad-y-colisiones-Meta-Quest-3/

El 18/11/2026 se clonó el repositorio inicialmente sin ramas, se creó `main` y se realizó commit/push sin force. Git autenticó correctamente mediante su configuración existente. El conector de GitHub confirmó que el repositorio es público.

La herramienta `gh` no tenía sesión autenticada. El conector no ofrece configuración de Pages. El control del navegador se interrumpió y después se detuvo por no poder verificar la URL de Edge con confianza; no se continuó ese control ni se accedió a credenciales para eludirlo.

En la comprobación posterior, la API pública del repositorio reportó `has_pages: true` y la URL HTTPS devolvió **200** con la portada Forma / Lab. No se atribuye al agente una configuración de Pages que no pudo ejecutar u observar. La API de detalle `/pages` respondió 404 sin autenticación, así que el modo `main / root` no se pudo confirmar mediante esa API.

## Comprobación pública completada

La publicación automática `pages build and deployment` del commit de aplicación `e9e99f57773349a7b8f389519392b8815f675fd5` terminó con **success**. Se descargaron ocho archivos desde Pages (HTML, JS, CSS y favicon): todos devolvieron HTTP 200 y coincidieron por SHA-256 con los archivos locales, normalizando únicamente finales de línea. Evidencia: [despliegue.json](evidencias/despliegue.json).

Se abrió la URL pública con un navegador de pruebas aislado y se ejecutó la misma suite física desde HTTPS: **15/15 APROBADAS**, sin errores de consola ni peticiones HTTP fallidas, y sin desbordamiento horizontal a 390 px. Evidencia: [pruebas públicas](evidencias/publico/pruebas.txt), [consola y red públicas](evidencias/publico/navegador.json), [captura pública](evidencias/publico/laboratorio.png).

La revisión final detectó además un fallo intermitente de recuperación: no se buscaban los dos lugares desplazados de la segunda fila. Se corrigió la lista de posiciones de recuperación y se sustituyó la separación fija por una separación basada en los radios reales de ambos objetos. El commit final se entrega en la respuesta de cierre, evitando una referencia circular dentro del mismo commit. No hay bloqueo de publicación pendiente. La configuración exacta de Settings no fue observada; sí se verificaron el despliegue real y sus módulos públicos.

Pendientes de equipo: pruebas de seguimiento real de manos, ergonomía, sonido y rendimiento del Quest 3 según `VALIDACION.md`. El sitio público no requiere pasos manuales de instalación o compilación.
