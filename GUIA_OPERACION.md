# Guía de operación integrada

La guía disponible en **Panel → Guía y recorrido** explica el flujo de trabajo completo desde la importación de fuentes autorizadas hasta la preparación de un expediente de auditoría. Está diseñada para servir de referencia dentro de la aplicación y no requiere activar conectores externos.

| Elemento | Propósito | Protección aplicada |
| --- | --- | --- |
| Guía textual | Describe prospección, cualificación, calibración, transición y entrega. | Aclara que no hay scraping, contacto automático, cambio automático de pesos ni entrega externa automática. |
| Recorrido guiado | Presenta cinco pasos operativos con enlaces directos y progreso persistente por cuenta, disponible al volver a iniciar sesión. | El progreso no modifica prospectos, criterios ni conectores. |
| Expediente 2.0 | Entrega una recomendación de creación, recuperación o mejora web, agenda de auditoría, alcance sectorial editable y checklist del SaaS receptor. Puede descargarse como JSON o PDF. | Obliga revisión humana y mantiene la entrega externa desactivada. |

## Verificación visual en escritorio

La revisión confirmó que la guía muestra los cuatro bloques de referencia, el recorrido con cinco pasos y un indicador de progreso. La pantalla de transición presenta la tarjeta **Expediente de auditoría 2.0**, enlaza a la guía, conserva los controles de aptitud, permite seleccionar, crear, editar o eliminar el alcance sectorial y comunica visualmente que la entrega externa sigue en modo placeholder inactivo.

## Verificación móvil

En una vista de 375 px, la guía conserva su jerarquía en una sola columna; los enlaces de cada paso, el control de reinicio y los selectores de aptitud permanecen visibles y alcanzables. La pantalla de transición conserva el resumen del expediente, los controles de política, el selector de alcance sectorial y el aviso de conector inactivo sin desbordamiento horizontal.

## Cobertura automatizada

La prueba `client/src/components/ScannerTour.test.tsx` verifica los cinco pasos, el enlace a prospección, la actualización visible del porcentaje, el guardado del avance y su reinicio. La prueba `server/guideScopeTemplates.router.test.ts` cubre la recuperación y persistencia por usuario, además del CRUD protegido de plantillas sectoriales. La prueba `server/auditPdf.test.ts` valida que el expediente PDF es un documento válido con los metadatos esperados y admite un alcance sectorial personalizado.

La prueba `client/src/components/DashboardLayout.test.tsx` confirma que la barra privada expone el acceso a **Guía y recorrido** en `/app/guia`. La prueba `client/src/pages/Handoffs.test.tsx` verifica en la pantalla de transición la tarjeta **Expediente de auditoría 2.0**, el bloque de alcance sectorial y los accesos visibles a la guía.
