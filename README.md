# Mis Inversiones

PWA personal para registrar, importar y analizar inversiones en Argentina. React + TypeScript + Vite, con datos en **IndexedDB del navegador**. Sin Supabase, servidor de datos, registro de usuario ni sincronización automática. El intercambio entre dispositivos se hace mediante un respaldo CSV completo.

## Ejecutar

Necesitás Node.js 22.12 o posterior (se verificó con Node 24).

```powershell
cd "C:\REGISTRO DE INVERSIONES"
npm ci
npm run dev
```

Abrí **http://127.0.0.1:5173**. También podés usar `iniciar.cmd` después de instalar las dependencias.

La primera apertura muestra una demo ficticia, separada del archivo personal de referencia. Para comenzar, usá **Importar historial → Elegir archivo** y mantené marcado **Reemplazar los datos ficticios de la demo**. No se distribuye la planilla real dentro del código, del build ni de las capturas de demostración.

## Instalar como aplicación y usar sin conexión

```powershell
npm run build
npm run preview
```

La versión compilada se abre en **http://127.0.0.1:4173**. El build genera el manifiesto, íconos PNG y un service worker que precarga aplicación, importador y tipografías locales. El service worker sólo se registra en producción; no en `npm run dev`.

Para instalar en el teléfono, publicá **el contenido de `dist/`** en un alojamiento estático con HTTPS (por ejemplo, GitHub Pages). La configuración usa rutas relativas, por lo que admite una subcarpeta. No hace falta configurar variables de entorno ni credenciales.

### Publicar este repositorio en GitHub Pages

El proyecto incluye `.github/workflows/deploy-pages.yml`, que instala dependencias, ejecuta las pruebas, compila y publica **sólo `dist/`** al subir cambios a `main`.

1. En el repositorio, abrí **Settings → Pages → Build and deployment → Source** y seleccioná **GitHub Actions**.
2. Subí el workflow a `main` junto con el proyecto. No hace falta subir `dist/` al repositorio.
3. En **Actions**, esperá a que **Publicar Mis Inversiones** termine correctamente. También podés iniciarlo con **Run workflow**.
4. Abrí https://tomascabrerabellomo.github.io/Mis-Inversiones/.

No uses **Deploy from a branch → main → / (root)** para este proyecto: eso sirve el `index.html` de desarrollo, que referencia `/src/main.tsx`, y deja la página sin iniciar. GitHub Pages necesita los archivos JavaScript y CSS generados por Vite. Una ejecución exitosa del workflow predeterminado de Pages no verifica que React haya sido compilado.

- Android / Chrome / Edge: menú → **Instalar aplicación**, o el botón en Ajustes cuando el navegador lo ofrezca.
- iPhone / Safari: Compartir → **Agregar a inicio**.
- Abrí la app una vez con conexión y esperá a que termine de cargar. Después puede abrirse, importar y registrar datos sin conexión. Consultar precios externos sí necesita internet.

`localhost` es una excepción segura para probar en la computadora. Una dirección HTTP de la red local no habilita la instalación PWA en el teléfono. Cada navegador, origen, puerto y dispositivo tiene su propia cartera: desarrollo (5173), preview (4173) y la URL publicada son almacenamientos diferentes. Exportá e importá el CSV al cambiar de URL.

## Importar Excel

Se verificó el formato de `registro de inversiones.xlsx`: hojas por año, bloques horizontales de ancho variable, encabezados desplazados o invertidos y agrupaciones por bróker.

1. Elegí el archivo `.xlsx` (hasta 15 MB).
2. Revisá fecha, ticker, mercado, tipo, cuenta, moneda e importe. Podés editar cada asignación y filtrar por corte. Las observaciones incluyen alias sugeridos, montos sin activo y monedas dudosas.
3. Revisá **Dólar**: si el archivo no identifica MEP o blue, la referencia queda como **Manual**. No se adivina el tipo de dólar.
4. Consultá **Conciliación** y **Observaciones**. Los resultados de fórmulas son los valores guardados en el archivo; el importador no ejecuta ni recalcula fórmulas de Excel.
5. Confirmá que revisaste las asignaciones y elegí importar. Por defecto, una cartera real se combina con lo existente; la demo se reemplaza.

Cada importe se conserva como valuación histórica, sin deducir cantidades, compras o ventas. Las fechas sin día se guardan como `AAAA-MM`; sólo al ordenar o limitar un cálculo se toma el final del mes. Nunca se presenta ese día como fecha observada.

La procedencia conserva nombre de archivo, SHA-256, hoja, celda, valor original y fórmula cuando existe. El ID determinista por contenido del archivo y celda evita duplicados al reimportar. Cambiar el nombre del archivo puede producir conflictos de metadatos, pero no registros nuevos; por defecto se conserva lo local. Si el Excel fue modificado, su huella cambia: revisá superposiciones de cortes antes de combinarlo.

Un guion, vacío o error se guarda como `null`, no cero. Los errores también quedan en conciliación. Los subtotales, totales, conversiones derivadas (por ejemplo, «USD en pesos») y diferencias no se suman como posiciones. Un ticker que cambia de fila mantiene la identidad por activo, mercado y cuenta. Los alias se editan en Ajustes y se aplican en futuras importaciones. Los nombres de fondos que mencionan dólares se marcan para revisar: el nombre no demuestra la moneda del importe.

Una ausencia en un corte posterior queda pendiente, sin inventar una venta. Un cero explícito es una valuación conocida. Los meses sin corte aparecen en la navegación y dejan huecos en el gráfico.

## CSV entre dispositivos

Usá **Exportar CSV** en escritorio o **Ajustes → Exportar respaldo CSV** en el teléfono. El respaldo conserva activos, alias, cuentas, valuaciones, operaciones, precios, dólar, conciliación, procedencia y preferencias.

El CSV tiene columnas legibles (`entidad`, `fecha`, `activo`, `cuenta`, `moneda`, `importe`) y una columna `datos` con el registro completo JSON. **En un respaldo, la columna `datos` es la fuente autoritativa**; las columnas legibles son una vista auxiliar. Si necesitás editar importes en Excel, usá el formato simple de valuaciones de abajo. No borres ni alteres IDs de un respaldo.

En el otro dispositivo: Importar historial → elegir CSV → revisar → confirmar. Los IDs impiden duplicados; los registros con el mismo ID y contenido distinto se cuentan como conflictos. Por defecto se conserva la versión local. Podés elegir explícitamente usar la versión del archivo o reemplazar toda la cartera (exportá antes un respaldo). La configuración del CSV se aplica al reemplazar la cartera; al combinar, se mantienen las preferencias locales. No se mezclan cambios de un registro campo por campo.

CSV simple para nuevas valuaciones:

```csv
fecha,cuenta,activo,mercado,moneda,importe
2026-10,IOL,SPY,BYMA,ARS,1300000
2026-10,Galicia,USD,EFECTIVO,USD,500
```

Admite coma o punto y coma como separador, fechas ISO `AAAA-MM` / `AAAA-MM-DD`, y decimal argentino si está correctamente delimitado (`"1.234,56"`). No uses el formato simple para operaciones: cargalas con el formulario o trasladalas mediante el respaldo completo. Al generar CSV, los textos de visualización que podrían interpretarse como fórmulas se neutralizan.

## Registrar operaciones

El botón **+ / Nuevo registro** permite compras, ventas, dividendos, intereses, aportes, retiros, transferencias, aperturas, precios, dólar y valuaciones manuales. Podés crear cuentas y activos en Ajustes. Los tipos incluyen CEDEAR, acción, ETF, bono, letra, FCI, cripto y efectivo.

Para continuar un historial que sólo tiene importes:

1. Abrí una posición en Cartera o buscá el corte en Movimientos → Valuaciones históricas.
2. Seleccioná **Crear apertura / Abrir posición** y confirmá una fecha exacta.
3. Cargá cantidad y costo total de adquisición si los conocés. El costo incluye comisiones. Sin costo, las ganancias quedan sin calcular.
4. Abrí por separado el efectivo de cada cuenta y moneda. Una apertura sustituye la base, no se suma dos veces a la valuación importada.
5. Registrá las operaciones posteriores. En Movimientos podés editarlas; se recalculan los resultados y se rechazan ventas que superen la posición conocida.

Las compras y ventas usan la moneda de cotización del activo. Las transferencias trasladan **efectivo en la misma moneda** entre cuentas propias; no son aportes externos. Esta versión no automatiza conversiones de moneda, transferencias de títulos, splits ni canjes. Podés registrar cortes y ajustes manuales para esas situaciones. Los saldos pueden ser negativos: revisá aperturas o movimientos faltantes.

Una valuación manual es un ajuste de una posición, no un nuevo inventario completo: no convierte las demás posiciones en ausentes. Un nuevo valor manual para la misma fecha, cuenta y activo reemplaza ese valor. Los precios unitarios se usan cuando existe una cantidad conocida; una cotización no inventa cantidades a partir de importes históricos.

## Métodos de cálculo

- **Patrimonio:** todas las posiciones y el efectivo usan la misma referencia MEP, blue o manual y el lado compra/venta elegido. `ARS 1.300.000 + USD 500` a `1.300 ARS/USD` = **ARS 1.950.000 / USD 1.500**. No se toma un dólar de otro mes ni posterior al corte. El total Excel queda disponible para conciliar diferencias de criterio.
- **Datos pendientes:** el total completo queda desconocido si falta una posición. El resumen muestra explícitamente el subtotal conocido. Los gráficos no unen cortes incompletos. La antigüedad y fuente de cada valuación aparecen en su detalle.
- **Variación de valor:** valor final menos inicial. No se etiqueta como rentabilidad cuando sólo hay valuaciones o flujos incompletos.
- **Rendimiento:** Dietz modificado, habilitado por la declaración **Registro completo desde** en Ajustes. `(VF − VI − flujos netos) / (VI + Σ flujo × proporción de días restantes)`. Se requieren valores completos y conversión de cada flujo externo; una transferencia propia no es flujo externo. El cálculo usa días, no orden intradiario, y no se muestra si el capital ponderado es cero o negativo.
- **Ganancias:** costo promedio ponderado; comisión de compra capitalizada y comisión de venta descontada del producido. Ganancia realizada = producido neto − costo proporcional vendido. No realizada = valuación remanente − costo remanente. Se muestran en la moneda del activo.

Ejemplo: ARS 100.000 iniciales + aporte de ARS 20.000 a mitad de período y cierre en ARS 120.000 → ganancia 0 y rendimiento 0 %. Cierre en ARS 131.000 → ganancia ARS 11.000 y rendimiento 10 % (`11.000 / 110.000`). Hay una explicación dentro de la app.

Son resultados nominales: no se calcula inflación, impuestos, TIR, ni rentabilidad anualizada. La integridad del registro de flujos la declara el usuario; la app no puede inferir aportes o ventas a partir de cambios de valuación.

## Cotizaciones externas

**Actualizar cotizaciones** consulta automáticamente los proveedores y guarda fecha y fuente, sin suscripciones, claves ni scraping:

- MEP / blue, compra y venta: [DolarApi](https://dolarapi.com/docs/argentina/operations/get-dolares).
- Cripto en USD: [CoinGecko Simple Price](https://docs.coingecko.com/reference/simple-price), con `include_last_updated_at=true` e ID explícito en Ajustes (por ejemplo `bitcoin`).

La actualización se dispara a pedido. Podés habilitarla automáticamente al abrir y cada 15 minutos mientras la app esté visible (se desactiva para la demo). No corre cuando la app está cerrada. Si el proveedor falla, limita solicitudes o bloquea CORS, se informa el error y se conservan los datos anteriores. La carga manual siempre está disponible. **No hay proveedor automático configurado para BYMA, CEDEARs locales, acciones, bonos, letras o FCI**; la app lo indica en Ajustes. No se usa el precio del subyacente estadounidense para valuar automáticamente un CEDEAR.

## Privacidad y persistencia

El XLSX/CSV se procesa en el navegador. No se suben archivos ni saldos a un servidor. Las únicas consultas externas son las solicitadas a los proveedores de cotizaciones; CoinGecko recibe los identificadores públicos de las criptomonedas. Las tipografías están empaquetadas localmente.

IndexedDB no es un respaldo ni un archivo cifrado. Borrar datos del navegador, usar incógnito o perder el dispositivo puede eliminar la cartera. Exportá periódicamente y protegé tus CSV. Ajustes permite solicitar almacenamiento persistente al navegador. Dos pestañas abiertas usan control de revisión al guardar: una versión antigua no sobrescribe silenciosamente una más reciente; se pide recargar.

## Verificación

```powershell
npm test
npm run build
npm audit
```

Para ejecutar además la prueba sobre el Excel personal (sólo lectura, archivo fuera del repositorio):

```powershell
$env:TEST_WORKBOOK="C:\Users\tomas cabrera\Downloads\registro de inversiones.xlsx"
npm test
```

Las pruebas cubren la conversión ARS/USD, meses sin dólar, fechas mensuales, ausencia de activos, compras con comisión, venta parcial, aperturas sin duplicación, transferencias, aporte sin rentabilidad, rechazo de sobreventa al editar, ticker en distinta fila, errores de fórmulas, totales excluidos, CSV de ida y vuelta y reimportación sin duplicados. La prueba con el archivo personal se omite si no se define `TEST_WORKBOOK`.

La interfaz se verificó con un navegador Chromium en tamaños de escritorio y móvil. Esto no sustituye una prueba de instalación en un iPhone o Android físico. Los detalles del recorrido y de la prueba sin conexión se conservan en `VERIFICACION.md`.

## Estructura

```text
src/model.ts       Tipos, identidad, fechas y formato es-AR
src/engine.ts      Posiciones, efectivo, conversión y rendimiento
src/importer.ts    Excel, CSV, alias y control de duplicados
src/storage.ts     IndexedDB con control de revisión
src/providers.ts   Cotizaciones y manejo de fallas
src/App.tsx        Navegación, movimientos y detalle
src/Dashboard.tsx  Patrimonio, composición y gráficos
src/EntryForm.tsx  Registro y edición
src/ImportPanel.tsx Vista previa y correcciones
src/Settings.tsx   Activos, cuentas y configuración
public/           Íconos, manifiesto y service worker
tests/            Pruebas del modelo y del importador
```
