# Matriz de aceptación · 18/11/2026

La validación automática usa Edge headless/WebGL2 y física cannon-es real. No representa una sesión inmersiva ni seguimiento real de manos. Resultado técnico local: **14/14 pruebas aprobadas**, cero errores de consola, 39 respuestas HTTP sin fallos y sin desbordamiento horizontal a 390 px. Evidencias: [pruebas](evidencias/pruebas.txt), [captura de pruebas](evidencias/pruebas.png), [Network/Console](evidencias/navegador.json), [portada](evidencias/portada.png), [móvil](evidencias/movil.png), [laboratorio](evidencias/laboratorio.png).

| # | Requisito | Procedimiento | Esperado | Observado / evidencia | Estado |
|---|---|---|---|---|---|
| 1 | Evolución 3.1, portada, favicon y créditos | Comparar código original, abrir portada desktop/móvil | Flujo VR preservado, créditos y portada responsiva | Código inspeccionado, autor/enlaces preservados; capturas 1440 y 390 px, sin overflow | APROBADO en escritorio |
| 2 | immersive-vr desde Pages en Quest 3 | Abrir HTTPS en Quest y pulsar ENTER VR | Sesión con manos | Requiere dispositivo físico; consulta estado HTTPS en DESPLIEGUE.md | NO PROBADO EN VISOR |
| 3 | Dos manos, pinza, tomar/soltar | Alternar manos y ocultar una durante agarre | Dos entradas independientes y liberación segura | Código implementado; no hay visor conectado | NO PROBADO EN VISOR |
| 4 | Cuatro mesas, cinco piezas por mesa | Contar cuerpos y simular reposo | 4 mesas y 5 piezas apoyadas en cada una | Suite: conteo y reposo de las 20 piezas | APROBADO |
| 5 | Veinte piezas, cinco por clase | Contar por categoría | 20 y cuatro grupos de 5 | Suite de inventario | APROBADO |
| 6 | Reinicio aleatorio válido | Comparar posiciones, comprobar separación y apoyo | Nuevas posiciones, cuatro categorías en cada mesa, sin solapar/flotar | Suite de distribución, radios y AABB inferior | APROBADO |
| 7 | Botes abiertos físicos y rótulos | Contar cuerpos y observar captura | Cuatro botes con base + cuatro paredes, sin techo | 5 cuerpos/bote; captura de escena | APROBADO en escritorio |
| 8 | Gravedad/rebote/reposo | Soltar esfera desde altura, medir velocidad y apoyo | Cae, rebota, descansa | Suite con inversión vertical y reposo sobre suelo | APROBADO |
| 9 | Colisiones entre piezas y botes | Lanzar una esfera contra otra y depositar veinte | Transmisión de impulso y retención dentro de botes | Suite de choque y 20 depósitos; movimientos extremos de manos pendientes | APROBADO en condiciones de prueba |
| 10 | Agarre físico y retorno dinámico | Agarrar en el motor y soltar; comprobar exclusividad y masa | Un solo propietario; cuerpo dinámico con masa | Suite del mecanismo dinámico equivalente al cinemático, masa 0,14 kg | APROBADO en escritorio; NO PROBADO EN VISOR |
| 11 | Acierto estable y sin doble conteo | Depositar, esperar 0,8 s y repetir contactos | Un acierto por pieza | Suite de 20 depósitos; contactos adicionales no suman | APROBADO |
| 12 | Tres errores | Soltar tres veces una misma pieza en bote incorrecto | Tres errores, tres intentos, cero aciertos | Suite física de tres depósitos y espera adicional | APROBADO |
| 13 | Recuperación de pieza caída | En partida, dejar caer pieza; pulsar Recuperar | Vuelve a una mesa libre sin cambiar score ni inventario | Implementado con búsqueda de espacios; falta recorrido interactivo completo de recuperación | NO PROBADO |
| 14 | Total y progresos individuales | Completar suite/partida, comparar contadores | 20/20 y cuatro grupos 5/5 | Suite verifica datos del marcador; HUD visible en captura inicial | APROBADO datos; lectura NO PROBADA EN VISOR |
| 15 | Precisión, intentos y tiempos | Confirmar errores/aciertos, comparar fórmula y tiempos | Sin intentos 0 %, 2/5 = 40 %, tiempos desde inicio | Suite y código: cuatro tiempos >0, último posterior al primero; tiempos no locales por bote | APROBADO lógica |
| 16 | Fin detiene reloj | Completar veinte y simular más pasos | Tiempo no crece | Suite: estado completado y tiempo invariable | APROBADO |
| 17 | Reinicio total | Reiniciar diez veces y contar bodies/estados | 0/20, reloj 0, eventos vacíos, mismos bodies | Suite sin cuerpos huérfanos ni contadores residuales | APROBADO |
| 18 | Carga web/VR sin errores críticos | Console/Network y sesión real | Módulos/recursos correctos; sesión estable | Registro local sin errores y respuestas 200; VR requiere Quest | APROBADO web; NO PROBADO EN VISOR |
| 19 | URLs públicas | Abrir repositorio y URL HTTPS, ejecutar suite remota | Sitio y repo accesibles | Resultado actualizado en DESPLIEGUE.md | Consultar DESPLIEGUE.md |
| 20 | Problemas reales y conclusiones | Revisar README y borrador; alumno completa en plataforma | Dos incidentes reales y reflexión sin inventar evidencias | Problemas documentados y CONCLUSIONES.md creado; no se envió tarea académica | APROBADO documentación; entrega del alumno pendiente |

## Repetir pruebas sin build

1. `python serve.py` o Live Server.
2. Abre `http://localhost:8080/?test=1`.
3. Pulsa **Ejecutar pruebas automáticas**. Las pruebas modifican la partida de prueba y terminan con un reinicio.
4. Para QA opcional de escritorio, instala Python Playwright y ejecuta `python tests/headless.py`; no requiere instalar otro navegador si Edge ya existe.

## Guion obligatorio en Meta Quest 3

1. Activa seguimiento de manos y despeja el área física. Abre la URL HTTPS pública en Meta Quest Browser.
2. Pulsa Explorar y ENTER VR. Verifica dos manos y legibilidad del panel. Pulsa Comenzar dentro del mundo y comprueba reloj 0→avance.
3. Con ambas manos alternadas, toma y suelta cada tipo; intenta seleccionar una pieza ya sujeta con la otra mano. No debe duplicarse ni cambiar de propietario.
4. Oculta una mano mientras sujeta: debe liberar de forma segura; prueba salir/reentrar y la pausa. Para reanudar pulsa Comenzar.
5. Verifica caída, rebote, fricción, choques pieza/pieza y paredes/base de botes. No fuerces movimientos extremos para compensar límites de tracking.
6. Realiza tres depósitos erróneos confirmados, retira la pieza físicamente y repite; debe haber tres errores y cero aciertos atribuibles a esos depósitos.
7. Deja caer una pieza al suelo y pulsa Recuperar. Comprueba total veinte y puntuación sin cambios.
8. Completa las veinte piezas. Comprueba 20/20, cuatro 5/5, precisión, tiempos globales por bote y cronómetro detenido. Captura el resumen.
9. Reinicia. Comprueba distribución distinta, cinco piezas por mesa, 0/20, cero errores/intentos y todos los tiempos Pendiente.
10. Registra molestias, pérdidas de tracking, penetraciones y fluidez. No hay mediciones reales de FPS del visor en esta entrega automatizada.
