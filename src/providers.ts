import { type Data, type Fx, type Price, now, today } from './model';
async function fetchJson(url: string) { const response = await fetch(url, { signal: AbortSignal.timeout(12000) }); if (!response.ok) throw new Error(`Proveedor: HTTP ${response.status}`); return response.json(); }
export async function updateQuotes(data: Data) {
  const fx: Fx[] = [], prices: Price[] = [], errors: string[] = [];
  const results = await Promise.allSettled([
    fetchJson('https://dolarapi.com/v1/dolares'),
    data.assets.some(a => a.type === 'Cripto' && a.providerId) ? fetchJson(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent([...new Set(data.assets.filter(a => a.type === 'Cripto').map(a => a.providerId).filter(Boolean))].join(','))}&vs_currencies=usd&include_last_updated_at=true`) : Promise.resolve({})
  ]);
  if (results[0].status === 'fulfilled' && Array.isArray(results[0].value)) { for (const quote of results[0].value) if (['blue','bolsa'].includes(quote.casa) && quote.compra > 0 && quote.venta > 0 && typeof quote.fechaActualizacion === 'string') { const kind = quote.casa === 'blue' ? 'Blue' : 'MEP'; const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(quote.fechaActualizacion)); fx.push({ id: `dolarapi:${kind}:${quote.fechaActualizacion}`, updatedAt: now(), date, kind, buy: quote.compra, sell: quote.venta, source: `DolarApi · ${quote.fechaActualizacion}` }); } } else errors.push('DolarApi no respondió. Podés cargar el dólar manualmente.');
  if (results[1].status === 'fulfilled') { for (const asset of data.assets.filter(a => a.type === 'Cripto' && a.providerId && a.currency === 'USD')) { const quote = results[1].value[asset.providerId!]; if (quote?.usd > 0 && quote.last_updated_at > 0) { const timestamp = new Date(quote.last_updated_at * 1000).toISOString(); const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(timestamp)); prices.push({ id: `coingecko:${asset.id}:${timestamp}`, updatedAt: now(), date, assetId: asset.id, currency: 'USD', value: quote.usd, source: `CoinGecko · ${timestamp}` }); } else errors.push(`${asset.ticker}: sin cotización verificable.`); } } else errors.push('CoinGecko no respondió. Los precios anteriores se conservan.');
  const merged = structuredClone(data);
  for (const quote of fx) if (!merged.fx.some(f => f.id === quote.id)) merged.fx.push(quote);
  for (const quote of prices) if (!merged.prices.some(p => p.id === quote.id)) merged.prices.push(quote);
  return { data: merged, count: fx.length + prices.length, errors, date: today() };
}
