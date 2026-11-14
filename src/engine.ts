import { type Data, type Currency, type Movement, type Asset, type Fx, dateEnd, assetKey } from './model';
export interface Position { asset: Asset; accountId: string; amount: number | null; currency: Currency; quantity: number | null; cost: number | null; realized: number | null; unrealized: number | null; resultArs: number | null; resultUsd: number | null; lastDate: string; status: string; source: string; ars: number | null; usd: number | null }
export function fxAt(data: Data, date: string): Fx | undefined {
  // Historical cuts never borrow a rate from another month or the future.
  return data.fx.filter(f => f.kind === data.settings.fxKind && f.date.slice(0, 7) === date.slice(0, 7) && dateEnd(f.date) <= dateEnd(date)).sort((a, b) => dateEnd(b.date).localeCompare(dateEnd(a.date)) || b.updatedAt.localeCompare(a.updatedAt))[0];
}
export function convert(amount: number | null, from: Currency, to: Currency, rate?: number | null): number | null { return amount == null ? null : from === to ? amount : rate && rate > 0 ? from === 'ARS' ? amount / rate : amount * rate : null; }
export function consolidate(ars: number, usd: number, rate: number | null) { return { ars: rate && rate > 0 ? ars + usd * rate : usd === 0 ? ars : null, usd: rate && rate > 0 ? ars / rate + usd : ars === 0 ? usd : null }; }
const cashAsset = (currency: Currency): Asset => ({ id: assetKey(currency, 'EFECTIVO'), ticker: currency, name: `Efectivo en ${currency}`, market: 'EFECTIVO', type: 'Efectivo', currency, aliases: [], updatedAt: '' });
function eventCash(m: Movement) { if (m.kind === 'Compra') return -(m.quantity! * m.price! + m.fee); if (m.kind === 'Venta') return m.quantity! * m.price! - m.fee; if (m.kind === 'Retiro' || m.kind === 'Transferencia') return -m.amount - m.fee; if (m.kind === 'Aporte' || m.kind === 'Dividendo' || m.kind === 'Interés') return m.amount - m.fee; return 0; }
export function portfolioAt(data: Data, date: string) {
  const end = dateEnd(date), fx = fxAt(data, date), rate = fx?.[data.settings.fxSide] ?? null;
  const valuations = data.valuations.filter(v => dateEnd(v.date) <= end);
  const movements = data.movements.filter(m => m.date <= end).sort((a, b) => a.date.localeCompare(b.date) || (a.kind === 'Apertura' && b.kind !== 'Apertura' ? -1 : b.kind === 'Apertura' && a.kind !== 'Apertura' ? 1 : (a.createdAt ?? a.updatedAt).localeCompare(b.createdAt ?? b.updatedAt)));
  const latestCut = valuations.filter(v => v.scope !== 'adjustment').map(v => dateEnd(v.date)).sort().at(-1);
  const pairs = new Map<string, { asset: Asset; accountId: string }>();
  const add = (asset: Asset | undefined, accountId: string) => { if (asset) pairs.set(`${asset.id}|${accountId}`, { asset, accountId }); };
  valuations.forEach(v => add(data.assets.find(a => a.id === v.assetId), v.accountId));
  movements.forEach(m => { add(data.assets.find(a => a.id === m.assetId), m.accountId); if (m.kind !== 'Apertura' || !m.assetId) add(cashAsset(m.currency), m.accountId); if (m.toAccountId) add(cashAsset(m.currency), m.toAccountId); });
  // Fold imported cash into the same canonical cash asset for each account and currency.
  for (const [pair, p] of [...pairs]) if (p.asset.type === 'Efectivo') { pairs.delete(pair); add(cashAsset(p.asset.currency), p.accountId); }
  const positions: Position[] = [];
  for (const { asset, accountId } of pairs.values()) {
    const isCash = asset.type === 'Efectivo';
    const matches = (id?: string) => isCash ? data.assets.find(a => a.id === id)?.type === 'Efectivo' && data.assets.find(a => a.id === id)?.currency === asset.currency : id === asset.id;
    const vs = valuations.filter(v => v.accountId === accountId && matches(v.assetId)).sort((a, b) => dateEnd(b.date).localeCompare(dateEnd(a.date)) || b.updatedAt.localeCompare(a.updatedAt));
    const v = vs[0];
    const ms = movements.filter(m => m.accountId === accountId && (isCash ? m.currency === asset.currency : m.assetId === asset.id));
    const opening = ms.filter(m => m.kind === 'Apertura' && (isCash ? !m.assetId || matches(m.assetId) : true)).at(-1);
    const trades = ms.filter(m => ['Compra', 'Venta'].includes(m.kind) && (!opening || m.date > opening.date || m.date === opening.date));
    let amount: number | null = null, quantity: number | null = null, cost: number | null = null, realized: number | null = null;
    let currency = asset.currency;
    let lastDate = v?.date ?? opening?.date ?? '', status = '', source = v?.source ? `${v.source.file} · ${v.source.sheet}!${v.source.cell}` : 'Manual';
    if (isCash) {
      // A later cash valuation supersedes earlier opening cash and events, never adds to them.
      const baseline = opening && (!v || opening.date >= dateEnd(v.date)) ? opening : undefined;
      const cutoff = baseline?.date ?? (v ? dateEnd(v.date) : '');
      if (baseline) { amount = baseline.amount; lastDate = baseline.date; }
      else if (v && (!latestCut || dateEnd(v.date) >= latestCut || movements.some(m => m.date > latestCut))) amount = v.amount;
      else if (!v) amount = 0;
      const cashMoves = movements.filter(m => m.currency === asset.currency && m.kind !== 'Apertura' && (m.date > cutoff || (!!baseline && m.date === cutoff)));
      for (const m of cashMoves) { const delta = (m.accountId === accountId ? eventCash(m) : 0) + (m.kind === 'Transferencia' && m.toAccountId === accountId ? m.amount : 0); if (delta && amount != null) { amount += delta; lastDate = m.date; } }
      quantity = amount; cost = amount; realized = 0;
      if (amount == null) status = 'Saldo pendiente';
    } else if (opening || trades.length) {
      const hasUnknownBaseline = !opening && !!v;
      if (hasUnknownBaseline) { status = 'Falta posición de apertura'; }
      else {
        quantity = opening?.quantity ?? 0; cost = opening ? opening.cost ?? null : 0; realized = cost == null ? null : 0;
        for (const m of trades) {
          const q = m.quantity ?? 0, price = m.price ?? 0;
          if (m.kind === 'Compra') { quantity += q; if (cost != null) cost += q * price + m.fee; }
          else { if (q > quantity + 1e-8) { status = 'Venta supera la posición'; quantity = null; cost = null; realized = null; break; } const average = quantity > 0 && cost != null ? cost / quantity : null; quantity -= q; if (average != null && cost != null && realized != null) { cost -= average * q; realized += q * price - m.fee - average * q; } }
          lastDate = m.date;
        }
        const latestTradeDate = trades.at(-1)?.date ?? opening?.date ?? '';
        const executionPrices = trades.filter(t => t.price != null).map(t => ({ date: t.date, currency: t.currency, value: t.price!, source: `Precio de operación · ${t.kind}`, updatedAt: t.updatedAt }));
        if (opening?.quantity && opening.amount > 0) executionPrices.push({ date: opening.date, currency: opening.currency, value: opening.amount / opening.quantity, source: 'Valuación de apertura', updatedAt: opening.updatedAt });
        const price = [...data.prices.filter(p => p.assetId === asset.id), ...executionPrices].filter(p => p.currency === asset.currency && dateEnd(p.date) <= end).sort((a, b) => dateEnd(b.date).localeCompare(dateEnd(a.date)) || b.updatedAt.localeCompare(a.updatedAt))[0];
        if (quantity === 0) amount = 0;
        else if (v && dateEnd(v.date) >= latestTradeDate && (!price || dateEnd(v.date) >= dateEnd(price.date))) { amount = v.amount; currency = v.currency; lastDate = v.date; }
        else if (quantity != null && price) { amount = quantity * price.value; lastDate = price.date; source = price.source; }
        else status ||= 'Falta precio';
      }
    } else if (v) {
      if (latestCut && dateEnd(v.date) < latestCut) status = 'Ausente en el último corte';
      else { amount = v.amount; currency = v.currency; if (amount == null) status = 'Importe desconocido'; }
    }
    const unrealized = !isCash && currency === asset.currency && amount != null && cost != null ? amount - cost : null;
    positions.push({ asset, accountId, amount, currency, quantity, cost, realized, unrealized, resultArs: convert(unrealized, currency, 'ARS', rate), resultUsd: convert(unrealized, currency, 'USD', rate), lastDate, status, source, ars: convert(amount, currency, 'ARS', rate), usd: convert(amount, currency, 'USD', rate) });
  }
  const nativeArs = positions.filter(p => p.currency === 'ARS').reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const nativeUsd = positions.filter(p => p.currency === 'USD').reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const totals = consolidate(nativeArs, nativeUsd, rate);
  const missing = positions.filter(p => p.amount == null);
  return { positions, rate, fx, nativeArs, nativeUsd, knownArs: totals.ars, knownUsd: totals.usd, ars: missing.length ? null : totals.ars, usd: missing.length ? null : totals.usd, missing, latestCut };
}
export function cuts(data: Data) {
  const dates = [...data.valuations.map(v => v.date), ...data.movements.map(m => m.date), ...data.prices.map(p => p.date)];
  const months = [...new Set(dates.map(d => d.slice(0, 7)))].sort();
  if (!months.length) return [];
  const result: string[] = [], start = new Date(`${months[0]}-01T12:00:00Z`), last = months.at(-1)!;
  for (let i = 0; i < 1200; i++) { const month = start.toISOString().slice(0, 7); if (month > last) break; result.push(month); start.setUTCMonth(start.getUTCMonth() + 1); }
  return result;
}
export function performance(data: Data, start: string, end: string, currency: Currency) {
  const a = portfolioAt(data, start), b = portfolioAt(data, end);
  const initial = currency === 'ARS' ? a.ars : a.usd, final = currency === 'ARS' ? b.ars : b.usd;
  const startDay = dateEnd(start), endDay = dateEnd(end);
  const external = data.movements.filter(m => ['Aporte', 'Retiro'].includes(m.kind) && m.date > startDay && m.date <= endDay);
  let flow = 0, weightedFlow = 0, flowsKnown = true, complete = !!data.settings.trackingStart && data.settings.trackingStart <= startDay;
  const span = Date.parse(endDay) - Date.parse(startDay);
  external.forEach(m => { const fx = fxAt(data, m.date); const value = convert(m.amount * (m.kind === 'Retiro' ? -1 : 1), m.currency, currency, fx?.[data.settings.fxSide]); if (value == null) { complete = false; flowsKnown = false; } else { flow += value; weightedFlow += value * (span > 0 ? (Date.parse(endDay) - Date.parse(m.date)) / span : 0); } });
  const variation = initial == null || final == null ? null : final - initial;
  const gain = variation != null && complete ? variation - flow : null;
  const denominator = initial == null ? null : initial + weightedFlow;
  return { initial, final, flow: flowsKnown ? flow : null, variation, gain, rate: gain != null && denominator != null && denominator > 0 ? gain / denominator : null, complete, flowsKnown };
}
export function validateMovement(data: Data, m: Movement): string | null {
  if (!m.date || m.date.length !== 10) return 'Elegí una fecha exacta.';
  if (!data.accounts.some(a => a.id === m.accountId)) return 'Elegí una cuenta.';
  if (!Number.isFinite(m.amount) || m.amount < 0 || !Number.isFinite(m.fee) || m.fee < 0) return 'El importe y la comisión deben ser positivos o cero.';
  if (m.kind === 'Transferencia' && (!m.toAccountId || m.toAccountId === m.accountId)) return 'Elegí una cuenta de destino distinta.';
  if (['Compra', 'Venta'].includes(m.kind)) {
    const asset = data.assets.find(a => a.id === m.assetId);
    if (!asset || asset.type === 'Efectivo') return 'Elegí un activo de inversión.';
    if (asset.currency !== m.currency) return 'Usá la moneda de cotización del activo. Registrá el cambio de moneda por separado.';
    if (!(m.quantity! > 0) || !(m.price! > 0)) return 'La cantidad y el precio deben ser mayores a cero.';
  }
  if (m.kind === 'Apertura' && m.assetId && !(m.quantity! >= 0)) return 'Indicá la cantidad de apertura.';
  if (m.kind === 'Apertura' && m.assetId && data.assets.find(a => a.id === m.assetId)?.currency !== m.currency) return 'La apertura debe usar la moneda de cotización del activo.';
  const next = { ...data, movements: [...data.movements.filter(x => x.id !== m.id), m] };
  const check = portfolioAt(next, next.movements.map(x => x.date).sort().at(-1)!);
  const previous = data.movements.find(x => x.id === m.id);
  const invalid = check.positions.find(p => [m, previous].some(x => x?.accountId === p.accountId && x?.assetId === p.asset.id) && (p.status === 'Venta supera la posición' || p.status === 'Falta posición de apertura'));
  return invalid ? `${invalid.asset.ticker}: ${invalid.status}. Revisá la apertura y las operaciones posteriores.` : null;
}
