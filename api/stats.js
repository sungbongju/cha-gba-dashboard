// api/stats.js — token-free public proxy for the GBA research dashboard.
//
// The school-server summary endpoints (survey_summary / usage_summary) are gated
// by a dashboard token. This Vercel function holds that token server-side (env
// DASHBOARD_TOKEN) and exposes a SINGLE merged, PII-minimised payload that anyone
// can read without a token. Personal names are stripped here so the public
// dashboard never exposes them.
//
// Env (set in Vercel project settings):
//   DASHBOARD_TOKEN   — the school server's CHA_DASHBOARD_TOKEN value (required)
//   SCHOOL_API_BASE   — optional override of the PHP API base URL

const SCHOOL_API_BASE =
  process.env.SCHOOL_API_BASE ||
  'https://aiforalab.com/globalbiz-api/globalbiz-api.php'

async function callSummary(action, token) {
  const r = await fetch(`${SCHOOL_API_BASE}?action=${encodeURIComponent(action)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Dashboard-Token': token,
    },
    body: '{}',
  })
  const text = await r.text()
  let json
  try { json = JSON.parse(text) } catch { json = { success: false, error: 'bad upstream', raw: text.slice(0, 200) } }
  return json
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'no-store')

  const token = process.env.DASHBOARD_TOKEN || ''
  if (!token) {
    return res.status(500).json({ ok: false, error: 'DASHBOARD_TOKEN not configured on the server' })
  }

  try {
    const [survey, usage] = await Promise.all([
      callSummary('survey_summary', token),
      callSummary('usage_summary', token),
    ])

    // Strip PII: replace real names with anonymous handles.
    if (usage && Array.isArray(usage.top_users)) {
      usage.top_users = usage.top_users.map(u => ({
        ...u,
        name: undefined,
        handle: `USER#${u.id}`,
      }))
    }

    return res.status(200).json({
      ok: true,
      as_of: new Date().toISOString(),
      survey: survey && survey.success ? survey : { error: survey && survey.error },
      usage: usage && usage.success ? usage : { error: usage && usage.error },
    })
  } catch (e) {
    return res.status(502).json({ ok: false, error: e.message || 'stats proxy failed' })
  }
}
