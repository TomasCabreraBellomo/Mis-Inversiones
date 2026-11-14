# Verificación de la primera versión

Fecha local: 12 de noviembre de 2026 (America/Argentina/Buenos_Aires).

## Compilación y dependencias

- `npm run build`: correcto, con chequeo TypeScript y generación de recursos PWA.
- `npm audit`: 0 vulnerabilidades reportadas al finalizar.
- Tipografías e importador XLSX incluidos en el caché de producción; no dependen de una CDN para abrir la app sin conexión.

## Pruebas del dominio e importación

18 pruebas pasaron con `TEST_WORKBOOK` apuntando al Excel personal, en modo de sólo lectura.

- Conversión consolidada: ARS 1.300.000 + USD 500, a ARS 1.300 por USD → ARS 1.950.000 / USD 1.500.
- Dólar faltante: no se usa la cotización de otro mes ni una posterior al corte.
- Ausencias y valores desconocidos: se conservan como datos pendientes, sin convertirlos en cero.
- Compra con comisión y venta parcial: cantidades, efectivo, costo promedio, resultado realizado y no realizado.
- Apertura desde un corte: la valuación no se suma nuevamente al sumar operaciones posteriores.
- Edición que produciría sobreventa: rechazada.
- Edición de una operación: conserva el orden de creación de las operaciones del mismo día.
- Transferencia propia: mueve efectivo sin generar aporte ni patrimonio.
- Aporte externo sin cambio de precio: aumenta patrimonio y produce rendimiento ajustado cero.
- Sin historial completo: sólo se informa variación de valor.
- Ajuste manual individual: no marca el resto de las posiciones como ausentes.
- Flujo en otra moneda sin dólar disponible: importe consolidado desconocido, no cero.
- Exportación e importación CSV: conserva registros y preferencias.
- Reimportación: no agrega IDs duplicados; detecta conflictos y conserva la versión local por defecto.
- Ticker en distinta fila: conserva identidad y valores de ambos cortes.
- Fechas mensuales, errores de fórmula, separación de totales y CSV con decimal argentino.
- Rechazo de fecha / moneda inválida.
- Planilla de referencia: detectó 24 cortes y 723 valuaciones, sin inventar movimientos. Reconoció los encabezados variables de 2026, los errores de fórmulas y una celda con importe sin activo. El archivo personal no se incluyó en el build ni en el proyecto.

## Recorrido de navegador

Chromium automatizado con Playwright CLI. Escritorio: 1440 × 1000. Móvil: viewport de 390 × 844.

1. Apertura de la demo y revisión visual de resumen, navegación por período, tarjetas, composición y posiciones.
2. Carga de un aporte ficticio de ARS 100.000 en IOL.
3. Edición del aporte a ARS 125.000 desde Movimientos.
4. Recarga: persistencia verificada y patrimonio ficticio de ARS 14.635.000.
5. Descarga del respaldo CSV desde la interfaz.
6. Reimportación en el mismo navegador: **0 nuevos, 126 duplicados omitidos**.
7. Vista previa del Excel personal: 24 cortes, 723 valuaciones, 0 movimientos y 91 observaciones estructurales / de fórmulas. Se revisaron, por ejemplo, `2026!U61` con `#REF!` y `2026!L6` con `#DIV/0!`. No se confirmó la carga de información personal en el perfil de pruebas.
8. Sesión móvil independiente, sobre la versión de producción en otro origen: importación del CSV y mismo patrimonio de ARS 14.635.000 después de recargar.
9. Service worker activo. Con la red desconectada, recarga correcta y cartera disponible.
10. Carga de un aporte ficticio de ARS 500 sin conexión y nueva recarga: patrimonio ARS 14.635.500, sin perder registros.
11. Diseño móvil sin desborde de página: ancho de documento 390 px, viewport 390 px. Las tablas extensas tienen desplazamiento interno.
12. Consulta de un punto del gráfico mediante interacción de puntero en tamaño móvil, con tooltip y lectura del corte.
13. Cotizaciones reales: DolarApi respondió MEP / blue con compra, venta y timestamp; CoinGecko respondió Bitcoin con timestamp. Se guardaron en la sesión ficticia. No hubo errores de ejecución en las consolas revisadas.

Las capturas y CSV ficticios del recorrido quedan en `output/playwright/`, excluidos del control de versiones. Los logs del navegador quedan en `.playwright-cli/`, también excluidos.

## Límites de la comprobación

Se comprobó el layout móvil en Chromium y la operación PWA sin conexión. No se probó la instalación en un teléfono físico ni en Safari iOS. No se publicó la app; el README explica cómo servir `dist/` mediante HTTPS para instalarla en el teléfono.

Los proveedores de cotizaciones pueden cambiar, limitar solicitudes o fallar; la app conserva los precios previos y permite carga manual. No hay conexión automática a brókers argentinos, ni importación automática de cuentas o transacciones. La declaración de integridad de flujos la realiza el usuario.
