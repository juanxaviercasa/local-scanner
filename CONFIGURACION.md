# Configuración de Nexo Local

## Alcance de esta aplicación

**Nexo Local** es el primer eslabón de un flujo de adquisición de clientes locales. Puede recibir negocios desde una importación CSV, una entrada manual o un proveedor autorizado opcional; conserva los datos recibidos, calcula un puntaje explicable y prepara oportunidades exportables. No realiza campañas de mensajería, generación de webs, automatización comercial ni enriquecimiento no verificable.

> La aplicación no utiliza scraping de interfaces de Google Maps ni código para eludir sus controles. La importación CSV y manual son las fuentes predeterminadas sin coste. Si se activa Google Places, el proveedor usa únicamente los endpoints autorizados mediante el proxy gestionado del proyecto. Si una fuente no devuelve un campo, Nexo lo conserva como **No encontrado** o **No analizado**.

> **Modo sin coste predeterminado.** Sin variables de integración configuradas, Nexo no solicita ni consume APIs de pago. Puede importar negocios desde CSV o entrada manual, normalizarlos, deduplicarlos, evaluar señales públicas seguras de sus sitios, calcular el Opportunity Score, generar borradores de cualificación y descargar CSV. Google Places, Google Sheets y PageSpeed permanecen como placeholders desactivados hasta que el operador configure sus propios secretos **y** habilite de manera expresa el interruptor de conectores comerciales.

## Variables configurables

| Variable | Obligatoria | Función | Ejemplo seguro |
|---|---:|---|---|
| `NEXO_ENABLE_PAID_CONNECTORS` | No | Interruptor explícito de todos los conectores comerciales. Debe ser exactamente `true` además de las credenciales particulares de cada proveedor. Si falta o tiene otro valor, todos quedan bloqueados como placeholders. | `true` |
| `NEXO_GOOGLE_PLACES_ESTIMATED_COST_CENTS` | No | Coste estimado por operación de Google Places, en céntimos. Solo se usa cuando el operador selecciona este conector oficial. | `0` |
| `NEXO_GOOGLE_SERVICE_ACCOUNT_JSON` | No | Credencial JSON de la cuenta de servicio con la que se escriben prospectos aprobados en Google Sheets. | `completar-como-secreto` |
| `NEXO_GOOGLE_SHEETS_SPREADSHEET_ID` | No | Identificador de la hoja de cálculo destino. La cuenta de servicio debe tener acceso de Editor. | `1EjemploHoja...` |
| `NEXO_GOOGLE_SHEETS_TAB` | No | Nombre de la pestaña destino; si se omite, se utiliza `Prospectos`. | `Prospectos` |
| `NEXO_GOOGLE_PAGESPEED_API_KEY` | No | Clave de PageSpeed Insights. Añade métricas Lighthouse al análisis de sitio; sin ella se mantiene una comprobación pública básica. | `completar-como-secreto` |
| `NEXO_HANDOFF_WEBHOOK_URL` | No | URL autorizada del SaaS externo que recibirá expedientes de auditoría. Por ahora el producto la trata como configuración de placeholder y no realiza envíos automáticos. | `https://tu-saas.example/webhooks/nexo` |
| `NEXO_ENABLE_HANDOFF_CONNECTOR` | No | Interruptor explícito de la futura entrega externa de expedientes. Debe ser exactamente `true` junto con la URL de entrega. | `true` |

Las variables se añaden desde el panel de secretos del proyecto. **No** se deben colocar en archivos `.env` versionados ni dentro de código de cliente. La ruta `integrations.status` informa únicamente si un placeholder está activo; nunca revela valores. Disponer de una clave o de una cuenta de servicio no activa por sí solo ninguna integración: se requiere además `NEXO_ENABLE_PAID_CONNECTORS=true`.

## Costes y cuotas de conectores opcionales

La importación CSV, la entrada manual y la comprobación web pública básica no requieren credenciales de Google ni realizan llamadas a sus servicios. La API de Google Sheets informa que el uso estándar no tiene coste adicional y aplica, entre otras, cuotas de 300 lecturas y 300 escrituras por minuto por proyecto; Google prevé cargos futuros para excesos de cuota durante 2026. [1]

PageSpeed Insights puede consultarse con o sin clave; una clave es recomendable para consultas automatizadas frecuentes. Nexo mantiene el análisis público básico como alternativa cuando no se habilita este conector. [2]

Google Places utiliza facturación por uso y requiere que el proyecto tenga la facturación habilitada; solicitar únicamente los campos necesarios reduce el consumo facturable. Por ello, este conector permanece desactivado de forma predeterminada y la aplicación muestra el plan y los límites antes de ejecutarlo. [3]

## Referencias

[1] [Límites y precios de Google Sheets API](https://developers.google.com/workspace/sheets/api/limits)

[2] [Guía de inicio de PageSpeed Insights API](https://developers.google.com/speed/docs/insights/v5/get-started)

[3] [Uso y facturación de Places API](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing)

## Configuración administrada por la plataforma

| Componente | Cómo se configura | Acción del operador |
|---|---|---|
| Autenticación | OAuth y cookies de sesión gestionadas. | Iniciar sesión desde la aplicación. |
| Base de datos | Conexión y secreto de sesión gestionados. | No configurar ni exponer URL de base de datos. |
| CSV y entrada manual | No requieren credenciales ni llamadas a proveedores. | Importar exclusivamente datos que estés autorizado a usar. |
| Google Places | Proxy autenticado de Maps del proyecto; conector opcional. | Configurar el acceso oficial, definir límites y establecer `NEXO_ENABLE_PAID_CONNECTORS=true` antes de lanzar una prospección. |
| Google Sheets | Cuenta de servicio y hoja compartida como Editor; conector opcional. | Añadir las tres variables de Sheets y establecer `NEXO_ENABLE_PAID_CONNECTORS=true` si se desea entrega directa. |
| Análisis web | Comprobación pública básica por defecto; PageSpeed Insights es opcional. | Añadir la clave de PageSpeed y establecer `NEXO_ENABLE_PAID_CONNECTORS=true` solo para métricas Lighthouse detalladas. |
| Roles | La persona propietaria queda como administradora al acceder por primera vez. | Administrar cuentas desde la ruta restringida de Administración. |

## Límites de consumo y confirmación

Antes de ejecutar una búsqueda, el sistema calcula una **previsualización** con el texto de búsqueda, resultados máximos efectivos, operaciones estimadas y coste estimado. La ejecución se bloquea si supera el límite diario, mensual o por prospección definido en **Configuración**.

Cada ejecución conserva su estado, eventos y los resultados ya procesados. Si el proveedor falla después de recibir algunos resultados, la prospección queda como **Parcial** y los registros recibidos no se eliminan. En esta versión, una página del proveedor se limita a un máximo de 20 resultados para que el volumen prometido coincida con el volumen solicitado.

## Exportación y contrato de datos

La interfaz permite exportar a CSV los prospectos seleccionados. Solo si se configuran las variables de Google Sheets **y** `NEXO_ENABLE_PAID_CONNECTORS=true`, también puede entregar filas aprobadas de forma auditable a la pestaña indicada. Cada fila mantiene un identificador `lead_id` derivado del negocio y contiene, entre otros, los siguientes campos:

| Grupo | Campos incluidos |
|---|---|
| Identidad | `lead_id`, `business_name`, `category`, `location`, `address`, `phone` |
| Fuente | `source`, `google_maps_url`, `google_rating`, `google_review_count` |
| Presencia digital | `website`, `website_status`, `website_quality`, `social_profiles`, `whatsapp`, `booking` |
| Oportunidad | `opportunity_score`, subpuntuaciones, `priority`, `opportunity_types`, `opportunity_reasons`, `ai_summary` |
| Trazabilidad | `date_analyzed` |

Nexo Local sólo actualiza los datos que genera. Los campos que correspondan a auditoría web, propuestas, comunicación o ventas se reservan para aplicaciones posteriores y no se eliminan ni sustituyen desde este producto.

## Puntuación explicable

El Opportunity Score se calcula con reglas deterministas sobre señales disponibles: ausencia de sitio web, sitio no disponible o mejorable, reseñas, valoración, teléfono, reservas y WhatsApp. La pantalla de configuración permite modificar los pesos del perfil base mediante JSON numérico. La ficha de cada negocio muestra las razones y los puntos que contribuyeron a su puntaje.

### Calibración local con cierres reales

La sección **Calibrar con resultados reales** acepta un CSV local de oportunidades ya cerradas. El archivo debe incluir una columna `resultado` con `ganado` o `perdido`; puede añadir las columnas `sin_sitio`, `sitio_debil`, `resenas`, `calificacion`, `telefono`, `reservas`, `whatsapp` y `potencial_comercial` si esos datos están disponibles. Las celdas booleanas aceptan `sí`, `true`, `1` o `x`.

El archivo se interpreta en el navegador y solo se envían al backend de la aplicación las filas necesarias para calcular recomendaciones. No se sube a almacenamiento ni se comparte con proveedores externos. La recomendación compara la tasa de conversión de cada señal con la tasa de conversión de la muestra; únicamente considera factores con evidencia suficiente y **no se aplica** hasta que el operador pulse `Aplicar pesos sugeridos`.

### Seguimiento comercial interno

Cada prospecto puede avanzar entre los estados de cualificación, demo, contacto, conversión o descarte ya disponibles. La ficha permite registrar una nota comercial, una próxima acción con fecha y hora, y las notas internas persistentes. Cada cambio comercial crea una entrada de bitácora con el estado anterior y posterior, la acción programada y la fecha de registro. Cuando el estado cambia por primera vez a `Contactado`, se conserva también la fecha del contacto. Estas operaciones no envían mensajes ni modifican datos procedentes de la fuente.

### Transición a auditoría y SaaS posterior

La ruta **Transición a auditoría** implementa la siguiente fase prevista del producto: filtra oportunidades por Opportunity Score, estado comercial, próxima acción y evidencia digital; permite preparar una cola; requiere aprobar el expediente; y descarga un JSON de auditoría para la entrega manual al SaaS que crea o mejora el sitio web. El umbral, el destino y los requisitos de próxima acción o evidencia digital son configurables por la persona operadora.

El conector externo se mantiene como **placeholder inactivo** incluso si existe una URL. Solo puede considerarse activo al configurar `NEXO_HANDOFF_WEBHOOK_URL` y `NEXO_ENABLE_HANDOFF_CONNECTOR=true`; hasta entonces no se transmite información a terceros. El detalle operativo y la evidencia de validación se encuentran en `OPERACION_TRANSICION.md`.

## Validación automatizada realizada

La validación no ejecuta consultas de proveedores externos ni genera cargos. Cubre las reglas que deciden si una prospección puede iniciar, las protecciones de acceso, la puntuación y la seguridad del archivo de salida.

| Procedimiento crítico | Prueba asociada | Comportamiento comprobado |
|---|---|---|
| Cierre de sesión | `server/auth.logout.test.ts` | Elimina la cookie de sesión con opciones seguras. |
| Rutas protegidas y administración | `server/routers.authorization.test.ts` | Rechaza módulos privados sin sesión y las rutas administrativas para el rol `user`. |
| Opportunity Score | `server/scoring.test.ts` | Prioriza ausencia de sitio, identifica rediseño y no formula una oportunidad digital sin señales verificadas. |
| Previsualización y presupuesto | `server/scannerPolicies.test.ts` | Aplica el tope efectivo de resultados y bloquea consumo diario fuera de presupuesto. |
| Consumo real | `server/scannerPolicies.test.ts` | Indica detener el procesamiento si el proveedor excede las operaciones o el coste autorizados. |
| Exportación CSV | `server/scannerPolicies.test.ts` | Escapa comillas, serializa estructuras y neutraliza celdas que una hoja de cálculo podría interpretar como fórmulas. |
| Análisis web público | `server/websiteAnalyzer.test.ts` | Permite revisar solo destinos públicos y conserva la alternativa básica mientras PageSpeed permanezca como placeholder. |
| Google Sheets opcional | `server/googleSheets.test.ts` | Formatea de forma segura las celdas estructuradas y mantiene la hoja inactiva sin el interruptor expreso. |
| Borradores de cualificación | `server/templates.test.ts` | Sustituye únicamente variables conocidas y no inicia ninguna comunicación. |
| Calibración CSV | `server/scoringCalibration.test.ts` | Calcula recomendaciones explicables desde resultados etiquetados y exige una muestra mínima. |
| Seguimiento comercial | `server/prospectFollowup.test.ts` | Conserva próximas acciones, registra el cambio de estado y detecta el primer contacto. |
| Protección de demostraciones | `server/demoGuard.test.ts`, `server/demoHandoff.router.test.ts` | Rechaza registros `isDemo` en exportaciones, cola de auditoría y expediente antes de que puedan entrar en un flujo comercial. |

Las pruebas se ejecutan con `pnpm test`; la comprobación estática se ejecuta con `pnpm exec tsc --noEmit`.
