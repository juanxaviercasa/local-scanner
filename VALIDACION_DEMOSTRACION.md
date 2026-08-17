# Validación con datos de demostración

La validación de la ampliación se realizó con ejemplos locales identificados de forma explícita. No se emplearon negocios reales, reseñas, calificaciones, testimonios ni proveedores externos.

| Flujo | Resultado observado | Salvaguarda |
|---|---|---|
| Calibración CSV | La ruta de demostración cargó 10 cierres sintéticos, calculó una conversión del 50 % y mostró seis señales comparables con recomendaciones antes de aplicar pesos. | El CSV reside solo en el estado de la interfaz; no se almacena ni se transmite a proveedores. |
| Prospecto de seguimiento | La pantalla de nueva prospección expone una acción voluntaria para crear o abrir un único prospecto de demostración. | El texto de la interfaz lo etiqueta como dato sintético, sin reseñas ni calificaciones, y prohíbe su uso comercial. |

La ficha creada durante la comprobación mostró el estado **Contacto pendiente**, la próxima acción **Revisar el flujo de demostración** y la entrada correspondiente en la bitácora. La comprobación de solo lectura confirmó que `rating` y `reviewCount` permanecen nulos.

Después de reiniciar el servicio, la ruta de demostración volvió a abrir el mismo prospecto y comunicó que el ejemplo existente se reutilizó. La ficha continuó mostrando la próxima acción y la bitácora, sin errores de carga de módulos.

La prueba tRPC `demo.createValidation` se ejecutó con dobles de persistencia. Confirmó la respuesta `{ prospectId: 701, created: true }`, la creación del registro sintético sin reputación inventada y el registro de una actividad `follow_up_scheduled` con estado `contact_pending` y la acción de revisión de demostración.

La aplicación mantiene por defecto la importación local, el modo sin coste y los conectores comerciales como placeholders inactivos.
