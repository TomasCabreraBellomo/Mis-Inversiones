import { emptyData, assetKey, accountKey, type Data, type AssetType } from './model';
export function demoData(): Data {
  const d = emptyData(), stamp = '2026-11-06T15:00:00Z'; d.settings.demo = true;
  const specs: [string,string,AssetType,string,number,string][] = [
    ['SPY','S&P 500','CEDEAR','IOL',2418000,'ARS'], ['AAPL','Apple','CEDEAR','IOL',1480000,'ARS'], ['NVDA','NVIDIA','CEDEAR','IOL',1842000,'ARS'], ['AL30','Bono Argentina 2030','Bono','IOL',1560000,'ARS'], ['COCOPP','Cocos Pesos Plus','FCI','Cocos',2320000,'ARS'], ['SBS','SBS Renta Pesos','FCI','Brubank',960000,'ARS'], ['BTC','Bitcoin','Cripto','Binance',1200,'USD'], ['ARS','Pesos disponibles','Efectivo','Efectivo',685000,'ARS'], ['USD','Dólares disponibles','Efectivo','Galicia',1000,'USD']
  ];
  for (const [ticker,name,type,account,amount,c] of specs) {
    const currency = c as 'ARS'|'USD', market = type === 'Efectivo' ? 'EFECTIVO' : type === 'Cripto' ? 'CRYPTO' : 'BYMA', id = assetKey(ticker, market), accountId = accountKey(account);
    d.assets.push({ id, updatedAt: stamp, ticker, name, type, market, currency, aliases: [], providerId: ticker === 'BTC' ? 'bitcoin' : undefined });
    if (!d.accounts.some(a => a.id === accountId)) d.accounts.push({ id: accountId, updatedAt: stamp, name: account });
    for (let month = 1; month <= 11; month++) {
      const date = `2026-${String(month).padStart(2,'0')}${month === 11 ? '-06' : ''}`;
      const factor = [0.65,0.69,0.67,0.74,0.76,0.79,0.85,0.83,0.91,0.96,1][month-1];
      d.valuations.push({ id: `demo:${id}:${month}`, updatedAt: stamp, date, precision: month === 11 ? 'day' : 'month', assetId: id, accountId, currency, amount: Math.round(amount * factor), note: 'Dato ficticio de demostración' });
    }
  }
  for (let month = 1; month <= 11; month++) { const date = `2026-${String(month).padStart(2,'0')}${month === 11 ? '-06' : ''}`; d.fx.push({ id: `demo:fx:${month}`, updatedAt: stamp, date, kind: 'MEP', buy: 1200 + month*25 - 10, sell: 1200 + month*25, source: 'Demo · cotización ficticia' }); }
  return d;
}
