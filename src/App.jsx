import { useEffect, useRef, useState } from 'react'

const POLL_MS = 10000

const COMPONENT_LABELS = {
  q06_digital_twin: 'Digital twin',
  q07_institution_id: 'Institution ID',
  q08_ai_disclosure: 'AI disclosure',
  q09_rag_grounding: 'RAG grounding',
  q10_limit_admit: 'Admits limits',
  q11_warm_tone: 'Warm tone',
  q12_format_consistency: 'Format consistency',
  q13_latency_pacing: 'Latency pacing',
  q14_echo_guard: 'Echo guard',
  q15_esc_interrupt: 'ESC interrupt',
  q16_avatar_embodiment: 'Avatar embodiment',
  q17_mode_switch: 'Mode switch',
  q18_consent_ui: 'Consent UI',
  q19_guest_browse: 'Guest browse',
  q20_korean_ordinal: 'Visit ordinal',
  q21_visit_tracking: 'Visit tracking',
  q22_tts_normalize: 'TTS normalize',
  q23_kakao_redirect: 'Kakao redirect',
  q24_overall_trust: 'Overall trust',
}

const HOURS = Array.from({ length: 24 }, (_, h) => h)

const fmt = n => (n == null ? '—' : Number(n).toLocaleString())
const pctStr = v => (v == null ? '—' : `${v}%`)

function Panel({ idx, title, sub, children, className = '' }) {
  return (
    <div className={`panel ${className}`}>
      <div className="panel-h">
        {idx && <span className="idx">{idx}</span>}
        <span>{title}</span>
        {sub && <span className="sub">{sub}</span>}
      </div>
      <div className="panel-b">{children}</div>
    </div>
  )
}

function Kpi({ label, value, sub, tone = '' }) {
  return (
    <div className={`kpi ${tone}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-num">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  )
}

function BarRow({ k, pct, value, dimv, color = '' }) {
  const w = Math.max(0, Math.min(100, pct ?? 0))
  return (
    <div className="bar-row">
      <span className="k" title={k}>{k}</span>
      <span className="bar-track"><span className={`bar-fill ${color}`} style={{ width: `${w}%` }} /></span>
      <span className={`v ${dimv ? 'dimv' : ''}`}>{value}</span>
    </div>
  )
}

function Hist({ items, color = 'cyan', showCnt = true }) {
  const max = Math.max(1, ...items.map(i => i.n))
  return (
    <div className="hist">
      {items.map((it, i) => (
        <div className="col" key={i}>
          {showCnt && <span className="cnt">{it.n}</span>}
          <span className={`colbar ${color}`} style={{ height: `${(it.n / max) * 100}%` }} title={`${it.lab}: ${it.n}`} />
          <span className="lab">{it.lab}</span>
        </div>
      ))}
    </div>
  )
}

function Ticker({ survey, t, layers }) {
  const items = [
    ['◉ LIVE FEED', '', 'acid'],
    ['SURVEYS', fmt(survey.total), 'cyan'],
    ['VALID', fmt(survey.valid), ''],
    ['AVG TRUST', layers.total?.avg != null ? `${layers.total.avg}/18` : '—', 'magenta'],
    ['SESSIONS', fmt(t.sessions_total), 'cyan'],
    ['MESSAGES', fmt(t.messages_total), 'amber'],
    ['USERS', fmt(t.users_total), 'acid'],
    ['ANON SESS', fmt(t.anon_sessions), ''],
    ['◆', '', 'magenta'],
  ]
  const doubled = [...items, ...items]
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        {doubled.map(([l, v, tone], i) => (
          <span className="tick" key={i}>
            <span className={`tl ${tone}`}>{l}</span>
            {v && <span className="tv">{v}</span>}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const [data, setData] = useState(null)
  const [state, setState] = useState('loading') // loading | live | stale | error
  const [err, setErr] = useState('')
  const lastSig = useRef('')
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const r = await fetch('/api/stats', { cache: 'no-store' })
        const j = await r.json()
        if (!alive) return
        if (!j.ok) throw new Error(j.error || 'bad payload')
        const sig = JSON.stringify([j.survey?.total, j.usage?.totals?.messages_total, j.usage?.totals?.sessions_total])
        if (sig !== lastSig.current && lastSig.current !== '') { setFlash(true); setTimeout(() => setFlash(false), 600) }
        lastSig.current = sig
        setData(j); setState('live'); setErr('')
      } catch (e) {
        if (!alive) return
        if (import.meta.env.DEV) { setData(MOCK); setState('live') }
        else { setState(s => (data ? 'stale' : 'error')); setErr(e.message) }
      }
    }
    load()
    const id = setInterval(load, POLL_MS)
    return () => { alive = false; clearInterval(id) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const survey = data?.survey || {}
  const usage = data?.usage || {}
  const t = usage.totals || {}
  const layers = survey.layers || {}
  const comps = survey.components || {}
  const asOf = data?.as_of ? new Date(data.as_of) : null

  const compRows = Object.keys(COMPONENT_LABELS)
    .map(k => ({ k, label: COMPONENT_LABELS[k], ...(comps[k] || {}) }))
    .filter(r => r.n != null)
    .sort((a, b) => (b.yes_pct ?? -1) - (a.yes_pct ?? -1))

  const turnBins = usage.turn_hist
    ? [
        { lab: '1', n: +usage.turn_hist.bin_1 || 0 },
        { lab: '2', n: +usage.turn_hist.bin_2 || 0 },
        { lab: '3', n: +usage.turn_hist.bin_3 || 0 },
        { lab: '4-5', n: +usage.turn_hist.bin_4_5 || 0 },
        { lab: '6-10', n: +usage.turn_hist.bin_6_10 || 0 },
        { lab: '11+', n: +usage.turn_hist.bin_11p || 0 },
      ]
    : []

  const hourMap = Object.fromEntries((usage.hourly || []).map(h => [+h.h, +h.n]))
  const hourBins = HOURS.map(h => ({ lab: h % 6 === 0 ? String(h) : '', n: hourMap[h] || 0 }))

  const scoreHist = (survey.score_hist || []).map(b => ({ lab: `${b.bucket_lo}+`, n: +b.n }))

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="brandmark">■</div>
        <div>
          <div className="brand-t glitch" data-text="GBA // RESEARCH TELEMETRY">GBA // RESEARCH TELEMETRY</div>
          <div className="brand-s">CHA Global Business AI · Trust Survey + Usage</div>
        </div>
        <span className="spacer" />
        <span className={`live ${state === 'stale' ? 'stale' : ''}`}>
          <span className="dot" />
          {state === 'loading' ? 'CONNECTING' : state === 'error' ? 'OFFLINE' : state === 'stale' ? 'STALE' : 'LIVE'}
        </span>
        <span className="asof">{asOf ? `AS OF ${asOf.toLocaleString('en-GB', { hour12: false })}` : '—'} · ↻ 10s</span>
      </div>

      {data && <Ticker survey={survey} t={t} layers={layers} />}

      {state === 'error' && (
        <div className="err">DATA LINK DOWN — {err || 'unable to reach /api/stats'}. Check DASHBOARD_TOKEN env on the deployment.</div>
      )}

      {data && (
        <>
          {/* KPI ROW */}
          <div className="grid" style={{ marginBottom: 14 }}>
            <div className={`col-3 ${flash ? 'flash' : ''}`}><Kpi tone="acid" label="Survey responses" value={fmt(survey.total)} sub={`${fmt(survey.valid)} valid`} /></div>
            <div className="col-3"><Kpi tone="cyan" label="Sessions" value={fmt(t.sessions_total)} sub={`${fmt(t.anon_sessions)} anonymous`} /></div>
            <div className={`col-3 ${flash ? 'flash' : ''}`}><Kpi tone="magenta" label="Messages" value={fmt(t.messages_total)} sub={`${fmt(t.user_messages)} user · ${fmt(t.bot_messages)} bot`} /></div>
            <div className="col-3"><Kpi tone="amber" label="Registered users" value={fmt(t.users_total)} sub={`${fmt(t.users_email)} email · ${fmt(t.users_kakao)} kakao`} /></div>
          </div>

          <div className="grid">
            <div className="section-label">01 · Trust Survey</div>

            <div className="col-4">
              <Panel idx="1.1" title="Trust layers" sub="avg / max">
                {['L1', 'L2', 'L3', 'L4', 'total'].map(L => {
                  const o = layers[L]
                  const p = o && o.avg != null ? (o.avg / o.max) * 100 : 0
                  return <BarRow key={L} k={L === 'total' ? 'TOTAL' : L} pct={p}
                    value={o && o.avg != null ? `${o.avg}/${o.max}` : '—'} color={L === 'total' ? 'acid' : 'cyan'} />
                })}
                <div className="empty">Higher = stronger perceived trust signal.</div>
              </Panel>
            </div>

            <div className="col-8">
              <Panel idx="1.2" title="Trust components · YES rate" sub={`${compRows.length} items`}>
                {compRows.length === 0 && <div className="empty">No responses yet.</div>}
                {compRows.map(r => (
                  <BarRow key={r.k} k={r.label} pct={r.yes_pct} value={pctStr(r.yes_pct)}
                    color={r.yes_pct >= 80 ? 'acid' : r.yes_pct >= 50 ? 'cyan' : 'red'} />
                ))}
              </Panel>
            </div>

            <div className="col-6">
              <Panel idx="1.3" title="Score distribution" sub="total yes 0–18">
                {scoreHist.length ? <Hist items={scoreHist} color="acid" /> : <div className="empty">No responses yet.</div>}
              </Panel>
            </div>

            <div className="col-6">
              <Panel idx="1.4" title="Demographics" sub="n per group">
                <Demo survey={survey} />
              </Panel>
            </div>

            <div className="section-label">02 · Usage Analytics</div>

            <div className="col-3"><Kpi label="Avg turns / session" value={usage.session_avg?.turns ?? '—'} /></div>
            <div className="col-3"><Kpi label="Avg session (min)" value={usage.session_avg?.minutes ?? '—'} /></div>
            <div className="col-3"><Kpi label="Anon messages" value={fmt(t.anon_messages)} /></div>
            <div className="col-3"><Kpi label="Active days" value={fmt((usage.activity || []).length)} /></div>

            <div className="col-6">
              <Panel idx="2.1" title="Activity by hour" sub="KST · user msgs">
                <Hist items={hourBins} color="cyan" showCnt={false} />
              </Panel>
            </div>
            <div className="col-6">
              <Panel idx="2.2" title="Turns per session" sub="distribution">
                {turnBins.some(b => b.n) ? <Hist items={turnBins} color="acid" /> : <div className="empty">No sessions yet.</div>}
              </Panel>
            </div>

            <div className="col-4">
              <Panel idx="2.3" title="Revisit count" sub="users by visits">
                {(usage.revisit || []).length === 0 && <div className="empty">—</div>}
                {(usage.revisit || []).map(r => {
                  const max = Math.max(1, ...(usage.revisit || []).map(x => +x.n))
                  return <BarRow key={r.vc} k={`${r.vc}× visit`} pct={(+r.n / max) * 100} value={fmt(r.n)} color="magenta" />
                })}
              </Panel>
            </div>

            <div className="col-8">
              <Panel idx="2.4" title="Most active users" sub="anonymised">
                <div className="tblwrap">
                <table className="tbl">
                  <thead><tr><th>Handle</th><th>Type</th><th className="num">Msgs</th><th className="num">Sessions</th><th className="num">Visits</th><th>Last seen</th></tr></thead>
                  <tbody>
                    {(usage.top_users || []).length === 0 && <tr><td colSpan="6" className="empty">No activity yet.</td></tr>}
                    {(usage.top_users || []).map(u => (
                      <tr key={u.id}>
                        <td>{u.handle}</td>
                        <td><span className={`tag ${u.login_type === 'kakao' ? 'amber' : 'cyan'}`}>{u.login_type}</span></td>
                        <td className="num">{fmt(u.msgs)}</td>
                        <td className="num">{fmt(u.sessions)}</td>
                        <td className="num">{fmt(u.visit_count)}</td>
                        <td>{u.last_login || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </Panel>
            </div>
          </div>

          <div className="foot">
            CHA UNIVERSITY · GLOBAL BUSINESS AI · token-free public telemetry · personal identifiers withheld · auto-refresh every 10s
          </div>
        </>
      )}
    </div>
  )
}

function Demo({ survey }) {
  const d = survey.demographics || {}
  const groups = [
    ['Gender', d.gender], ['Grade', d.grade], ['MBTI', d.mbti], ['Major', d.major1],
  ].filter(([, v]) => Array.isArray(v) && v.length)
  if (!groups.length) return <div className="empty">No demographic data yet.</div>
  return (
    <>
      {groups.map(([title, rows]) => {
        const max = Math.max(1, ...rows.map(r => +r.n))
        return (
          <div key={title} style={{ marginBottom: 10 }}>
            <div className="kpi-label" style={{ marginBottom: 5 }}>{title}</div>
            {rows.slice(0, 6).map(r => (
              <BarRow key={r.k} k={r.k || '—'} pct={(+r.n / max) * 100} value={fmt(r.n)} color="cyan" />
            ))}
          </div>
        )
      })}
    </>
  )
}

// ── DEV-only mock (visual QA without the serverless function) ──
const MOCK = {
  ok: true,
  as_of: '2026-06-05T12:00:00+09:00',
  survey: {
    total: 24, valid: 22,
    components: Object.fromEntries(Object.keys(COMPONENT_LABELS).map((k, i) => {
      const yes_pct = [96, 91, 88, 84, 80, 78, 75, 72, 68, 64, 61, 58, 55, 52, 48, 44, 40, 36, 92][i] ?? 50
      return [k, { n: 22, yes: Math.round(22 * yes_pct / 100), no: 22 - Math.round(22 * yes_pct / 100), yes_pct }]
    })),
    layers: { L1: { avg: 2.5, max: 3 }, L2: { avg: 3.1, max: 4 }, L3: { avg: 3.8, max: 5 }, L4: { avg: 4.2, max: 6 }, total: { avg: 13.6, max: 18 } },
    demographics: {
      gender: [{ k: 'female', n: 13 }, { k: 'male', n: 9 }],
      grade: [{ k: '1', n: 10 }, { k: '2', n: 8 }, { k: '3', n: 4 }],
      mbti: [{ k: 'INFP', n: 5 }, { k: 'ENFP', n: 4 }, { k: 'ISTJ', n: 3 }, { k: 'INTJ', n: 3 }],
      major1: [{ k: 'business', n: 14 }, { k: 'ai_med', n: 8 }],
    },
    score_hist: [{ bucket_lo: 6, n: 2 }, { bucket_lo: 9, n: 5 }, { bucket_lo: 12, n: 8 }, { bucket_lo: 15, n: 7 }],
  },
  usage: {
    totals: { users_total: 18, users_kakao: 5, users_email: 13, sessions_total: 41, messages_total: 612, user_messages: 318, bot_messages: 294, anon_messages: 121, anon_sessions: 14 },
    session_avg: { seconds: 372, minutes: 6.2, turns: 7.8 },
    activity: Array.from({ length: 5 }, (_, i) => ({ d: `2026-06-0${i + 1}`, sessions: 6 + i, active_users: 3 + i })),
    turn_hist: { bin_1: 6, bin_2: 9, bin_3: 8, bin_4_5: 10, bin_6_10: 6, bin_11p: 2 },
    hourly: HOURS.map(h => ({ h, n: Math.round(20 * Math.exp(-Math.pow(h - 14, 2) / 40)) })),
    revisit: [{ vc: 1, n: 11 }, { vc: 2, n: 4 }, { vc: 3, n: 2 }, { vc: 5, n: 1 }],
    top_users: Array.from({ length: 6 }, (_, i) => ({ id: i + 1, handle: `USER#${i + 1}`, login_type: i % 3 === 0 ? 'kakao' : 'email', visit_count: 5 - (i % 4), last_login: '2026-06-05 11:2' + i, msgs: 88 - i * 11, user_msgs: 44 - i * 5, sessions: 4 - (i % 3) })),
  },
}
