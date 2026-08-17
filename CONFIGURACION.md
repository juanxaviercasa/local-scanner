# Configuración de Nexo Ops

## Propósito

Nexo Ops incorpora una base completa de gestión de proyectos, tareas, archivos, actividad, perfil y administración. La autenticación, la base de datos y el almacenamiento se entregan ya configurados por la plataforma. Las integraciones adicionales se mantienen **desacopladas del código fuente**: se habilitan exclusivamente mediante variables de entorno.

> No se deben guardar claves, tokens ni URLs privadas dentro de archivos de código, documentación pública o el repositorio. Añade los valores desde la sección de secretos del proyecto.

## Variables de entorno configurables

| Variable | Obligatoria | Uso en Nexo Ops | Valor de ejemplo seguro |
|---|---:|---|---|
| `NEXO_MAX_UPLOAD_MB` | No | Límite de tamaño para archivos subidos por proyecto. Si no se define, se aplican **10 MB**. La aplicación limita cualquier valor superior a 20 MB. | `10` |
| `NEXO_ANALYTICS_URL` | No | Placeholder para activar un futuro conector de analítica externo. La aplicación no envía información hasta que se implemente el conector correspondiente. | `https://analitica.tu-dominio.com` |
| `NEXO_NOTIFICATIONS_WEBHOOK_URL` | No | Placeholder para un webhook de notificaciones de actividad. No se realizan llamadas externas mientras no se añada el flujo específico. | `https://hooks.tu-servicio.com/identificador` |
| `NEXO_EXTERNAL_API_BASE_URL` | No | URL base de una futura API de negocio externa. Debe incluir `https://` y no llevar rutas sensibles en texto claro. | `https://api.tu-dominio.com/v1` |
| `NEXO_EXTERNAL_API_KEY` | No | Credencial secreta asociada a `NEXO_EXTERNAL_API_BASE_URL`. Debe cargarse como secreto, nunca como variable visible en el cliente. | `completar-en-secreto` |

La ruta interna `integrations.status` permite comprobar, sin revelar valores, qué placeholders están presentes. Para activar una integración futura se debe añadir su variable de URL y, si corresponde, su clave desde los ajustes del proyecto. La interfaz y el servidor no requieren cambios para reconocer que una configuración está presente; la lógica funcional de cada conector se añadirá cuando se defina su proveedor y alcance.

## Configuración administrada automáticamente

| Área | Configuración administrada | Acción necesaria |
|---|---|---|
| Inicio de sesión | Manus OAuth, cookie de sesión y protección CSRF del flujo de acceso. | No sustituir las rutas de autenticación existentes. |
| Datos | Conexión de base de datos y secreto de sesión. | No añadir una URL de base de datos en el código. |
| Archivos | Credenciales de almacenamiento, subida y URL de descarga a través de almacenamiento S3. | Utilizar el módulo de Archivos; no crear buckets ni claves manuales. |
| Telemetría del proyecto | Variables de analítica integradas de la plataforma. | No editar valores inyectados por el sistema. |

## Puesta en marcha operativa

La persona propietaria del proyecto inicia sesión y queda asignada como administradora en el primer acceso. Desde **Administración** puede asignar los roles `admin` y `user`. El servidor valida el rol antes de entregar el listado de usuarios o de cambiar permisos, por lo que ocultar un botón en la interfaz no es la única barrera de protección.

Para los archivos, el límite se controla en el servidor antes de la subida. Los metadatos se almacenan en la base de datos y el contenido se guarda fuera de ella, en almacenamiento S3. Eliminar un archivo lo retira de las referencias del proyecto; se recomienda confirmar la intención antes de borrar documentación importante.

## Siguiente fase recomendada

Cuando se solicite la fase de pruebas, se ejecutarán las pruebas de autorización preparadas en `server/routers.authorization.test.ts`, las pruebas existentes de sesión, la comprobación de tipos y una revisión visual de los flujos públicos y privados. Esta separación respeta la decisión de no consumir tiempo de pruebas durante la construcción inicial.
