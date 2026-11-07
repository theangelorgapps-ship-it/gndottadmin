import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Pie, PieChart } from 'recharts'
import { getAdminStats } from '../../lib/admin'
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent,
  type ChartConfig,
} from '../../components/ui/chart'

export const Route = createFileRoute('/admin/')({
  validateSearch: (s: Record<string, unknown>) => ({
    from: typeof s.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.from) ? s.from : undefined,
    to: typeof s.to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.to) ? s.to : undefined,
  }),
  loaderDeps: ({ search }) => ({ from: search.from, to: search.to }),
  loader: async ({ deps }) => await getAdminStats({ data: { from: deps.from || undefined, to: deps.to || undefined } }),
  component: AdminDashboard,
})

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
  { key: 'activeSubs', label: 'Active Subscribers', to: '/admin/subscriptions', icon: 'crown' },
  { key: 'soonToExpire', label: 'Soon to Expire', to: '/admin/soon-to-expire', icon: 'layers' },
  { key: 'teaching', label: 'Teachings', to: '/admin/teaching', icon: 'book' },
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
      <path d={area} fill="#60a5fa" opacity="0.08" />
      <path d={line} fill="none" stroke="#60a5fa" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function DashStatCard({
  to, icon, label, value, series,
}: {
  to: string
  icon: string
  label: string
  value: React.ReactNode
  series: { m: string; n: number }[]
}) {
  const delta = sparkDelta(series)
  const pct = Math.min(100, Math.abs(delta))
  return (
    <Link to={to as any} className="dash-card cc-card group" aria-label={`Open ${label}: ${value}`}>
      <div className="cc-card-header">
        <span className="stat-ico" style={{ marginBottom: 0 }}><Ico d={PATHS[icon]} /></span>
        <span className="cc-date group-hover:text-foreground">{label}</span>
      </div>
      <div className="cc-card-body">
        <h3>{value}</h3>
        <Spark series={series} />
      </div>
      <div className="cc-card-footer">
        <div className="cc-progress">
          <span>Six-month trend</span>
          <div
            className="cc-progress-bar"
            style={{ ['--cc-progress' as any]: `${pct}%` }}
            role="progressbar"
            aria-label={`${label} trend magnitude`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          />
        </div>
        <span className={`cc-btn-countdown ${delta < 0 ? 'neg' : ''}`}>
          {delta > 0 ? '+' : ''}{delta}% {delta > 0 ? '↑' : delta < 0 ? '↓' : '→'}
        </span>
      </div>
    </Link>
  )
}

const DONUT_COLORS = ['#60a5fa', '#3b82f6', '#34d399', '#fbbf24', '#a5b4fc']

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
    <section className="panel genre-panel overflow-visible" aria-labelledby="genre-heading">
      <div className="mb-4">
        <h2 id="genre-heading" className="text-base font-semibold">Top 5 Genres</h2>
        <p className="mt-1 text-xs text-muted-foreground">Content mapped to each genre</p>
      </div>
      {total === 0 ? (
        <div className="empty px-3 py-10">
          <p className="font-medium text-foreground">No genre mappings yet</p>
          <p className="mt-1 text-sm">Mappings appear here as content is categorized.</p>
        </div>
      ) : (
        <>
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square max-h-[280px] min-h-[220px] w-full"
            role="img"
            aria-label={`Genre distribution across ${total} content mappings`}
          >
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={chartData}
                dataKey="n"
                nameKey="name"
                innerRadius={64}
                outerRadius={104}
                strokeWidth={4}
                stroke="var(--card)"
              />
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
          </ChartContainer>
          <ul className="mt-3 space-y-2 text-xs" aria-label="Genre totals">
            {chartData.map((genre) => (
              <li key={genre.name} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                  <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: genre.fill }} aria-hidden="true" />
                  <span className="break-words">{genre.name}</span>
                </span>
                <span className="shrink-0 font-medium tabular-nums">{genre.n.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function contentLabel(type: string) {
  if (type === 'tvshow') return 'Show'
  if (type === 'teaching') return 'Teaching'
  return 'Sermon'
}

function contentDestination(type: string) {
  if (type === 'tvshow') return '/admin/tv-shows'
  if (type === 'teaching') return '/admin/teaching'
  return '/admin/movies'
}

function EmptyPanel({ title, help }: { title: string; help: string }) {
  return (
    <div className="empty px-4 py-8">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm">{help}</p>
    </div>
  )
}

function AdminDashboard() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const router = useRouter()
  const [from, setFrom] = useState<string>(search.from ?? '')
  const [to, setTo] = useState<string>(search.to ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setFrom(search.from ?? '')
    setTo(search.to ?? '')
  }, [search.from, search.to])

  async function navigateRange(nextFrom: string, nextTo: string) {
    if (nextFrom && nextTo && nextFrom > nextTo) {
      setError('The from date must be on or before the to date.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await router.navigate({ search: { from: nextFrom, to: nextTo } as any })
    } catch (navigationError: any) {
      setError(navigationError?.message ?? 'The dashboard could not be updated. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-w-0">
      <div className="breadcrumb"><span className="here">Dashboard</span></div>
      <div className="mb-5 flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="m-0">Operations overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">Monitor content, people, subscriptions, and revenue across GoodNews Halobox.</p>
        </div>
        {(search.from || search.to) && (
          <span className="pill info" aria-live="polite">
            {search.from || 'Earliest'} to {search.to || 'Today'}
          </span>
        )}
      </div>

      <form
        className="panel mb-5 grid min-w-0 grid-cols-1 gap-3 overflow-visible sm:grid-cols-2 lg:grid-cols-[minmax(10rem,1fr)_minmax(10rem,1fr)_auto_auto]"
        aria-label="Dashboard date filter"
        aria-busy={busy}
        onSubmit={(event) => {
          event.preventDefault()
          void navigateRange(from, to)
        }}
      >
        <div className="min-w-0">
          <label htmlFor="dashboard-from" className="mb-1.5 block text-xs font-semibold text-muted-foreground">From date</label>
          <input
            id="dashboard-from"
            type="date"
            value={from}
            disabled={busy}
            onChange={(event) => setFrom(event.target.value)}
            className="h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground md:h-10"
          />
        </div>
        <div className="min-w-0">
          <label htmlFor="dashboard-to" className="mb-1.5 block text-xs font-semibold text-muted-foreground">To date</label>
          <input
            id="dashboard-to"
            type="date"
            value={to}
            disabled={busy}
            onChange={(event) => setTo(event.target.value)}
            className="h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground md:h-10"
          />
        </div>
        <button type="submit" className="btn btn-primary self-end" disabled={busy} aria-busy={busy}>
          {busy ? 'Applying…' : 'Apply filter'}
        </button>
        <button
          type="button"
          className="btn btn-dark self-end"
          disabled={busy || (!from && !to && !search.from && !search.to)}
          onClick={() => {
            setFrom('')
            setTo('')
            void navigateRange('', '')
          }}
        >Reset</button>
        {error && <div className="error col-span-full m-0" role="alert">{error}</div>}
      </form>

      <div className="dash-grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_minmax(17rem,22.5rem)]">
        <div className="min-w-0">
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {CARDS.map((card) => (
              <DashStatCard
                key={card.key}
                to={card.to}
                icon={card.icon}
                label={card.label}
                value={Number((data.counts as any)[card.key] ?? 0).toLocaleString()}
                series={(data.monthly as any)[card.key] ?? []}
              />
            ))}
            <DashStatCard
              to="/admin/rent-history"
              icon="dollar"
              label="Rent Revenue"
              value={`$${Number(data.rentRevenue).toFixed(2)}`}
              series={(data.monthly.rentContent ?? []) as { m: string; n: number }[]}
            />
            <DashStatCard
              to="/admin/subscriptions"
              icon="dollar"
              label="Total Revenue"
              value={`$${Number(data.revenue).toFixed(2)}`}
              series={(data.monthly.activeSubs ?? []) as { m: string; n: number }[]}
            />
          </div>

          <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
            <section className="panel overflow-visible" aria-labelledby="latest-content-heading">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 id="latest-content-heading" className="text-base font-semibold">Latest Content</h2>
                <span className="text-xs text-muted-foreground">{data.recentContent.length} records</span>
              </div>
              {data.recentContent.length === 0 ? (
                <EmptyPanel title="No content in this period" help="New Sermons, Shows, and Teachings will appear here." />
              ) : (
                <ul className="m-0 list-none divide-y divide-border p-0">
                  {data.recentContent.map((item: any) => (
                    <li key={item.id} className="grid min-w-0 grid-cols-1 gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <div className="min-w-0">
                        <Link to={contentDestination(item.type) as any} className="cell-title hover:text-primary">
                          {item.name}
                        </Link>
                        <p className="cell-sub">{contentLabel(item.type)} · {item.release_date ? String(item.release_date).slice(0, 10) : 'No release date'}</p>
                      </div>
                      <span className={`pill w-fit ${item.status == 1 ? 'on' : 'off'}`}>{item.status == 1 ? 'Active' : 'Inactive'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="panel overflow-visible" aria-labelledby="transactions-heading">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 id="transactions-heading" className="text-base font-semibold">Recent Transactions</h2>
                <Link to={'/admin/subscriptions' as any} className="text-xs font-semibold text-primary hover:underline">View all</Link>
              </div>
              {data.recentTransactions.length === 0 ? (
                <EmptyPanel title="No transactions in this period" help="Subscription payments will appear here." />
              ) : (
                <ul className="m-0 list-none divide-y divide-border p-0">
                  {data.recentTransactions.map((transaction: any) => (
                    <li key={transaction.id}>
                      <Link to={'/admin/subscriptions' as any} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 py-3 first:pt-0 last:pb-0">
                        <span className="min-w-0">
                          <span className="block break-words font-medium text-foreground">{transaction.user_email ?? transaction.email ?? `User #${transaction.id}`}</span>
                          <span className="cell-sub">{transaction.created_at ? String(transaction.created_at).slice(0, 10) : 'Date unavailable'}</span>
                        </span>
                        <span className="flex flex-col items-end gap-1">
                          <span className="font-semibold tabular-nums">${Number(transaction.amount).toFixed(2)}</span>
                          <span className={`pill ${transaction.payment_status === 'paid' ? 'on' : 'warn'}`}>{transaction.payment_status ?? 'Pending'}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="panel mt-4 overflow-visible" aria-labelledby="recent-users-heading">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="recent-users-heading" className="text-base font-semibold">Newest Users</h2>
              <Link to={'/admin/users' as any} className="text-xs font-semibold text-primary hover:underline">Manage users</Link>
            </div>
            {data.recentUsers.length === 0 ? (
              <EmptyPanel title="No new users in this period" help="New account registrations will appear here." />
            ) : (
              <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2 xl:grid-cols-3">
                {data.recentUsers.map((user: any) => {
                  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || `User #${user.id}`
                  return (
                    <li key={user.id} className="min-w-0 rounded-md border border-border bg-background p-3">
                      <Link to={`/admin/user/${user.id}` as any} className="block min-w-0">
                        <span className="block truncate font-medium text-foreground" title={name}>{name}</span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground" title={user.email ?? ''}>{user.email ?? 'No email provided'}</span>
                        <span className="mt-2 block text-xs text-muted-foreground">Joined {user.created_at ? String(user.created_at).slice(0, 10) : '—'}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
        <GenreDonut data={data.genreTop as any} />
      </div>
    </div>
  )
}
