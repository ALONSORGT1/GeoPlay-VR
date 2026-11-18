# Borrador de conclusión académica

En esta práctica amplié la propuesta de la práctica 3.1 hacia un laboratorio de clasificación geométrica. Comprendí que la malla determina lo que se ve, el cuerpo rígido mantiene masa y movimiento y el colisionador define los contactos. Una forma visible no adquiere gravedad ni colisiones solamente por dibujarla con Three.js; esas propiedades requieren un mundo físico y sincronización con sus resultados.

La integración permitió estudiar cómo la gravedad, la fricción, la restitución y el paso fijo influyen en la caída y el reposo. Las pirámides y los prismas necesitan colisionadores convexos coherentes con su apariencia. Un agarre también debe mover el cuerpo físico para conservar las colisiones, y la liberación debe devolver una velocidad moderada basada en el movimiento reciente.

Durante las verificaciones de escritorio realizadas con el agente se encontraron límites físicos desactualizados en cuerpos estáticos y validaciones que perdían el contacto cuando los cuerpos entraban en reposo. Se corrigieron actualizando los límites y conservando la evidencia de apoyo mientras el objeto permanece dormido y dentro del bote. Estos problemas mostraron que una escena puede verse correcta y aun tener errores en su simulación o sus reglas.

La precisión se interpreta como aciertos divididos entre intentos confirmados. Los errores deben contarse por depósito confirmado, sin multiplicarse por los contactos. El tiempo global y los cuatro tiempos de llenado permiten comparar el desempeño desde un mismo inicio; no deben incluir pausas ni el tiempo empleado en abrir la página.

**Pendiente de completar por el alumno después de probar el visor:** no afirmo haber verificado personalmente el seguimiento de ambas manos, la comodidad, el audio ni el rendimiento en Meta Quest 3. Registraré esos resultados y agregaré mis métricas reales: aciertos ___/20, errores ___, intentos ___, precisión ___ %, tiempo global ___ y tiempos de esferas ___, cubos ___, pirámides ___ y prismas ___. También anexaré las evidencias de tres intentos incorrectos, recuperación, veinte aciertos y reinicio.
