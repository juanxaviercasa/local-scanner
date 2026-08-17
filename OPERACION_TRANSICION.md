# Operación comercial y transición a auditoría

## Propósito

La cola de transición identifica oportunidades que pueden avanzar a la **auditoría web** y, tras revisión humana, prepara un expediente JSON para el SaaS que diseñará o mejorará el sitio. La aplicación no envía contactos ni datos a un tercero de manera automática.

## Criterios de aptitud

La política editable en **Transición a auditoría** combina los siguientes controles:

| Criterio | Valor inicial | Operación |
| --- | ---: | --- |
| Opportunity Score mínimo | 70 | Ajustable entre 0 y 100. |
| Estado comercial | Aptos: `qualified`, `analysis_pending`, `analyzed`, `contact_pending`, `contacted` o `exported` | Siempre se exige para evitar que una oportunidad nueva avance sin revisión. |
| Próxima acción | Obligatoria | Puede desactivarse explícitamente para un flujo interno concreto. |
| Evidencia digital | Obligatoria | Se satisface con ausencia de sitio o con un análisis web registrado; puede desactivarse explícitamente. |

Cuando todos los criterios se cumplen, la persona operadora selecciona **Preparar auditoría**, revisa el expediente y pulsa **Aprobar**. Solo entonces puede descargar el JSON del expediente para una entrega manual controlada.

## Recordatorios y filtros

La cola de prospectos muestra recordatorios de próximas acciones vencidas o próximas, sin enviar mensajes ni llamadas. Los filtros permiten limitar la vista por score, prioridad, estado comercial, vencimiento de próxima acción, preparación para auditoría y presencia web.

## Calibración con CSV autorizado

En **Configuración → Calibración del Opportunity Score** se puede descargar la plantilla CSV y validar sus filas antes de solicitar recomendaciones. El archivo se procesa localmente en la sesión y requiere etiquetas de resultado `ganado` o `perdido`; la aplicación de pesos siempre necesita confirmación explícita.

## Conector del SaaS externo

La entrega externa está bloqueada por defecto. El expediente se descarga localmente hasta que el operador configure una URL autorizada y habilite ambas variables de entorno:

```env
NEXO_HANDOFF_WEBHOOK_URL=https://tu-saas.example/webhooks/nexo
NEXO_ENABLE_HANDOFF_CONNECTOR=true
```

El estado del conector se muestra como **placeholder inactivo** mientras no se cumplan ambas condiciones. Incluso cuando se habilite, se recomienda mantener la aprobación humana y una auditoría de cada entrega.

## Evidencia de la validación visual

La revisión de escritorio confirmó que la pantalla presenta los controles de score, destino, próxima acción y evidencia digital; que la entrega externa se declara como placeholder inactivo; y que la cola de prospectos muestra el recordatorio interno y los filtros comerciales. El prospecto sintético existente tiene score 54, estado `contact_pending`, ausencia de sitio y próxima acción, por lo que no entra con la política inicial de 70; se conserva como comprobación transparente de los criterios.

La comprobación móvil confirmó que los criterios se apilan de forma legible, los controles de requisito mantienen áreas táctiles independientes y la cola de prospectos conserva sus filtros de score, prioridad, estado, vencimiento, preparación y presencia web sin desbordamiento horizontal en los controles.

La prueba automatizada de la política usa un escenario sintético apto, con score 82, estado `contact_pending`, ausencia de sitio y próxima acción registrada. Confirma que puede prepararse para auditoría y que el expediente generado mantiene `externalDelivery.enabled: false`. Un segundo escenario demuestra que, al reducir el mínimo a 50 y desactivar explícitamente los requisitos opcionales, la decisión de aptitud cambia de forma trazable sin alterar datos reales.

> **Alcance de la evidencia actual.** La interfaz, la plantilla y la validación previa de calibración están comprobadas con el CSV local de demostración. La calibración definitiva de pesos debe realizarse posteriormente con un CSV de cierres reales que el operador esté autorizado a tratar. Ese archivo no se ha simulado como información comercial real ni se ha almacenado en la aplicación.

La revisión posterior a la protección persistente confirmó que el registro de demostración aparece con la etiqueta **“Demostración · bloqueada para uso comercial”**, no permite selección para exportación y no figura entre las oportunidades aptas para auditoría. La pantalla de transición conserva la entrega externa en modo placeholder inactivo.

## Protección de datos de demostración

Los ejemplos sintéticos se guardan con la marca persistente `isDemo=1`. Esta marca impide la exportación CSV y Google Sheets, la preparación o aprobación de transición, la generación del expediente y la entrega externa. La barrera se verifica tanto en el evaluador de aptitud como en los procedimientos tRPC `handoffs.queue` y `handoffs.dossier`; no depende únicamente de que la interfaz deshabilite una casilla.

## Automatizaciones internas cubiertas

| Automatización | Estado | Límite deliberado |
| --- | --- | --- |
| Recordatorios de seguimiento | Activa en cada consulta: clasifica próximas acciones vencidas, de hoy y próximas. | Son avisos internos visibles; no envían correo, mensajes ni llamadas. |
| Recalificación para auditoría | Activa al listar o preparar una oportunidad: recalcula score, estado, próxima acción y evidencia digital contra la política actual. | Requiere revisión humana antes de aprobar un expediente. |
| Protección de demostraciones | Activa en exportaciones, transición y expediente; bloquea los registros `isDemo`. | No afecta a negocios reales importados. |
| Validación y recomendación de calibración | Activa localmente al cargar CSV: valida columnas y genera recomendación antes de aplicar pesos. | Los pesos de producción requieren un CSV de cierres reales autorizado y confirmación humana. |
| Entrega al SaaS externo | **No activada a propósito.** | Requiere URL autorizada y `NEXO_ENABLE_HANDOFF_CONNECTOR=true`; hasta entonces solo permite expediente JSON y entrega manual. |

No se programa un trabajo periódico para los avisos porque la clasificación se calcula en tiempo real desde la fecha de la próxima acción y no debe generar comunicaciones externas. La única dependencia pendiente es un CSV real autorizado para calibrar pesos de producción; no es correcto simularlo ni procesarlo sin que el operador lo proporcione.
