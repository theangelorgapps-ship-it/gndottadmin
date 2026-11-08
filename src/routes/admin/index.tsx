import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Pie, PieChart } from 'recharts'
import { getAdminStats } from '../../lib/admin'
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent,
  type ChartConfig,
} from '../../components/ui/chart'

export const Route = createFileRoute('/admin/')({
  validateSearch: (s: Record<string, unknown>) => ({
    from: typeof s.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.from) ? s.from : '',
    to: s.to && typeof s.to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.to) ? s.to : '',
  }),
  loaderDeps: ({ search }) => ({ from: search.from, to: search.to }),
  loader: async ({ deps }) => await getAdminStats({ data: { from: deps.from || undefined, to: deps.to || undefined } }),
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
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z',
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
  { key: 'soonToExpire', label: 'Total Soon to Expire', to: '/admin/soon-to-expire', icon: 'layers' },
  { key: 'teaching', label: 'Teaching', to: '/admin/teaching', icon: 'book' },
  { key: 'rentContent', label: 'Rent Content', to: '/admin/rent-history', icon: 'play' },
  { key: 'movies', label: 'Sermons', to: '/admin/movies', icon: 'film' },
  { key: 'tvshows', label: 'Shows', to: '/admin/tv-shows', icon: 'tv' },
  { key: 'videos', label: 'Videos', to: '/admin/videos', icon: 'play' },
  { key: 'channels', label: 'Live Channels', to: '/admin/live-tv', icon: 'radio' },
  { key: 'genres', label: 'Genres', to: '/admin/genres', icon: 'tag' },
  { key: 'plans', label: 'Plans', to: '/admin/plans', icon: 'layers' },
  { key: 'cast', label: 'Personalities', to: '/admin/actors', icon: 'users' },
]

function sparkDelta(series: { m: string; n: number }[]): number {
  const pts = [...series].reverse().map((r) => Number(r.n) || 0)
  while (pts.length < 6) pts.unshift(0)
  const last = pts[pts.length - 1]
  const prev = pts[pts.length - 2]
  return prev === 0 ? (last > 0 ? 100 : 0) : Math.round(((last - prev) / prev) * 100)
}

function Spark({ series }: { series: { m: string; n: number }[] }) {
  const pts = [...series].reverse().map((r) => Number(r.n) || 0)
  while (pts.length < 6) pts.unshift(0)
  const max = Math.max(...pts, 1)
  const W = 200, H = 56
  const step = W / (pts.length - 1)
  const coords = pts.map((v, i) => [i * step, H - 6 - (v / max) * (H - 14)] as const)
  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${W},${H} L0,${H} Z`
  return (
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
  )
}

const CC_COLORS = ['green', 'orange', 'blue', 'red']

function DashStatCard({
  to, icon, label, value, series, colorIndex,
}: {
  to: string
  icon: string
  label: string
  value: React.ReactNode
  series: { m: string; n: number }[]
  colorIndex: number
}) {
  const delta = sparkDelta(series)
  const pct = Math.min(100, Math.abs(delta))
  return (
    <Link to={to as any} className={`dash-card cc-card ${CC_COLORS[colorIndex % CC_COLORS.length]}`}>
      <div className="cc-card-header">
        <span className="stat-ico" style={{ marginBottom: 0 }}><Ico d={PATHS[icon]} /></span>
        <span className="cc-date">{label}</span>
      </div>
      <div className="cc-card-body">
        <h3>{value}</h3>
        <Spark series={series} />
      </div>
      <div className="cc-card-footer">
        <div className="cc-progress">
          <span>Trend</span>
          <div className="cc-progress-bar" style={{ ['--cc-progress' as any]: `${pct}%` }}></div>
        </div>
        <span className={`cc-btn-countdown ${delta < 0 ? 'neg' : ''}`}>
          {delta >= 0 ? '+' : ''}{delta}% {delta >= 0 ? '↑' : '↓'}
        </span>
      </div>
    </Link>
  )
}

const DONUT_COLORS = ['#e50914', '#b00610', '#ff4d4d', '#7a040c', '#d92632']

function GenreDonut({ data }: { data: { name: string; n: number }[] }) {
  const total = data.reduce((s, g) => s + Number(g.n), 0)
  const chartData = data.map((g, i) => ({
    name: g.name,
    n: Number(g.n),
    fill: DONUT_COLORS[i % DONUT_COLORS.length],
  }))
  const chartConfig = Object.fromEntries(
    data.map((g, i) => [g.name, { label: g.name, color: DONUT_COLORS[i % DONUT_COLORS.length] }]),
  ) satisfies ChartConfig
  return (
    <div className="panel genre-panel">
      <h3>Top 5 Genres</h3>
      {total === 0 ? (
        <p style={{ color: 'var(--muted-2)', fontSize: 13 }}>No genre mappings yet.</p>
      ) : (
        <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[280px]">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Pie
              data={chartData}
              dataKey="n"
              nameKey="name"
              innerRadius={64}
              outerRadius={104}
              strokeWidth={4}
              stroke="var(--bg-soft)"
            />
            <ChartLegend content={<ChartLegendContent nameKey="name" />} />
          </PieChart>
        </ChartContainer>
      )}
    </div>
  )
}

function AdminDashboard() {
  const data = Route.useLoaderData()
  const search = Route.useSearch() as any
  const router = useRouter()
  const [from, setFrom] = useState<string>(search.from ?? '')
  const [to, setTo] = useState<string>(search.to ?? '')
  return (
    <div>
      <div className="breadcrumb">Dashboard</div>
      <form
        className="date-bar"
        onSubmit={(e) => {
          e.preventDefault()
          router.navigate({ search: { from, to } as any })
        }}
      >
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
        <span style={{ color: 'var(--muted-2)' }}>to</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
        <button type="submit" className="btn btn-primary btn-xs">Submit</button>
        <button
          type="button"
          className="btn btn-dark btn-xs"
          onClick={() => { setFrom(''); setTo(''); router.navigate({ search: {} as any }) }}
        >Reset</button>
        {(search.from || search.to) && (
          <span style={{ color: 'var(--muted-2)', fontSize: 13 }}>
            Filtered: {search.from || '…'} → {search.to || '…'}
          </span>
        )}
      </form>
      <div className="dash-grid">
        <div>
          <div className="stat-grid">
            {CARDS.map((c, i) => (
              <DashStatCard
                key={c.key}
                to={c.to}
                icon={c.icon}
                label={c.label}
                value={(data.counts as any)[c.key] ?? 0}
                series={(data.monthly as any)[c.key] ?? []}
                colorIndex={i}
              />
            ))}
            <DashStatCard
              to="/admin/rent-history"
              icon="dollar"
              label="Rent Revenue"
              value={`$${Number(data.rentRevenue).toFixed(2)}`}
              series={data.monthly.rentContent ?? []}
              colorIndex={CARDS.length}
            />
            <DashStatCard
              to="/admin/subscriptions"
              icon="dollar"
              label="Total Revenue"
              value={`$${Number(data.revenue).toFixed(2)}`}
              series={data.monthly.activeSubs ?? []}
              colorIndex={CARDS.length + 1}
            />
          </div>
          <div className="admin-2col" style={{ marginTop: 22 }}>
            <div className="panel">
              <h3>Latest Content</h3>
              <div className="table-scroll">
              <table className="admin-table">
                <thead>
                  <tr><th>Title</th><th>Type</th><th>Release</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {data.recentContent.map((m: any) => (
                    <tr key={m.id}>
                      <td><Link to={(m.type === 'tvshow' ? '/admin/tv-shows' : m.type === 'teaching' ? '/admin/teaching' : '/admin/movies') as any}><span className="cell-title">{m.name}</span></Link></td>
                      <td>{m.type === 'tvshow' ? 'Show' : m.type === 'teaching' ? 'Teaching' : 'Sermon'}</td>
                      <td>{m.release_date ? String(m.release_date).slice(0, 10) : '—'}</td>
                      <td><span className={`pill ${m.status == 1 ? 'on' : 'off'}`}>{m.status == 1 ? 'Active' : 'Off'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
            <div className="panel">
              <h3>Recent Transactions</h3>
              {data.recentTransactions.length === 0 ? (
                <p style={{ color: 'var(--muted-2)', fontSize: 13 }}>No transactions yet.</p>
              ) : (
                data.recentTransactions.map((t: any) => (
                  <Link to={'/admin/subscriptions' as any} key={t.id} className="setting-row" style={{ marginBottom: 8, display: 'flex', textDecoration: 'none' }}>
                    <span className="s-name">{t.user_email ?? `user #${t.id}`}</span>
                    <span style={{ fontWeight: 600 }}>${Number(t.amount).toFixed(2)}</span>
                    <span className={`pill ${t.payment_status === 'paid' ? 'on' : 'warn'}`}>{t.payment_status}</span>
                  </Link>
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
