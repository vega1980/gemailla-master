# Migración y recuperación

1. Caracterizar el recorrido actual con fixtures sin datos personales; fijar resultados y permisos esperados. Elegir un segmento y obligación para el piloto.
2. Crear backend y PostgreSQL aislados. Esquemas versionados para identidades, empresas, membresías, documentos, evaluaciones, hallazgos, acciones, trabajos, consumo, auditoría y outbox. Preservar IDs mediante tabla de correspondencias.
3. Ensayar extracción y transformación con snapshot autorizado. Importación idempotente por versión; manifiesto con conteos, hashes y correspondencias. Conservar timestamps, relaciones, moneda, precisión y estados de cuarentena. Fallar ante registros huérfanos o empresa desconocida.
4. Ejecutar comparación de conteos por empresa, checksums, permisos y resultados funcionales. No aceptar solo igualdad de totales globales.
5. Migrar un módulo y cohorte por vez mediante flag del servidor. Un único escritor por conjunto de datos; no introducir doble escritura sin protocolo explícito de reconciliación. Establecer una breve ventana de bloqueo si no hay captura fiable de cambios.
6. En el corte: bloquear escrituras antiguas, drenar trabajos y eventos, copiar delta, reconciliar, cambiar rutas y verificar acceso/documentos/consumo. Registrar watermark y versión de migración. Evitar que triggers y workers procesen ambos el mismo trabajo.
7. Mantener Firebase en lectura durante una ventana acordada. Retirar SDK, reglas, cuentas y despliegues solo al no quedar consumidores y cumplir retención.

## Recuperación

Antes del corte puede restablecerse la ruta antigua. Después de nuevas escrituras SQL, volver un flag NO recupera esos datos en Firebase: detener escrituras, restaurar/conciliar o aplicar una corrección hacia delante. Ensayar este procedimiento con un conjunto de prueba. Cambios SQL expand/contract; no ejecutar down destructivos para recuperar datos. Restauraciones en instancia separada, validación y cambio controlado. Aprobar RPO/RTO y responsables antes de producción.

## Condiciones para el piloto

E2E completo con dos empresas; tokens inválidos/revocados rechazados; ninguna lectura o relación cruzada; objetos pendientes inaccesibles; citas verificadas y revisión humana; reentrega sin efectos duplicados; cuotas concurrentes sin sobrepaso; alertas y restauración ensayadas. Medir tiempo antes/después, calidad sobre conjunto validado, costo variable por evaluación y disposición a pagar. No declarar esas condiciones cumplidas con este PR documental.
