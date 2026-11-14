import Papa from 'papaparse';
import { type Data, type Asset, type Currency, type Source, type Table, type Valuation, type AssetType, tables, assetTypes, emptyData, norm, assetKey, accountKey, now, parseNumber, validDate, dateEnd } from './model';
export interface ImportIssue { location: string; message: string; level: 'warning' | 'error' }
export interface Preview { data: Data; issues: ImportIssue[]; blocks: { sheet: string; date: string; column: string; count: number }[]; filename: string; hash: string }
const months = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
const aliases: Record<string, string> = { 'S&P500': 'SPY', 'SP500': 'SPY', 'S&P 500': 'SPY', 'ARK INNOVATION': 'ARKK', 'ARK': 'ARKK', 'JUMIA': 'JMIA', 'LOMA NEGRA': 'LOMA', 'YPF': 'YPFD' };
export function identify(label: string, currentAccount: string): { asset: Asset; account: string; warnings: string[] } {
  const n = norm(label), warnings: string[] = [];
  let account = currentAccount || 'Sin asignar';
  if (/IOL/.test(n)) account = 'IOL'; else if (/COCOS|COCOR|COCOSA/.test(n)) account = 'Cocos'; else if (/BRUBANK|SBS/.test(n)) account = 'Brubank'; else if (/BINANCE/.test(n)) account = 'Binance';
  let currency: Currency = 'ARS', type: AssetType = 'Otro', market = 'BYMA', ticker = aliases[n] ?? n;
  if (/^(USD|DOLAR)|FISICO|^EFECTIVO$|^ARS|LIQUIDEZ/.test(n)) {
    type = 'Efectivo'; market = 'EFECTIVO'; currency = /^USD|^DOLAR/.test(n) && !/EN PESOS/.test(n) ? 'USD' : 'ARS'; ticker = currency;
    if (/FISICO|^EFECTIVO$|EFECTIVO/.test(n)) account = 'Efectivo';
    else if (/GALICIA/.test(n)) account = 'Galicia'; else if (/BANCO/.test(n)) account = 'Banco';
    else if (/MEP/.test(n)) { account = 'Dólares MEP'; warnings.push('Confirmá la cuenta de los dólares MEP.'); }
    else if (/BROKER|LIQUIDOS/.test(n)) { account = 'Liquidez por asignar'; warnings.push('Asigná la cuenta del saldo líquido.'); }
  } else if (/FCI|SBS|COCOS.*PLUS|^COCOR|^COCOSUSD|^COCOSAUSD|^IOLPOR|^IOLDOL|^PRM|^PREPE|^CNX/.test(n)) type = 'FCI';
  else if (/LETRA|LECAP|^S\d|^X\d/.test(n)) type = 'Letra';
  else if (/BONO|^AL\d|^AE\d|^GD\d|^AO\d|^TZ|^TX/.test(n)) type = 'Bono';
  else if (/BINANCE|BITCOIN|^BTC$|^ETH$/.test(n)) { type = 'Cripto'; market = 'CRYPTO'; warnings.push('Confirmá activo y moneda de la posición cripto.'); }
  else if (/^(YPFD|GGAL|BMA|BYMA|SUPV|LOMA|TGNO4|TGN04|TGN|ADBAICA)$/.test(ticker)) { type = 'Acción'; if (/TGN|ADBAICA/.test(ticker)) warnings.push('Revisá el ticker; no se corrige automáticamente.'); }
  else if (/^[A-Z][A-Z0-9.]{0,7}$/.test(ticker)) type = 'CEDEAR';
  if (aliases[n]) warnings.push(`Alias propuesto: ${label} → ${ticker}. Revisalo antes de importar.`);
  if (type !== 'Efectivo' && /DOLAR|USD/.test(n)) warnings.push('El nombre menciona USD; el monto se conserva en ARS hasta confirmar su moneda.');
  if (account === 'Sin asignar' || type === 'Otro') warnings.push('Revisá cuenta, tipo de activo y mercado.');
  return { asset: { id: assetKey(ticker, market), updatedAt: now(), ticker, name: type === 'Efectivo' ? `Efectivo en ${currency}` : label, type, market, currency, aliases: [label] }, account, warnings };
}
export const hashBytes = async (bytes: ArrayBuffer) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(b => b.toString(16).padStart(2, '0')).join('');
function putAsset(data: Data, asset: Asset, account: string) {
  const existing = data.assets.find(a => a.id === asset.id);
  if (!existing) data.assets.push(asset); else existing.aliases = [...new Set([...existing.aliases, ...asset.aliases])];
  const accountId = accountKey(account);
  if (!data.accounts.some(a => a.id === accountId)) data.accounts.push({ id: accountId, name: account, updatedAt: now() });
  return accountId;
}
export async function parseWorkbook(bytes: ArrayBuffer, filename: string): Promise<Preview> {
  const ExcelJS = await import('exceljs');
  const book = new ExcelJS.default.Workbook();
  await book.xlsx.load(bytes);
  const hash = await hashBytes(bytes), data = emptyData(), issues: ImportIssue[] = [], blocks: Preview['blocks'] = [];
  for (const sheet of book.worksheets) {
    const year = sheet.name.match(/20\d{2}/)?.[0];
    if (!year) { issues.push({ location: sheet.name, message: 'Hoja sin año: no se detectaron cortes. Usá CSV con fecha explícita.', level: 'warning' }); continue; }
    if (sheet.rowCount > 5000 || sheet.columnCount > 500) throw new Error('La hoja excede el límite de 5.000 filas o 500 columnas. Dividí el archivo.');
    const raw = (r: number, c: number): unknown => { const v = sheet.getCell(r, c).value; if (v && typeof v === 'object') { if ('result' in v) return v.result ?? null; if ('error' in v) return v.error; if ('richText' in v) return v.richText.map(x => x.text).join(''); if ('text' in v) return v.text; return null; } return v; };
    const labelAt = (r: number, c: number) => { const v = raw(r, c); return typeof v === 'string' ? v.trim() : ''; };
    const sourceAt = (r: number, c: number): Source => ({ file: filename, hash, sheet: sheet.name, cell: sheet.getCell(r, c).address, raw: String(raw(r, c) ?? ''), formula: sheet.getCell(r, c).formula });
    const labelColumns: number[] = [];
    for (let c = 1; c < sheet.columnCount; c++) {
      let labels = 0, values = 0;
      for (let r = 4; r <= sheet.rowCount; r++) { const l = labelAt(r, c); if (/[a-záéíóúñ]/i.test(l) && !/^[#%]/.test(l)) { labels++; if (parseNumber(raw(r, c + 1)) != null || /^[-–—]$/.test(labelAt(r, c + 1))) values++; } }
      if (labels >= 3 && values >= 2) labelColumns.push(c);
    }
    for (const c of labelColumns) {
      let date = '', month = -1;
      // Physical contents determine the label/value pair, even where headers are reversed.
      for (let r = 1; r <= 4; r++) for (let h = Math.max(1, c - 1); h <= Math.min(sheet.columnCount, c + 1); h++) {
        const label = norm(labelAt(r, h));
        const m = months.findIndex(name => label === name);
        if (m >= 0) month = m;
        const match = h >= c && label.match(/(?:DETALLE|AL).*?(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
        if (match) date = `${match[3] ?? year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
      }
      if (!date && month >= 0) date = `${year}-${String(month + 1).padStart(2, '0')}`;
      if (!validDate(date)) { issues.push({ location: `${sheet.name}!${sheet.getColumn(c).letter}`, message: 'No se pudo identificar la fecha del bloque.', level: 'error' }); continue; }
      let account = 'Sin asignar', fxKind: 'MEP' | 'Blue' | 'Manual' = 'Manual', fxActive = false, count = 0;
      const nextCol = labelColumns.find(col => col > c) ?? sheet.columnCount + 1;
      for (let r = 4; r <= sheet.rowCount; r++) {
        let label = labelAt(r, c); const amount = parseNumber(raw(r, c + 1)); let n = norm(label);
        if (!label && amount != null) { label = `Sin identificar ${sheet.getCell(r, c).address}`; n = norm(label); issues.push({ location: `${sheet.name}!${sheet.getCell(r, c + 1).address}`, message: 'Importe sin activo. Asignalo en la vista previa.', level: 'warning' }); }
        if (!label || /^DETALLE|^IMPORTE|^MONTO|^%|^REGISTRO/.test(n)) continue;
        if (/COTIZACION/.test(n)) { fxKind = /MEP|BOLSA/.test(n) ? 'MEP' : /BLUE/.test(n) ? 'Blue' : 'Manual'; fxActive = true; if (fxKind === 'Manual') issues.push({ location: `${sheet.name}!${sheet.getCell(r, c).address}`, message: 'Tipo de dólar no indicado: se conserva como Manual.', level: 'warning' }); continue; }
        if (fxActive && /^(COMPRA|VENTA)$/.test(n)) {
          const id = `${hash}:${sheet.name}:${date}:fx`, side = n === 'COMPRA' ? 'buy' : 'sell';
          let fx = data.fx.find(f => f.id === id);
          if (!fx) { fx = { id, updatedAt: now(), date, kind: fxKind, buy: null, sell: null, source: `${filename} · ${sheet.name}!${sheet.getCell(r, c + 1).address}` }; data.fx.push(fx); }
          fx[side] = amount; continue;
        }
        if (/^(TOTAL|SUBTOTAL)|^USD EN PESOS|^DIF/.test(n)) {
          data.reconciliations.push({ id: `${hash}:${sheet.name}:${sheet.getCell(r, c + 1).address}`, updatedAt: now(), date, label, currency: /TOTAL USD/.test(n) ? 'USD' : 'ARS', amount, scope: /^(TOTAL ARS|TOTAL PESOS|TOTAL USD)$/.test(n) ? 'total' : /^DIF/.test(n) ? 'difference' : 'subtotal', source: sourceAt(r, c + 1) }); continue;
        }
        if (/^(IOL( INVERSIONES)?|COCOS( CAPITAL)?|BRUBANK)$/.test(n) && amount == null) { account = n.startsWith('IOL') ? 'IOL' : n.startsWith('COCOS') ? 'Cocos' : 'Brubank'; continue; }
        const identified = identify(label, account);
        if (identified.asset.type === 'Efectivo' && identified.asset.currency === 'USD' && (amount ?? 0) > 100000) identified.warnings.push('Importe elevado en USD: podría estar expresado en ARS. Confirmá la moneda.');
        const accountId = putAsset(data, identified.asset, identified.account);
        const source = sourceAt(r, c + 1);
        const notes = [...identified.warnings]; if (amount == null) notes.push('Importe faltante o error: no se convierte en cero.');
        data.valuations.push({ id: `${hash}:${sheet.name}:${source.cell}`, updatedAt: now(), date, precision: date.length === 7 ? 'month' : 'day', assetId: identified.asset.id, accountId, currency: identified.asset.currency, amount, source, note: notes.join(' ') });
        count++;
        for (let dc = c + 2; dc < nextCol; dc++) { const diff = parseNumber(raw(r, dc)); if (diff != null) data.reconciliations.push({ id: `${hash}:${sheet.name}:${sheet.getCell(r, dc).address}`, updatedAt: now(), date, label: `${label} · diferencia original`, currency: 'ARS', amount: diff, scope: 'difference', source: sourceAt(r, dc) }); }
      }
      blocks.push({ sheet: sheet.name, date, column: sheet.getColumn(c).letter, count });
    }
    sheet.eachRow(row => row.eachCell(cell => { const v = cell.value, result = raw(Number(cell.row), Number(cell.col)); const error = typeof result === 'string' && /^#(?:REF!|DIV\/0!|VALUE!|N\/A|NAME\?|NUM!|NULL!)/.test(result) ? result : v && typeof v === 'object' && ('error' in v ? v.error : 'result' in v && v.result && typeof v.result === 'object' && 'error' in v.result ? v.result.error : undefined); if (error) { const block = [...blocks].filter(b => b.sheet === sheet.name).reverse().find(b => sheet.getColumn(b.column).number <= Number(cell.col)); const source = sourceAt(Number(cell.row), Number(cell.col)); issues.push({ location: `${sheet.name}!${cell.address}`, message: `Error de fórmula ${error}. Se conserva para conciliación.`, level: 'error' }); data.reconciliations.push({ id: `${hash}:${sheet.name}:${cell.address}:error`, updatedAt: now(), date: block?.date ?? `${year}-01`, label: `${error}: ${cell.formula ?? ''}`, currency: 'ARS', amount: null, scope: 'error', source }); } }));
  }
  if (!blocks.length) throw new Error('No se encontraron bloques mensuales. Usá el formato CSV de ejemplo.');
  return { data, issues, blocks, filename, hash };
}
const safeCsvText = (s: string) => /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
export function exportCsv(data: Data): string {
  const rows: Record<string, unknown>[] = [];
  for (const table of tables) for (const record of data[table]) {
    const r = record as unknown as Record<string, unknown>;
    rows.push({ formato: 'mis-inversiones-v1', entidad: table, id: r.id, fecha: r.date ?? '', activo: safeCsvText(data.assets.find(a => a.id === r.assetId)?.ticker ?? String(r.ticker ?? '')), cuenta: safeCsvText(data.accounts.find(a => a.id === r.accountId)?.name ?? ''), moneda: r.currency ?? '', importe: r.amount ?? r.value ?? '', datos: JSON.stringify(record) });
  }
  rows.push({ formato: 'mis-inversiones-v1', entidad: 'settings', id: 'settings', fecha: '', activo: '', cuenta: '', moneda: '', importe: '', datos: JSON.stringify(data.settings) });
  return '\uFEFF' + Papa.unparse(rows, { quotes: true, newline: '\r\n' });
}
function assertRecord(table: Table, record: unknown): asserts record is Data[Table][number] {
  if (!record || typeof record !== 'object' || !('id' in record) || typeof record.id !== 'string' || !record.id || !('updatedAt' in record) || typeof record.updatedAt !== 'string') throw new Error(`Registro inválido en ${table}.`);
  const r = record as Record<string, unknown>;
  const required: Record<Table, string[]> = { assets: ['ticker', 'name', 'market', 'type', 'currency'], accounts: ['name'], valuations: ['date','assetId','accountId','currency','precision'], movements: ['date','accountId','kind','currency'], prices: ['date','assetId','currency','source'], fx: ['date','kind','source'], reconciliations: ['date','label','currency','scope'] };
  for (const field of required[table]) if (typeof r[field] !== 'string') throw new Error(`Falta ${field} en ${table}.`);
  if (r.date != null && !validDate(String(r.date))) throw new Error(`Fecha inválida en ${table}.`);
  if (r.currency != null && !['ARS','USD'].includes(String(r.currency))) throw new Error('Moneda no admitida.');
  for (const field of ['amount','value','quantity','price','fee','cost','buy','sell']) if (r[field] != null && (typeof r[field] !== 'number' || !Number.isFinite(r[field]))) throw new Error(`Número inválido: ${field}.`);
  if (table === 'assets' && (!Array.isArray(r.aliases) || !r.aliases.every(a => typeof a === 'string') || !assetTypes.includes(r.type as AssetType))) throw new Error('Tipo de activo o alias inválidos.');
  if (table === 'movements' && (!['Compra','Venta','Apertura','Aporte','Retiro','Transferencia','Dividendo','Interés'].includes(String(r.kind)) || !(Number(r.amount) >= 0) || !(Number(r.fee) >= 0))) throw new Error('Movimiento inválido.');
  if (table === 'prices' && !(Number(r.value) > 0)) throw new Error('Precio inválido.');
  if (table === 'valuations' && (!['day','month'].includes(String(r.precision)) || !('amount' in r))) throw new Error('Valuación inválida.');
  if (table === 'movements' && ['Compra','Venta'].includes(String(r.kind)) && (typeof r.assetId !== 'string' || !(Number(r.quantity) > 0) || !(Number(r.price) > 0))) throw new Error('La operación necesita activo, cantidad y precio positivos.');
  if (table === 'movements' && r.kind === 'Transferencia' && (typeof r.toAccountId !== 'string' || r.toAccountId === r.accountId)) throw new Error('Destino de transferencia inválido.');
  if (table === 'fx' && (!['MEP','Blue','Manual'].includes(String(r.kind)) || ['buy','sell'].some(k => r[k] != null && !(Number(r[k]) > 0)))) throw new Error('Tipo de cambio inválido.');
}
export async function parseCsv(text: string, filename: string): Promise<Preview> {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ''), { header: true, skipEmptyLines: 'greedy', transformHeader: h => h.trim().toLowerCase() });
  if (parsed.errors.length) throw new Error(`CSV inválido: ${parsed.errors[0].message}`);
  if (parsed.data.length > 50000) throw new Error('El CSV supera 50.000 filas.');
  const data = emptyData(), hash = await hashBytes(new TextEncoder().encode(text).buffer), issues: ImportIssue[] = [];
  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    if (row.formato === 'mis-inversiones-v1') {
      const record: unknown = JSON.parse(row.datos);
      if (row.entidad === 'settings') { const s = record as Data['settings']; if (!s || !['ARS','USD'].includes(s.currency) || !['MEP','Blue','Manual'].includes(s.fxKind) || !['buy','sell'].includes(s.fxSide)) throw new Error('Configuración inválida.'); data.settings = s; }
      else if (tables.includes(row.entidad as Table)) { const table = row.entidad as Table; assertRecord(table, record); (data[table] as unknown[]).push(record); }
      else throw new Error(`Entidad no reconocida en fila ${i + 2}.`);
    } else {
      const date = row.fecha?.trim(), label = row.activo?.trim();
      if (!validDate(date ?? '') || !label) throw new Error(`Fila ${i + 2}: necesitás fecha ISO (AAAA-MM o AAAA-MM-DD) y activo.`);
      const found = identify(label, row.cuenta?.trim() || 'Sin asignar');
      if (row.moneda && !['ARS','USD'].includes(row.moneda.toUpperCase())) throw new Error(`Fila ${i + 2}: moneda inválida.`);
      found.asset.currency = (row.moneda?.toUpperCase() || found.asset.currency) as Currency;
      if (row.mercado) found.asset.market = row.mercado.trim().toUpperCase();
      found.asset.id = assetKey(found.asset.ticker, found.asset.market);
      const accountId = putAsset(data, found.asset, row.cuenta?.trim() || found.account);
      data.valuations.push({ id: `${hash}:csv:${i + 2}`, updatedAt: now(), date, precision: date.length === 7 ? 'month' : 'day', assetId: found.asset.id, accountId, currency: found.asset.currency, amount: parseNumber(row.importe), source: { file: filename, hash, sheet: 'CSV', cell: String(i + 2), raw: row.importe }, note: found.warnings.join(' ') });
    }
  }
  for (const v of [...data.valuations, ...data.movements, ...data.prices]) { if ('assetId' in v && v.assetId && !data.assets.some(a => a.id === v.assetId)) throw new Error('El CSV contiene un activo sin definición. Exportá el respaldo completo.'); if ('accountId' in v && !data.accounts.some(a => a.id === v.accountId)) throw new Error('El CSV contiene una cuenta sin definición.'); }
  return { data, issues, blocks: [...new Set(data.valuations.map(v => v.date))].sort().map(date => ({ date, sheet: 'CSV', column: '', count: data.valuations.filter(v => v.date === date).length })), filename, hash };
}
export function mergeData(current: Data, incoming: Data, replace = false, overwrite = false) {
  const result = structuredClone(replace ? emptyData() : current);
  let added = 0, duplicates = 0, conflicts = 0;
  for (const table of tables) for (const record of incoming[table]) {
    const target = result[table] as { id: string; updatedAt: string }[];
    const index = target.findIndex(x => x.id === record.id);
    if (index < 0) { target.push(record); added++; }
    else { const a = { ...target[index], updatedAt: '' }, b = { ...record, updatedAt: '' }; if (JSON.stringify(a) === JSON.stringify(b)) duplicates++; else { conflicts++; if (overwrite) target[index] = record; } }
  }
  if (replace) result.settings = { ...incoming.settings, demo: false }; else result.settings.demo = false;
  return { data: result, added, duplicates, conflicts };
}
export function remapValuation(data: Data, id: string, patch: { ticker?: string; market?: string; account?: string; currency?: Currency; amount?: number | null; date?: string; type?: AssetType }) {
  const next = structuredClone(data), v = next.valuations.find(x => x.id === id)!;
  const asset = next.assets.find(a => a.id === v.assetId)!;
  if (patch.ticker || patch.market || patch.type || patch.currency) {
    const changed = { ...asset, ticker: patch.ticker || asset.ticker, market: patch.market || asset.market, type: patch.type || asset.type, currency: patch.currency || asset.currency, updatedAt: now() };
    changed.id = assetKey(changed.ticker, changed.market); const existing = next.assets.find(a => a.id === changed.id); if (!existing) next.assets.push(changed); else Object.assign(existing, changed); v.assetId = changed.id;
  }
  if (patch.account) { v.accountId = accountKey(patch.account); if (!next.accounts.some(a => a.id === v.accountId)) next.accounts.push({ id: v.accountId, updatedAt: now(), name: patch.account }); }
  if (patch.currency) v.currency = patch.currency;
  if ('amount' in patch) v.amount = patch.amount ?? null;
  if (patch.date && validDate(patch.date)) { v.date = patch.date; v.precision = patch.date.length === 7 ? 'month' : 'day'; }
  v.updatedAt = now(); return next;
}
export function reconciliationDelta(data: Data, record: Data['reconciliations'][number], total: number | null) { return record.scope === 'total' && total != null && record.amount != null ? total - record.amount : null; }
export function applySavedAliases(preview: Preview, current: Data): Preview {
  if (current.settings.demo) return preview;
  const data = structuredClone(preview.data);
  for (const asset of [...data.assets]) {
    const match = current.assets.find(a => a.market === asset.market && [a.ticker,...a.aliases].some(alias => [asset.ticker,...asset.aliases].some(name => norm(name) === norm(alias))));
    if (!match) continue;
    for (const v of data.valuations.filter(v => v.assetId === asset.id)) v.assetId = match.id;
    data.assets = data.assets.filter(a => a.id !== asset.id);
    if (!data.assets.some(a => a.id === match.id)) data.assets.push(match);
  }
  return {...preview,data};
}
