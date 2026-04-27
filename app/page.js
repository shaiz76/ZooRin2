'use client';
import { useState, useEffect, useCallback } from 'react';

// ── helpers ──────────────────────────────────────────────────────────────────
function fmtPrice(price, isKR) {
  if (price == null) return '–';
  if (isKR) return price.toLocaleString('ko-KR') + '원';
  return '$' + price.toFixed(2);
}
function fmtIdx(price) {
  if (price == null) return '–';
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtChange(change, isKR) {
  if (change == null) return '–';
  const sign = change >= 0 ? '+' : '';
  if (isKR) return sign + Math.round(change).toLocaleString('ko-KR');
  const abs = Math.abs(change).toFixed(2);
  return (change >= 0 ? '+' : '-') + '$' + abs;
}
function fmtPct(pct) {
  if (pct == null) return '–';
  return (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
}
function cls(val) {
  if (val == null || val === 0) return 'flat';
  return val > 0 ? 'up' : 'down';
}
function arrow(val) {
  if (val == null || val === 0) return '—';
  return val > 0 ? '▲' : '▼';
}
function fgMood(score) {
  if (score >= 75) return { label: '극도의 탐욕', color: '#26c17c', emoji: '🤑' };
  if (score >= 55) return { label: '탐욕',         color: '#7bc67e', emoji: '😏' };
  if (score >= 45) return { label: '중립',         color: '#f5c542', emoji: '😐' };
  if (score >= 25) return { label: '공포',         color: '#f47c3c', emoji: '😟' };
  return              { label: '극도의 공포',      color: '#f04b4b', emoji: '😨' };
}
function needleXY(score) {
  const rad = ((180 - (score / 100) * 180) * Math.PI) / 180;
  return { x: (100 + 75 * Math.cos(rad)).toFixed(1), y: (100 - 75 * Math.sin(rad)).toFixed(1) };
}

// ── static content ────────────────────────────────────────────────────────────
const NEWS = [
  { tag: '미국',   tagC: '#4c6ef5', tagBg: 'rgba(59,91,219,0.2)',    hl: 'Fed, 5월 금리 동결 시사…"데이터 더 지켜봐야"', src: '연합뉴스' },
  { tag: '기업',   tagC: '#26c17c', tagBg: 'rgba(38,193,124,0.15)',  hl: '엔비디아, 블랙웰 칩 수요 폭발…2분기 가이던스 대폭 상향', src: '블룸버그' },
  { tag: '경고',   tagC: '#f04b4b', tagBg: 'rgba(240,75,75,0.15)',   hl: '중국발 공급망 불안…반도체 재고 우려 다시 부상', src: '한국경제' },
  { tag: '한국',   tagC: '#f5c542', tagBg: 'rgba(245,197,66,0.15)',  hl: '삼성전자 1분기 영업이익 6.6조…반도체 회복세 뚜렷', src: '매일경제' },
  { tag: '글로벌', tagC: '#4c6ef5', tagBg: 'rgba(59,91,219,0.2)',    hl: '유가 하락세 지속…WTI 배럴당 $81.23', src: '로이터' },
];
const GLOSSARY = [
  { term: 'PER',       eng: 'Price-to-Earnings Ratio', def: '주가를 주당순이익(EPS)으로 나눈 값. "이 회사의 수익 대비 주가가 비싼가?"를 판단하는 지표. 낮을수록 저평가된 것으로 볼 수 있지만, 업종마다 다릅니다.' },
  { term: '시가총액',   eng: 'Market Cap',              def: '현재 주가 × 발행 주식 수. 회사의 전체 가치를 나타냅니다. 삼성전자 시총 ≈ 삼성전자를 통째로 사는 데 드는 돈.' },
  { term: '배당수익률', eng: 'Dividend Yield',          def: '1년간 받는 배당금 ÷ 주가 × 100%. 주식을 보유하는 것만으로 받는 "이자" 같은 개념입니다.' },
  { term: 'ETF',        eng: 'Exchange Traded Fund',    def: '여러 주식을 묶어 하나의 종목처럼 거래하는 펀드. SPY 하나 사면 S&P500 500개 기업에 분산투자하는 효과. 초보자에게 강력 추천!' },
  { term: '52주 고/저가', eng: '52-Week High / Low',   def: '최근 1년간 주가의 최고점과 최저점. 현재 주가가 이 범위 어디에 있는지로 현재 가격의 상대적 위치를 파악합니다.' },
];
const SECTOR_LABEL = { XLK: '기술 (Tech)', XLE: '에너지', XLV: '헬스케어', XLF: '금융', XLP: '소비재', XLU: '유틸리티' };
const US_CATS = [['us-all','전체'],['us-tech','기술'],['us-etf','ETF'],['us-finance','금융'],['us-health','헬스케어']];
const KR_CATS = [['kr-all','전체'],['kr-semi','반도체'],['kr-battery','2차전지'],['kr-bio','바이오'],['kr-finance','금융']];

// ── main ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const [market, setMarket]     = useState(null);
  const [fg, setFg]             = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [updatedAt, setUpdatedAt] = useState('');
  const [tab, setTab]           = useState('us');
  const [catUS, setCatUS]       = useState('us-all');
  const [catKR, setCatKR]       = useState('kr-all');
  const [openGL, setOpenGL]     = useState(0);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [mRes, fRes] = await Promise.all([fetch('/api/market'), fetch('/api/feargreed')]);
      const [m, f] = await Promise.all([mRes.json(), fRes.json()]);
      if (m.error) throw new Error(m.error);
      setMarket(m);
      if (!f.error) setFg(f);
      setUpdatedAt(new Date().toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const indices  = market?.indices   ?? [];
  const usStocks = market?.usStocks  ?? [];
  const krStocks = market?.krStocks  ?? [];
  const sectors  = market?.sectors   ?? [];

  const fgScore  = fg ? parseInt(fg.current?.value ?? '50') : 50;
  const fgNeedle = needleXY(fgScore);
  const fgNow    = fgMood(fgScore);

  const visUS = catUS === 'us-all' ? usStocks : usStocks.filter(s => s.category === catUS);
  const visKR = catKR === 'kr-all' ? krStocks : krStocks.filter(s => s.category === catKR);

  return (
    <>
      {/* HEADER */}
      <header className="header">
        <div className="container">
          <div className="header-inner">
            <a className="logo" href="#">
              <div className="logo-icon">📈</div>
              주식 첫걸음
            </a>
            <span className="header-badge">초보자 가이드</span>
            <span className="last-updated">
              {loading ? '⏳ 데이터 불러오는 중…' : error ? '⚠️ 데이터 오류' : `🕐 ${updatedAt} KST`}
              <button onClick={load} style={{
                background:'none', border:'1px solid var(--border)', color:'var(--text-muted)',
                borderRadius:6, padding:'2px 8px', cursor:'pointer', fontSize:11, lineHeight:1.5,
              }}>↺ 새로고침</button>
            </span>
          </div>
        </div>
      </header>

      <main>
        <div className="container">
          {error && (
            <div style={{margin:'16px 0',padding:'12px 16px',background:'rgba(240,75,75,0.1)',border:'1px solid rgba(240,75,75,0.3)',borderRadius:8,fontSize:13,color:'#f04b4b'}}>
              ⚠️ 데이터 로드 실패: {error}. Yahoo Finance API 제한일 수 있습니다. 잠시 후 새로고침하세요.
            </div>
          )}

          <div className="main-grid">
            {/* ── LEFT ── */}
            <div className="left-col">

              {/* INDEX CARDS */}
              <div>
                <p className="section-title">📊 시장 지수</p>
                <div className="index-grid">
                  {loading
                    ? Array(6).fill(0).map((_, i) => (
                        <div key={i} className="index-card" style={{opacity:0.35}}>
                          <div className="label">로딩 중…</div>
                          <div className="value">—</div>
                          <div className="change flat">— —</div>
                        </div>
                      ))
                    : indices.map(idx => {
                        const c = cls(idx.changePercent);
                        const isForex = idx.symbol === 'USDKRW=X';
                        return (
                          <div key={idx.symbol} className="index-card">
                            <div className="label">{idx.flag} {idx.name}</div>
                            <div className="value">
                              {isForex
                                ? (idx.price?.toLocaleString('ko-KR', {minimumFractionDigits:2,maximumFractionDigits:2}) ?? '–')
                                : fmtIdx(idx.price)}
                            </div>
                            <div className={`change ${c}`}>
                              {arrow(idx.changePercent)} {idx.change?.toFixed(2)} ({fmtPct(idx.changePercent)})
                            </div>
                            <div className="sub">{idx.sub}</div>
                          </div>
                        );
                      })
                  }
                </div>
              </div>

              {/* STOCK TABS */}
              <div className="tab-wrapper">
                <div className="tab-header">
                  <button className={`tab-btn${tab==='us'?' active':''}`} onClick={() => setTab('us')}>
                    <span className="tab-flag">🇺🇸</span> 미국 주식
                  </button>
                  <button className={`tab-btn${tab==='kr'?' active':''}`} onClick={() => setTab('kr')}>
                    <span className="tab-flag">🇰🇷</span> 한국 주식
                  </button>
                </div>

                <div className={`tab-content${tab==='us'?' active':''}`}>
                  <div className="categories">
                    {US_CATS.map(([v, label]) => (
                      <span key={v} className={`stock-category${catUS===v?' active':''}`} onClick={() => setCatUS(v)}>{label}</span>
                    ))}
                  </div>
                  <StockTable stocks={visUS} loading={loading} isKR={false} />
                </div>

                <div className={`tab-content${tab==='kr'?' active':''}`}>
                  <div className="categories">
                    {KR_CATS.map(([v, label]) => (
                      <span key={v} className={`stock-category${catKR===v?' active':''}`} onClick={() => setCatKR(v)}>{label}</span>
                    ))}
                  </div>
                  <StockTable stocks={visKR} loading={loading} isKR={true} />
                </div>
              </div>

              {/* NEWS */}
              <div className="news-card fade-in">
                <div className="news-card-header">
                  <span className="news-title">📰 주요 경제 뉴스</span>
                  <span className="news-more">샘플 데이터</span>
                </div>
                {NEWS.map((n, i) => (
                  <div key={i} className="news-item">
                    <div className="news-headline">
                      <span className="news-tag" style={{background:n.tagBg, color:n.tagC}}>{n.tag}</span>
                      {n.hl}
                    </div>
                    <div className="news-meta">🕐 · {n.src}</div>
                  </div>
                ))}
              </div>

            </div>

            {/* ── RIGHT ── */}
            <div className="right-col">

              {/* FEAR & GREED */}
              <div className="fg-card">
                <div className="fg-title">😨 Crypto Fear &amp; Greed Index</div>
                <div className="fg-subtitle">alternative.me · 시장 심리 온도계</div>
                <div className="fg-gauge-wrap">
                  <svg className="fg-arc" viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
                    <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#262d3d" strokeWidth="16" strokeLinecap="round"/>
                    <path d="M 20 100 A 80 80 0 0 1 55 31"   fill="none" stroke="#f04b4b" strokeWidth="16" strokeLinecap="butt" opacity="0.85"/>
                    <path d="M 55 31 A 80 80 0 0 1 100 20"   fill="none" stroke="#f47c3c" strokeWidth="16" strokeLinecap="butt" opacity="0.85"/>
                    <path d="M 100 20 A 80 80 0 0 1 145 31"  fill="none" stroke="#f5c542" strokeWidth="16" strokeLinecap="butt" opacity="0.85"/>
                    <path d="M 145 31 A 80 80 0 0 1 180 100" fill="none" stroke="#26c17c" strokeWidth="16" strokeLinecap="butt" opacity="0.85"/>
                    <line x1="100" y1="100" x2={fgNeedle.x} y2={fgNeedle.y} stroke="#e8eaf0" strokeWidth="3" strokeLinecap="round"/>
                    <circle cx="100" cy="100" r="5" fill="#e8eaf0"/>
                    <text x="22"  y="115" fill="#f04b4b" fontSize="9" fontWeight="700">공포</text>
                    <text x="87"  y="14"  fill="#f5c542" fontSize="9" fontWeight="700" textAnchor="middle">중립</text>
                    <text x="168" y="115" fill="#26c17c" fontSize="9" fontWeight="700" textAnchor="end">탐욕</text>
                  </svg>
                </div>
                <div className="fg-score-display">
                  <div className="fg-score" style={{color: fgNow.color}}>{fgScore}</div>
                  <div className="fg-label" style={{color: fgNow.color}}>{fgNow.emoji} {fgNow.label}</div>
                  <div className="fg-desc">
                    {fgScore < 40
                      ? '투자자들이 불안해하고 있어요. 역사적으로 이 시점은 매수 기회가 되기도 합니다.'
                      : fgScore > 60
                      ? '탐욕이 높습니다. 고점 매수 주의가 필요할 수 있습니다.'
                      : '시장은 중립적 심리입니다. 신중하게 접근하세요.'}
                  </div>
                </div>
                <div className="fg-history">
                  {[['어제', fg?.yesterday], ['1주일 전', fg?.weekAgo]].map(([label, data]) => {
                    const s = data ? parseInt(data.value) : null;
                    const m = s != null ? fgMood(s) : null;
                    return (
                      <div key={label} className="fg-hist-item">
                        <div className="fg-hist-label">{label}</div>
                        <div className="fg-hist-value" style={{color: m?.color ?? 'var(--text-muted)'}}>{s ?? '–'}</div>
                        <div className="fg-hist-mood"  style={{color: m?.color ?? 'var(--text-muted)'}}>{m?.label ?? ''}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTOR HEATMAP */}
              <div className="sector-card">
                <p className="section-title">🏭 섹터별 현황 (미국 ETF)</p>
                <div className="sector-grid">
                  {loading
                    ? Array(6).fill(0).map((_, i) => (
                        <div key={i} className="sector-item" style={{background:'rgba(255,255,255,0.05)'}}>
                          <div className="sector-name">로딩 중</div>
                          <div className="sector-pct">—</div>
                        </div>
                      ))
                    : sectors.map(s => {
                        const pct = s.changePercent ?? 0;
                        const intensity = Math.min(Math.abs(pct) / 3, 1);
                        const bg = pct >= 0
                          ? `rgba(38,193,124,${0.2 + intensity * 0.6})`
                          : `rgba(240,75,75,${0.2 + intensity * 0.6})`;
                        return (
                          <div key={s.symbol} className="sector-item" style={{background: bg}}>
                            <div className="sector-name">{SECTOR_LABEL[s.symbol] ?? s.symbol}</div>
                            <div className="sector-pct">{fmtPct(pct)}</div>
                          </div>
                        );
                      })
                  }
                </div>
              </div>

              {/* TIP */}
              <div className="tip-card">
                <div className="tip-icon">💡</div>
                <div className="tip-heading">오늘의 투자 원칙</div>
                <div className="tip-text">
                  "<strong>공포에 사고, 탐욕에 팔아라</strong>"<br/><br/>
                  Fear &amp; Greed 지수가 낮을수록 시장은 과매도 상태일 수 있습니다.
                  단, 단기 타이밍보다 <strong>장기적 관점</strong>이 초보자에게 더 안전합니다.
                </div>
              </div>

              {/* GLOSSARY */}
              <div className="glossary-card">
                <div className="glossary-header">
                  <span>📖</span>
                  <span className="glossary-header-title">초보자 용어 사전</span>
                </div>
                {GLOSSARY.map((g, i) => (
                  <div key={i} className="glossary-item" onClick={() => setOpenGL(openGL === i ? -1 : i)}>
                    <div className="glossary-term">
                      <span className="glossary-term-name">{g.term}</span>
                      <span className="glossary-term-eng">{g.eng}</span>
                    </div>
                    {openGL === i && <div className="glossary-def">{g.def}</div>}
                  </div>
                ))}
              </div>

            </div>
          </div>
        </div>
      </main>

      <footer style={{borderTop:'1px solid var(--border)',padding:'24px 0',marginTop:8}}>
        <div className="container">
          <p style={{fontSize:12,color:'var(--text-muted)',textAlign:'center',lineHeight:1.8}}>
            ⚠️ 이 사이트는 <strong>교육 목적</strong>으로 제작되었습니다. 실제 투자 판단에 사용하지 마세요.<br/>
            주가 데이터는 Yahoo Finance, 심리 지수는 alternative.me 제공 (지연 있을 수 있음).
          </p>
        </div>
      </footer>
    </>
  );
}

// ── StockTable component ──────────────────────────────────────────────────────
function StockTable({ stocks, loading, isKR }) {
  if (loading) {
    return (
      <table className="stock-table">
        <tbody>
          {Array(5).fill(0).map((_, i) => (
            <tr key={i} style={{opacity:0.3}}>
              <td><div className="stock-info">
                <div className="stock-logo" style={{background:'#262d3d'}}>?</div>
                <div><div className="stock-name">로딩 중…</div><div className="stock-ticker">—</div></div>
              </div></td>
              <td>—</td><td>—</td><td>—</td><td>—</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (!stocks.length) return <p style={{color:'var(--text-muted)',fontSize:13,padding:'12px 0'}}>데이터 없음</p>;

  return (
    <table className="stock-table">
      <thead>
        <tr>
          <th>종목</th><th>현재가</th><th>등락</th><th>등락률</th><th>시가총액</th>
        </tr>
      </thead>
      <tbody>
        {stocks.map(s => {
          const c = cls(s.changePercent);
          const ar = arrow(s.changePercent);
          return (
            <tr key={s.symbol}>
              <td>
                <div className="stock-info">
                  <div className="stock-logo" style={{background: s.color}}>{s.initial}</div>
                  <div>
                    <div className="stock-name">{s.name}</div>
                    <div className="stock-ticker">{s.ticker}</div>
                  </div>
                </div>
              </td>
              <td className={c}>{fmtPrice(s.price, isKR)}</td>
              <td className={c}>{fmtChange(s.change, isKR)}</td>
              <td><span className={`change-badge ${c}`}>{ar} {fmtPct(s.changePercent)}</span></td>
              <td>{s.marketCap}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
