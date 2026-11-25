# GeoPlay VR · Aula Y-8

Clasifica veinte figuras en un salón virtual del Instituto Tecnológico de Pachuca. Cada una de las cuatro mesas tiene un recipiente para esferas, cubos, pirámides o prismas hexagonales. El pizarrón muestra el avance por categoría, los intentos, la precisión y el tiempo de la partida.

**[Jugar en GitHub Pages](https://alonsorgt1.github.io/GeoPlay-VR/)** · [Repositorio de GeoPlay VR](https://github.com/ALONSORGT1/GeoPlay-VR)

![Vista del aula Y-8 con las estaciones y la puntuación proyectada en el pizarrón](docs/evidencias/salon.png)

## Cómo jugar

1. Abre el juego y selecciona **Explorar el laboratorio**. En Meta Quest Browser, entra en VR y apunta a **Comenzar** en el pizarrón.
2. Apunta a una pieza. Aprieta el gatillo del mando o junta el pulgar y el índice para agarrarla. Al soltarla, la pieza conserva el movimiento y el giro de la mano.
3. Deposita la figura por la abertura del recipiente correspondiente. El juego confirma el intento cuando la pieza queda completamente dentro, apoyada y estable durante 0,8 segundos. Cada categoría se completa con cinco aciertos.
4. Usa **Recuperar** para devolver piezas caídas o incorrectas a una mesa. **Reiniciar** mezcla las veinte piezas y restablece el marcador.

En escritorio, arrastra con el ratón y usa la rueda para cambiar la profundidad de la pieza. **Cambiar vista** alterna entre el panorama del salón y la perspectiva frontal del jugador.

## El salón

El modelo de SketchUp se importó a escala 1:1. La planta mide 7,50 × 8,60 m por fuera y 7,10 × 8,20 m entre las caras interiores de los muros. Los muros tienen 3,30 m de altura y la trabe central deja 2,80 m libres. En WebXR, la altura de los ojos y los movimientos proceden del visor.

Las paredes y el terrazo usan muestras de las fotografías del aula. Los ventanales llevan perfiles grises y la puerta reproduce el tono café de la referencia. La placa sobre su ventana conserva el escudo del ITP y la inscripción Y-8 de la fotografía original.

## Ejecución local y pruebas

Ejecuta `python serve.py` en la raíz y abre [la versión local](http://localhost:8080/). El proyecto usa módulos de Three.js y cannon-es cargados desde CDN. Para entrar en realidad virtual desde el visor, abre la versión HTTPS de GitHub Pages.

La simulación aplica gravedad de 9,81 m/s², colisionadores derivados del salón y subpasos adaptados a la velocidad de las piezas. La suite del navegador comprueba, entre otras cosas, la colocación del marcador sobre el pizarrón, la selección de sus botones, los lanzamientos, la recuperación y una partida completa. Abre el modo de pruebas y pulsa **Ejecutar pruebas automáticas**. [Pruebas en GitHub Pages](https://alonsorgt1.github.io/GeoPlay-VR/?test=1) · [Resultados en navegador](docs/evidencias/salon-pruebas.txt)

El salón listo para el navegador está en `assets/salon.glb`. Para regenerarlo y extraer la placa, instala NumPy y Pillow y ejecuta `python tools/convert_salon.py ruta/salon.dae assets/salon.glb ruta/fotografias`. El DAE requiere sus texturas de SketchUp junto al archivo. La carpeta de fotografías debe contener `pared.jpg`, `pared2.jpg`, `piso.jpg` y `puerta.jpg`.

**Autor:** Alonso Ramírez Gutiérrez · Instituto Tecnológico de Pachuca.
