import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ── Stooq symbol mapping ──────────────────────────────────────────────────────
// Format: /q/l/?s={sym}&f=sd2ohlcvp&h&e=csv
// Fields: Symbol,Date,Open,High,Low,Close,Volume,Prev

const INDEX_CONFIG = [
  { stooq: '^spx',   symbol: '^GSPC',   name: 'S&P 500',   flag: '🇺🇸', sub: '미국 500대 기업', isForex: false },
  { stooq: '^ndx',   symbol: '^IXIC',   name: 'NASDAQ',    flag: '🇺🇸', sub: '기술주 중심',      isForex: false },
  { stooq: '^dji',   symbol: '^DJI',    name: 'DOW JONES', flag: '🇺🇸', sub: '미국 30대 우량주', isForex: false },
  { stooq: '^kospi', symbol: '^KS11',   name: 'KOSPI',     flag: '🇰🇷', sub: '한국 코스피',      isForex: false },
];

const US_STOCK_CONFIG = [
  { stooq: 'aapl.us',  symbol: 'AAPL',  name: '애플',           color: '#555555', category: 'us-tech',    sub: '기술',     initial: 'A' },
  { stooq: 'msft.us',  symbol: 'MSFT',  name: '마이크로소프트',  color: '#0078d4', category: 'us-tech',    sub: '기술',     initial: 'M' },
  { stooq: 'googl.us', symbol: 'GOOGL', name: '구글 (알파벳)',   color: '#ea4335', category: 'us-tech',    sub: '기술',     initial: 'G' },
  { stooq: 'amzn.us',  symbol: 'AMZN',  name: '아마존',          color: '#ff9900', category: 'us-tech',    sub: '기술',     initial: 'A' },
  { stooq: 'nvda.us',  symbol: 'NVDA',  name: '엔비디아',        color: '#76b900', category: 'us-tech',    sub: '반도체',   initial: 'N' },
  { stooq: 'tsla.us',  symbol: 'TSLA',  name: '테슬라',          color: '#e00b20', category: 'us-tech',    sub: '전기차',   initial: 'T' },
  { stooq: 'spy.us',   symbol: 'SPY',   name: 'SPDR S&P500 ETF', color: '#3b5bdb', category: 'us-etf',     sub: 'ETF',      initial: 'S' },
  { stooq: 'qqq.us',   symbol: 'QQQ',   name: 'Invesco QQQ',     color: '#4c6ef5', category: 'us-etf',     sub: 'ETF',      initial: 'Q' },
  { stooq: 'jpm.us',   symbol: 'JPM',   name: 'JPMorgan Chase',  color: '#1e6b9e', category: 'us-finance', sub: '금융',     initial: 'J' },
  { stooq: 'jnj.us',   symbol: 'JNJ',   name: '존슨앤존슨',      color: '#d32f2f', category: 'us-health',  sub: '헬스케어', initial: 'J' },
];

const SECTOR_CONFIG = [
  { stooq: 'xlk.us', symbol: 'XLK' },
  { stooq: 'xle.us', symbol: 'XLE' },
  { stooq: 'xlv.us', symbol: 'XLV' },
  { stooq: 'xlf.us', symbol: 'XLF' },
  { stooq: 'xlp.us', symbol: 'XLP' },
  { stooq: 'xlu.us', symbol: 'XLU' },
];

// ── Stooq fetch ───────────────────────────────────────────────────────────────
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

async function fetchStooq(stooqSymbol) {
  const url = `https://stooq.com/q/l/?s=${stooqSymbol}&f=sd2ohlcvp&h&e=csv`;
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
  const text = await res.text();
  const lines = text.trim().split('\n');
  if (lines.length < 2) return null;
  // Header: Symbol,Date,Open,High,Low,Close,Volume,Prev
  const [sym, date, open, high, low, close, volume, prev] = lines[1].split(',');
  if (close === 'N/D' || !close) return null;
  const closeN = parseFloat(close);
  const prevN  = parseFloat(prev);
  const change = prevN ? closeN - prevN : 0;
  const pct    = prevN ? (change / prevN) * 100 : 0;
  return { price: closeN, change, changePercent: pct, prev: prevN };
}

// ── USD/KRW via exchangerate-api ──────────────────────────────────────────────
async function fetchUSDKRW() {
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    const rate = data.rates?.KRW;
    if (!rate) return null;
    // exchangerate-api doesn't provide change, so we won't show it
    return { price: rate, change: null, changePercent: null };
  } catch {
    return null;
  }
}

// ── handler ───────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    // Fetch all in parallel
    const [usdkrw, ...stooqResults] = await Promise.all([
      fetchUSDKRW(),
      ...INDEX_CONFIG.map(c => fetchStooq(c.stooq)),
      ...US_STOCK_CONFIG.map(c => fetchStooq(c.stooq)),
      ...SECTOR_CONFIG.map(c => fetchStooq(c.stooq)),
    ]);

    const idxCount     = INDEX_CONFIG.length;
    const stockCount   = US_STOCK_CONFIG.length;
    const sectorCount  = SECTOR_CONFIG.length;

    const idxResults    = stooqResults.slice(0, idxCount);
    const stockResults  = stooqResults.slice(idxCount, idxCount + stockCount);
    const sectorResults = stooqResults.slice(idxCount + stockCount);

    // Build indices (add forex manually)
    const indices = [
      ...INDEX_CONFIG.map((c, i) => {
        const q = idxResults[i];
        if (!q) return null;
        return { symbol: c.symbol, name: c.name, flag: c.flag, sub: c.sub, ...q };
      }).filter(Boolean),
      usdkrw ? { symbol: 'USDKRW=X', name: 'USD/KRW', flag: '💱', sub: '원/달러 환율', ...usdkrw } : null,
    ].filter(Boolean);

    const usStocks = US_STOCK_CONFIG.map((c, i) => {
      const q = stockResults[i];
      if (!q) return null;
      return {
        symbol: c.symbol,
        name: c.name, color: c.color, category: c.category, initial: c.initial,
        ticker: `${c.symbol} · ${c.sub}`,
        marketCap: '-',  // Stooq doesn't provide market cap
        ...q,
      };
    }).filter(Boolean);

    const sectors = SECTOR_CONFIG.map((c, i) => {
      const q = sectorResults[i];
      if (!q) return null;
      return { symbol: c.symbol, ...q };
    }).filter(Boolean);

    return NextResponse.json({
      indices,
      usStocks,
      krStocks: [],   // Korean stocks: not available from Stooq
      sectors,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Market API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
