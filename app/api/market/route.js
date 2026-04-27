import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const FH_KEY  = process.env.FINNHUB_API_KEY;
const FH_BASE = 'https://finnhub.io/api/v1';

// ── symbol config ─────────────────────────────────────────────────────────────
const INDEX_CONFIG = [
  { fh: '^GSPC', symbol: '^GSPC', name: 'S&P 500',   flag: '🇺🇸', sub: '미국 500대 기업' },
  { fh: '^IXIC', symbol: '^IXIC', name: 'NASDAQ',    flag: '🇺🇸', sub: '기술주 중심' },
  { fh: '^DJI',  symbol: '^DJI',  name: 'DOW JONES', flag: '🇺🇸', sub: '미국 30대 우량주' },
];

// Korean indices via Naver
const KR_INDEX_CONFIG = [
  { naver: 'KOSPI',  symbol: '^KS11', name: 'KOSPI',  flag: '🇰🇷', sub: '한국 코스피' },
  { naver: 'KOSDAQ', symbol: '^KQ11', name: 'KOSDAQ', flag: '🇰🇷', sub: '한국 코스닥' },
];

const US_STOCK_CONFIG = [
  { fh: 'AAPL',  name: '애플',            color: '#555555', category: 'us-tech',    sub: '기술',     initial: 'A' },
  { fh: 'MSFT',  name: '마이크로소프트',   color: '#0078d4', category: 'us-tech',    sub: '기술',     initial: 'M' },
  { fh: 'GOOGL', name: '구글 (알파벳)',    color: '#ea4335', category: 'us-tech',    sub: '기술',     initial: 'G' },
  { fh: 'AMZN',  name: '아마존',          color: '#ff9900', category: 'us-tech',    sub: '기술',     initial: 'A' },
  { fh: 'NVDA',  name: '엔비디아',        color: '#76b900', category: 'us-tech',    sub: '반도체',   initial: 'N' },
  { fh: 'TSLA',  name: '테슬라',          color: '#e00b20', category: 'us-tech',    sub: '전기차',   initial: 'T' },
  { fh: 'SPY',   name: 'SPDR S&P500 ETF', color: '#3b5bdb', category: 'us-etf',     sub: 'ETF',      initial: 'S' },
  { fh: 'QQQ',   name: 'Invesco QQQ',     color: '#4c6ef5', category: 'us-etf',     sub: 'ETF',      initial: 'Q' },
  { fh: 'JPM',   name: 'JPMorgan Chase',  color: '#1e6b9e', category: 'us-finance', sub: '금융',     initial: 'J' },
  { fh: 'JNJ',   name: '존슨앤존슨',      color: '#d32f2f', category: 'us-health',  sub: '헬스케어', initial: 'J' },
];

const KR_STOCK_CONFIG = [
  { fh: 'KS:005930', code: '005930', name: '삼성전자',       color: '#1428a0', category: 'kr-semi',    sub: '반도체',  initial: 'S' },
  { fh: 'KS:000660', code: '000660', name: 'SK하이닉스',     color: '#0072b1', category: 'kr-semi',    sub: '반도체',  initial: 'H' },
  { fh: 'KS:373220', code: '373220', name: 'LG에너지솔루션', color: '#e31937', category: 'kr-battery', sub: '2차전지', initial: 'L' },
  { fh: 'KS:006400', code: '006400', name: '삼성SDI',        color: '#00a0e9', category: 'kr-battery', sub: '2차전지', initial: 'S' },
  { fh: 'KQ:035720', code: '035720', name: '카카오',         color: '#cc0000', category: 'kr-semi',    sub: 'IT',      initial: 'K' },
  { fh: 'KQ:035420', code: '035420', name: 'NAVER',          color: '#03c75a', category: 'kr-semi',    sub: 'IT',      initial: 'N' },
  { fh: 'KS:068270', code: '068270', name: '셀트리온',       color: '#8b5cf6', category: 'kr-bio',     sub: '바이오',  initial: 'C' },
  { fh: 'KS:105560', code: '105560', name: 'KB금융',         color: '#004b93', category: 'kr-finance', sub: '금융',    initial: 'K' },
  { fh: 'KS:005380', code: '005380', name: '현대차',         color: '#f44336', category: 'kr-finance', sub: '자동차',  initial: 'H' },
  { fh: 'KS:005490', code: '005490', name: 'POSCO홀딩스',    color: '#005bac', category: 'kr-finance', sub: '철강',    initial: 'P' },
];

const SECTOR_CONFIG = [
  { fh: 'XLK', symbol: 'XLK' }, { fh: 'XLE', symbol: 'XLE' },
  { fh: 'XLV', symbol: 'XLV' }, { fh: 'XLF', symbol: 'XLF' },
  { fh: 'XLP', symbol: 'XLP' }, { fh: 'XLU', symbol: 'XLU' },
];

// ── Finnhub fetch ─────────────────────────────────────────────────────────────
async function fhQuote(symbol) {
  try {
    const res = await fetch(
      `${FH_BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${FH_KEY}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return null;
    const d = await res.json();
    if (!d.c || d.c === 0) return null;
    return { price: d.c, change: d.d ?? 0, changePercent: d.dp ?? 0 };
  } catch {
    return null;
  }
}

// ── USD/KRW (no key needed) ───────────────────────────────────────────────────
async function fetchUSDKRW() {
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    return data.rates?.KRW ? { price: data.rates.KRW, change: null, changePercent: null } : null;
  } catch {
    return null;
  }
}

// ── Naver Finance (Korean stocks & indices) ───────────────────────────────────
const NAVER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  'Referer': 'https://m.stock.naver.com/',
};

function parseKRW(str) {
  if (!str) return null;
  return parseFloat(String(str).replace(/,/g, ''));
}

async function fetchNaverStock(code) {
  try {
    const res = await fetch(`https://m.stock.naver.com/api/stock/${code}/basic`, {
      headers: NAVER_HEADERS, signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const d = await res.json();
    if (!d.closePrice) return null;
    const price  = parseKRW(d.closePrice);
    const change = parseKRW(d.compareToPreviousClosePrice);
    const pct    = parseFloat(d.fluctuationsRatio);
    const dir    = d.compareToPreviousPrice?.name;
    return {
      price,
      change:        dir === 'FALLING' ? -(change ?? 0) : (change ?? 0),
      changePercent: dir === 'FALLING' ? -(pct ?? 0)    : (pct ?? 0),
    };
  } catch {
    return null;
  }
}

async function fetchNaverIndex(code) {
  try {
    const res = await fetch(`https://m.stock.naver.com/api/index/${code}/basic`, {
      headers: NAVER_HEADERS, signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const d = await res.json();
    const price  = parseKRW(d.closePrice);
    const change = parseKRW(d.compareToPreviousClosePrice);
    const pct    = parseFloat(d.fluctuationsRatio);
    const dir    = d.compareToPreviousPrice?.name;
    return {
      price,
      change:        dir === 'FALLING' ? -(change ?? 0) : (change ?? 0),
      changePercent: dir === 'FALLING' ? -(pct ?? 0)    : (pct ?? 0),
    };
  } catch {
    return null;
  }
}

// ── handler ───────────────────────────────────────────────────────────────────
export async function GET() {
  if (!FH_KEY) {
    return NextResponse.json(
      { error: 'FINNHUB_API_KEY 환경변수가 없습니다. Vercel 설정에서 추가해주세요.' },
      { status: 500 }
    );
  }

  try {
    // Fetch all in parallel
    const fhConfigs = [...INDEX_CONFIG, ...US_STOCK_CONFIG, ...SECTOR_CONFIG];
    const [usdkrw, ...fhAndNaver] = await Promise.all([
      fetchUSDKRW(),
      ...fhConfigs.map(c => fhQuote(c.fh)),
      ...KR_INDEX_CONFIG.map(c => fetchNaverIndex(c.naver)),
      ...KR_STOCK_CONFIG.map(c => fetchNaverStock(c.code)),
    ]);

    let offset = 0;

    // US indices (Finnhub)
    const usIndexQuotes = fhAndNaver.slice(offset, offset + INDEX_CONFIG.length);
    offset += INDEX_CONFIG.length;

    // US stocks (Finnhub)
    const usStockQuotes = fhAndNaver.slice(offset, offset + US_STOCK_CONFIG.length);
    offset += US_STOCK_CONFIG.length;

    // Sector ETFs (Finnhub)
    const sectorQuotes = fhAndNaver.slice(offset, offset + SECTOR_CONFIG.length);
    offset += SECTOR_CONFIG.length;

    // Korean indices (Naver)
    const krIndexQuotes = fhAndNaver.slice(offset, offset + KR_INDEX_CONFIG.length);
    offset += KR_INDEX_CONFIG.length;

    // Korean stocks (Naver)
    const krStockQuotes = fhAndNaver.slice(offset, offset + KR_STOCK_CONFIG.length);

    const indices = [
      ...INDEX_CONFIG.map((c, i) => {
        const q = usIndexQuotes[i];
        return q ? { symbol: c.symbol, name: c.name, flag: c.flag, sub: c.sub, ...q } : null;
      }),
      ...KR_INDEX_CONFIG.map((c, i) => {
        const q = krIndexQuotes[i];
        return q ? { symbol: c.symbol, name: c.name, flag: c.flag, sub: c.sub, ...q } : null;
      }),
      usdkrw ? { symbol: 'USDKRW=X', name: 'USD/KRW', flag: '💱', sub: '원/달러 환율', ...usdkrw } : null,
    ].filter(Boolean);

    const usStocks = US_STOCK_CONFIG.map((c, i) => {
      const q = usStockQuotes[i];
      return q ? { symbol: c.fh, name: c.name, color: c.color, category: c.category, initial: c.initial, ticker: `${c.fh} · ${c.sub}`, marketCap: '-', ...q } : null;
    }).filter(Boolean);

    const krStocks = KR_STOCK_CONFIG.map((c, i) => {
      const q = krStockQuotes[i];
      return q ? {
        symbol: c.code, name: c.name, color: c.color, category: c.category, initial: c.initial,
        ticker: `${c.code} · ${c.sub}`, marketCap: '-', isKR: true, ...q,
      } : null;
    }).filter(Boolean);

    const sectors = SECTOR_CONFIG.map((c, i) => {
      const q = sectorQuotes[i];
      return q ? { symbol: c.symbol, ...q } : null;
    }).filter(Boolean);

    return NextResponse.json({ indices, usStocks, krStocks, sectors, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Market API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
