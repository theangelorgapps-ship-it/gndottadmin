import { createFileRoute, Link } from '@tanstack/react-router'
import { getAdminStats } from '../../lib/admin'

export const Route = createFileRoute('/admin/')({
  loader: async () => await getAdminStats(),
  component: AdminDashboard,
})

// Lucide-style inline icons (stroke, no container styling here — the stat-ico
// box matches the Laravel original admin design ground truth)
const PATHS: Record<string, string> = {
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  crown: 'M11.6 3.3a.5.5 0 0 1 .8 0l3.2 4.3 4-2.8a.5.5 0 0 1 .8.5l-2.5 9a.5.5 0 0 1-.5.4H6.6a.5.5 0 0 1-.5-.4l-2.5-9a.5.5 0 0 1 .8-.5l4 2.8z M5 21h14',
  film: 'M7 3v18 M17 3v18 M3 7.5h4 M3 12h18 M3 16.5h4 M17 7.5h4 M17 16.5h4 M4.2 3h15.6c1.2 0 2.2 1 2.2 2.2v13.6c0 1.2-1 2.2-2.2 2.2H4.2C3 21 2 20 2 18.8V5.2C2 4 3 3 4.2 3',
  tv: 'M17 2 12 7 7 2 M2 9h20v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z',
  play: 'M6 4.5v15l13-7.5z',
  radio: 'M12 12a2 2 0 1 0 0 .01 M7.7 16.3a5.5 5.5 0 0 1 0-8.6 M16.3 7.7a5.5 5.5 0 0 1 0 8.6 M4.6 19.4a10 10 0 0 1 0-14.8 M19.4 4.6a10 10 0 0 1 0 14.8',
  tag: 'M12.6 2.6 21 11a2 2 0 0 1 0 2.8l-7.2 7.2a2 2 0 0 1-2.8 0L2.6 12.6A2 2 0 0 1 2 11.2V4a2 2 0 0 1 2-2h7.2a2 2 0 0 1 1.4.6 M7.5 7.5h.01',
  layers: 'M12 2 2 8l10 6 10-6z M2 14l10 6 10-6',
  dollar: 'M12 2v20 M17 5.5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
}

function Ico({ d, size = 17 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.split(' M').map((seg, i) => <path key={i} d={(i === 0 ? '' : 'M') + seg} />)}
    </svg>
  )
}

const CARDS: { key: string; label: string; to: string; icon: string }[] = [
  { key: 'users', label: 'Total Users', to: '/admin/users', icon: 'users' },
  { key: 'activeSubs', label: 'Total Subscribers', to: '/admin/subscriptions', icon: 'crown' },
  { key: 'movies', label: 'Movies', to: '/admin/movies', icon: 'film' },
  { key: 'tvshows', label: 'TV Shows', to: '/admin/tv-shows', icon: 'tv' },
  { key: 'videos', label: 'Videos', to: '/admin/videos', icon: 'play' },
  { key: 'channels', label: 'Live Channels', to: '/admin/live-tv', icon: 'radio' },
  { key: 'genres', label: 'Genres', to: '/admin/genres', icon: 'tag' },
  { key: 'plans', label: 'Plans', to: '/admin/plans', icon: 'layers' },
  { key: 'cast', label: 'Cast & Crew', to: '/admin/movies', icon: 'users' },
]

function Spark({ series }: { series: { m: string; n: number }[] }) {
  const pts = [...series].reverse().map((r) => Number(r.n) || 0)
  while (pts.length < 6) pts.unshift(0)
  const max = Math.max(...pts, 1)
  const W = 200, H = 56
  const step = W / (pts.length - 1)
  const coords = pts.map((v, i) => [i * step, H - 6 - (v / max) * (H - 14)] as const)
  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${W},${H} L0,${H} Z`
  const last = pts[pts.length - 1]
  const prev = pts[pts.length - 2]
  const delta = prev === 0 ? (last > 0 ? 100 : 0) : Math.round(((last - prev) / prev) * 100)
  return (
    <>
      <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1db954" stopOpacity="0.35" />
            <stop offset="1" stopColor="#1db954" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#sparkfill)" />
        <path d={line} fill="none" stroke="#1db954" strokeWidth="2" />
      </svg>
      <span className={`delta ${delta < 0 ? 'neg' : ''}`}>
        {delta >= 0 ? '+' : ''}{delta}% {delta >= 0 ? '↑' : '↓'}
      </span>
    </>
  )
}

const DONUT_COLORS = ['#e50914', '#b00610', '#ff4d4d', '#7a040c', '#d92632']

function GenreDonut({ data }: { data: { name: string; n: number }[] }) {
  const total = data.reduce((s, g) => s + Number(g.n), 0)
  const R = 15.9155 // circumference = 100
  let offset = 25
  return (
    <div className="panel genre-panel">
      <h3>Top 5 Genres</h3>
      {total === 0 ? (
        <p style={{ color: 'var(--muted-2)', fontSize: 13 }}>No genre mappings yet.</p>
      ) : (
        <>
          <svg viewBox="0 0 42 42" className="donut" aria-hidden="true">
            <circle cx="21" cy="21" r={R} fill="none" stroke="#1a242c" strokeWidth="6" />
            {data.map((g, i) => {
              const pct = (Number(g.n) / total) * 100
              const el = (
                <circle key={g.name} cx="21" cy="21" r={R} fill="none"
                  stroke={DONUT_COLORS[i % DONUT_COLORS.length]} strokeWidth="6"
                  strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={offset} />
              )
              offset -= pct
              return el
            })}
          </svg>
          <ul className="donut-legend">
            {data.map((g, i) => (
              <li key={g.name}>
                <span className="dot" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                {g.name}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function AdminDashboard() {
  const data = Route.useLoaderData()
  return (
    <div>
      <div className="breadcrumb">Dashboard</div>
      <div className="dash-grid">
        <div>
          <div className="stat-grid">
            {CARDS.map((c) => (
              <Link to={c.to as any} className="stat-card" key={c.key}>
                <span className="stat-ico"><Ico d={PATHS[c.icon]} /></span>
                <Spark series={(data.monthly as any)[c.key] ?? []} />
                <span className="lbl">{c.label}</span>
                <span className="num">{(data.counts as any)[c.key] ?? 0}</span>
              </Link>
            ))}
            <div className="stat-card">
              <span className="stat-ico"><Ico d={PATHS.dollar} /></span>
              <Spark series={data.monthly.activeSubs ?? []} />
              <span className="lbl">Total Revenue</span>
              <span className="num">${Number(data.revenue).toFixed(2)}</span>
            </div>
          </div>
          <div className="admin-2col" style={{ marginTop: 22 }}>
            <div className="panel">
              <h3>Latest Content</h3>
              <table className="admin-table">
                <thead>
                  <tr><th>Title</th><th>Type</th><th>Release</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {data.recentContent.map((m: any) => (
                    <tr key={m.id}>
                      <td><span className="cell-title">{m.name}</span></td>
                      <td>{m.type === 'tvshow' ? 'TV Show' : 'Movie'}</td>
                      <td>{m.release_date ? String(m.release_date).slice(0, 10) : '—'}</td>
                      <td><span className={`pill ${m.status == 1 ? 'on' : 'off'}`}>{m.status == 1 ? 'Active' : 'Off'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="panel">
              <h3>Recent Transactions</h3>
              {data.recentTransactions.length === 0 ? (
                <p style={{ color: 'var(--muted-2)', fontSize: 13 }}>No transactions yet.</p>
              ) : (
                data.recentTransactions.map((t: any) => (
                  <div key={t.id} className="setting-row" style={{ marginBottom: 8 }}>
                    <span className="s-name">{t.user_email ?? `user #${t.id}`}</span>
                    <span style={{ fontWeight: 600 }}>${Number(t.amount).toFixed(2)}</span>
                    <span className={`pill ${t.payment_status === 'paid' ? 'on' : 'warn'}`}>{t.payment_status}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        <GenreDonut data={data.genreTop as any} />
      </div>
    </div>
  )
}
