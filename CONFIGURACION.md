# Configuración de Nexo Local

## Alcance de esta aplicación

**Nexo Local** es el primer eslabón de un flujo de adquisición de clientes locales. Recibe una ubicación y una categoría, consulta una fuente de datos autorizada, conserva los datos recibidos, calcula un puntaje explicable y prepara oportunidades exportables. No realiza campañas de mensajería, generación de webs, automatización comercial ni enriquecimiento no verificable.

> La aplicación no utiliza scraping de interfaces de Google Maps. El proveedor integrado utiliza los endpoints autorizados de Places mediante el proxy gestionado del proyecto. Si una fuente no devuelve un campo, Nexo lo conserva como **No encontrado** o **No analizado**.

## Variables configurables

| Variable | Obligatoria | Función | Ejemplo seguro |
|---|---:|---|---|
| `NEXO_GOOGLE_PLACES_ESTIMATED_COST_CENTS` | No | Coste estimado por operación del proveedor, en céntimos. Sirve para la previsualización y los topes por prospección; no modifica la facturación del proveedor. | `0` |
| `NEXO_GOOGLE_SHEETS_WEBHOOK_URL` | No | Placeholder de un endpoint autorizado que recibirá filas aprobadas para una hoja de cálculo. No se enviarán datos a dicho endpoint hasta añadir la integración de entrega correspondiente. | `https://tu-servicio.example/webhooks/sheets` |
| `NEXO_WEBSITE_ANALYZER_URL` | No | Placeholder para un analizador de sitios externo y autorizado. La versión actual sólo declara el estado de integración; no llama a esta URL. | `https://tu-servicio.example/website-audit` |
| `NEXO_WEBSITE_ANALYZER_API_KEY` | No | Credencial secreta del analizador de sitios. Debe cargarse sólo como secreto, nunca en el cliente ni en el repositorio. | `completar-como-secreto` |

Las variables se añaden desde el panel de secretos del proyecto. **No** se deben colocar en archivos `.env` versionados ni dentro de código de cliente. La ruta `integrations.status` informa únicamente si un placeholder está configurado; nunca revela valores.

## Configuración administrada por la plataforma

| Componente | Cómo se configura | Acción del operador |
|---|---|---|
| Autenticación | OAuth y cookies de sesión gestionadas. | Iniciar sesión desde la aplicación. |
| Base de datos | Conexión y secreto de sesión gestionados. | No configurar ni exponer URL de base de datos. |
| Google Places | Proxy autenticado de Maps del proyecto. | Definir límites de consumo antes de lanzar una prospección. |
| Roles | La persona propietaria queda como administradora al acceder por primera vez. | Administrar cuentas desde la ruta restringida de Administración. |

## Límites de consumo y confirmación

Antes de ejecutar una búsqueda, el sistema calcula una **previsualización** con el texto de búsqueda, resultados máximos efectivos, operaciones estimadas y coste estimado. La ejecución se bloquea si supera el límite diario, mensual o por prospección definido en **Configuración**.

Cada ejecución conserva su estado, eventos y los resultados ya procesados. Si el proveedor falla después de recibir algunos resultados, la prospección queda como **Parcial** y los registros recibidos no se eliminan. En esta versión, una página del proveedor se limita a un máximo de 20 resultados para que el volumen prometido coincida con el volumen solicitado.

## Exportación y contrato de datos

La interfaz permite exportar a CSV sólo los prospectos seleccionados. El esquema se ha preparado para una posterior entrega a Google Sheets mediante `NEXO_GOOGLE_SHEETS_WEBHOOK_URL`. Cada fila mantiene un identificador `lead_id` derivado del negocio y contiene, entre otros, los siguientes campos:

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

## Próxima etapa de validación

Cuando se solicite, la fase de pruebas abarcará el flujo de previsualización y autorización de presupuesto, las restricciones de acceso, la persistencia de una ejecución parcial, el listado de oportunidades, la exportación CSV y la revisión visual responsive. No se ejecutará ninguna consulta de fuente externa durante esa fase sin la confirmación explícita del operador.
