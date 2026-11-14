export type Currency = 'ARS' | 'USD';
export const assetTypes = ['CEDEAR', 'Acción', 'ETF', 'Bono', 'Letra', 'FCI', 'Cripto', 'Efectivo', 'Otro'] as const;
export type AssetType = typeof assetTypes[number];
export interface Base { id: string; updatedAt: string }
export interface Asset extends Base { ticker: string; name: string; market: string; type: AssetType; currency: Currency; aliases: string[]; providerId?: string }
export interface Account extends Base { name: string }
export interface Source { file: string; hash: string; sheet: string; cell: string; raw?: string; formula?: string }
export interface Valuation extends Base { date: string; precision: 'day' | 'month'; assetId: string; accountId: string; currency: Currency; amount: number | null; scope?: 'snapshot' | 'adjustment'; source?: Source; note?: string }
export type EventKind = 'Compra' | 'Venta' | 'Dividendo' | 'Interés' | 'Aporte' | 'Retiro' | 'Transferencia' | 'Apertura';
export const eventKinds: EventKind[] = ['Compra', 'Venta', 'Dividendo', 'Interés', 'Aporte', 'Retiro', 'Transferencia', 'Apertura'];
export interface Movement extends Base { date: string; createdAt?: string; kind: EventKind; accountId: string; assetId?: string; toAccountId?: string; currency: Currency; amount: number; quantity?: number; price?: number; fee: number; cost?: number; note?: string; source?: Source }
export interface Price extends Base { date: string; assetId: string; currency: Currency; value: number; source: string }
export interface Fx extends Base { date: string; kind: 'MEP' | 'Blue' | 'Manual'; buy: number | null; sell: number | null; source: string }
export interface Reconciliation extends Base { date: string; label: string; currency: Currency; amount: number | null; scope: 'total' | 'subtotal' | 'difference' | 'error'; source?: Source }
export interface Settings { fxKind: Fx['kind']; fxSide: 'buy' | 'sell'; currency: Currency; trackingStart?: string; demo: boolean; autoRefresh?: boolean }
export interface Data { version: 1; assets: Asset[]; accounts: Account[]; valuations: Valuation[]; movements: Movement[]; prices: Price[]; fx: Fx[]; reconciliations: Reconciliation[]; settings: Settings }
export const tables = ['assets', 'accounts', 'valuations', 'movements', 'prices', 'fx', 'reconciliations'] as const;
export type Table = typeof tables[number];
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
export const norm = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toUpperCase();
export const key = (text: string) => encodeURIComponent(norm(text));
export const assetKey = (ticker: string, market: string) => `asset:${key(ticker)}:${key(market)}`;
export const accountKey = (name: string) => `account:${key(name)}`;
export const emptyData = (): Data => ({ version: 1, assets: [], accounts: [], valuations: [], movements: [], prices: [], fx: [], reconciliations: [], settings: { fxKind: 'MEP', fxSide: 'sell', currency: 'ARS', demo: false } });
export const dateEnd = (date: string) => date.length === 7 ? `${date}-${new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0).getDate()}` : date.slice(0, 10);
export function validDate(date: string) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(date) || (/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date); }
export const money = (value: number | null | undefined, currency: Currency = 'ARS', compact = false) => value == null || !Number.isFinite(value) ? 'Sin dato' : new Intl.NumberFormat('es-AR', { style: 'currency', currency, currencyDisplay: 'code', maximumFractionDigits: compact ? 0 : 2, notation: compact ? 'compact' : 'standard' }).format(value);
export const num = (value: number, digits = 2) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: digits }).format(value);
export const dateLabel = (date: string) => new Date(`${dateEnd(date)}T12:00:00`).toLocaleDateString('es-AR', date.length === 7 ? { month: 'long', year: 'numeric' } : { day: 'numeric', month: 'short', year: 'numeric' });
export function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !value.trim() || /^[-–—]$/.test(value.trim())) return null;
  let v = value.replace(/(?:ARS|USD|\$|\s)/gi, '');
  if (v.includes(',')) v = v.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(v)) v = v.replace(/\./g, '');
  return /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : null;
}
