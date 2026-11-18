# Diagnóstico y plan ejecutado

Fuente académica: práctica 3.2 y ANEXO A leídos completos desde la pestaña ya abierta de la plataforma educativa el 18/11/2026. No se modificó ni envió contenido en la plataforma. También se revisó `prompt_codex_laboratorio_vr_3_2.md` facilitado por el usuario.

## 1. Diagnóstico

`AMBIENTE VR`: index, CSS, main monolítico, bibliotecas locales Three 0.187.0/cannon-es 0.20.0, servidor Python y tests anteriores. El código genera 40 cubos aunque README dice 20. Faltaban clasificación, categorías, mesas y marcador. Se conservó el original; se clonó el repositorio vacío en el workspace actual y se copiaron bibliotecas/licencias y servidor. No se copió Git del origen.

## 2. Diseño

Pabellón marfil/madera/petróleo, cielo abierto, señalética y superficies mates. Cuatro estaciones en arco, selección por rayos y cámara estable. Plano: usuario `(0,0)`, estaciones a radio 1,30 m en -75/-25/+25/+75 grados; recipientes atrás y piezas delante en cada estación. Mesas a 0,82 m, botes 0,85–1,13 m, HUD centrado a 1,83 m. Las distancias se ajustarán únicamente con evidencia del visor.

Riesgos previstos: cuerpos que atraviesan paredes, duplicación de intentos, pérdida de tracking, orientación física distinta de la malla, rayos bloqueados y tiempo corriendo al salir. Mitigación: micropasos, velocidad limitada, estados por pieza, soporte físico confirmado, cuerpos para mobiliario, rayos con oclusores y pausa explícita.

## 3. Física

`physics.js`, `environment.js`, `config.js`: cuatro mesas, cinco cuerpos por mesa y por categoría, veinte cuerpos dinámicos y cuatro botes de cinco cuerpos estáticos cada uno. Convexos poligonales exactos para pirámide y prisma. Distribución mezclada por espacios libres, apoyo real, materiales y colisiones.

## 4. Interacción

`interaction.js`, `main.js`: adaptación de pinza y offset de 3.1, ambas manos, VRButton, velocidad de liberación, selección exclusiva, recuperación y liberación segura al perder tracking. Manos de articulaciones procedurales para reducir dependencia de recursos externos.

## 5. Actividad

`game.js`, `hud.js`, `audio.js`: estados e intentos por pieza, comprobación de entrada, interior, apoyo y estabilidad; cuatro contadores, total, errores, precisión, reloj, tiempos desde inicio, inicio/reinicio/salida/recuperación y final. Panel canvas/Three.js dentro del mundo, sin Bootstrap en VR.

## 6. Calidad

Portada y SVG propios; responsive, capacidad XR y carga bajo demanda. Tests reproducibles en navegador, pruebas físicas ejecutadas en Edge sin interfaz, capturas reales y Network/Console registrados. Se documentan fallos observados y arreglos. Las pruebas reales en Quest permanecen pendientes.

## 7. Publicación

Commit y push al remoto de destino realizados; no se hizo force-push. Git tiene autenticación funcional, pero `gh` no tiene sesión y el conector no expone administración de Pages. El navegador controlado se interrumpió, por lo que no se eludieron sus controles. Posteriormente GitHub informó Pages habilitado y el flujo automático de publicación concluyó correctamente; se comprobó la URL HTTPS real. No se atribuye al agente la habilitación de Pages que no ejecutó ni observó. Estado final en `DESPLIEGUE.md`.
