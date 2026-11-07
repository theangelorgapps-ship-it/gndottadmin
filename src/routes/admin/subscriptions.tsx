import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { adminListSubscriptions } from '../../lib/admin'

export const Route = createFileRoute('/admin/subscriptions')({
  loader: async () => await adminListSubscriptions(),
  component: AdminSubscriptions,
})

function formatDate(value: unknown) {
  return value ? String(value).slice(0, 10) : '—'
}

function isActive(status: unknown) {
  return status == 1 || status === 'active'
}

function paymentLabel(status: unknown) {
  const value = String(status ?? 'pending').replaceAll('_', ' ')
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function EmptyCollection({ title, help }: { title: string; help: string }) {
  return (
    <div className="empty px-4 py-8">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm">{help}</p>
    </div>
  )
}

function AdminSubscriptions() {
  const { subscriptions, transactions } = Route.useLoaderData()
  const [query, setQuery] = useState('')
  const [subscriptionStatus, setSubscriptionStatus] = useState('all')
  const [transactionStatus, setTransactionStatus] = useState('all')

  const filteredSubscriptions = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return subscriptions.filter((subscription: any) => {
      const matchesQuery = !normalized || [subscription.user_email, subscription.plan_name, subscription.plan_type]
        .some((value) => String(value ?? '').toLowerCase().includes(normalized))
      const matchesStatus = subscriptionStatus === 'all'
        || (subscriptionStatus === 'active' && isActive(subscription.status))
        || (subscriptionStatus === 'ended' && !isActive(subscription.status))
      return matchesQuery && matchesStatus
    })
  }, [subscriptions, query, subscriptionStatus])

  const filteredTransactions = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return transactions.filter((transaction: any) => {
      const matchesQuery = !normalized || [transaction.user_email, transaction.transaction_id, transaction.payment_type]
        .some((value) => String(value ?? '').toLowerCase().includes(normalized))
      const matchesStatus = transactionStatus === 'all'
        || (transactionStatus === 'paid' && transaction.payment_status === 'paid')
        || (transactionStatus === 'attention' && transaction.payment_status !== 'paid')
      return matchesQuery && matchesStatus
    })
  }, [transactions, query, transactionStatus])

  const activeCount = subscriptions.filter((subscription: any) => isActive(subscription.status)).length
  const paidTotal = transactions
    .filter((transaction: any) => transaction.payment_status === 'paid')
    .reduce((sum: number, transaction: any) => sum + Number(transaction.amount ?? 0), 0)

  return (
    <div className="min-w-0">
      <div className="breadcrumb">Dashboard <span className="sep">/</span> <span className="here">Subscriptions</span></div>
      <div className="mb-5">
        <h1 className="m-0">Subscriptions</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage subscriber plans, billing periods, and payment activity.</p>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Subscription summary">
        <div className="panel overflow-visible p-4"><span className="text-xs text-muted-foreground">Active subscriptions</span><p className="mb-0 mt-1 text-2xl font-semibold tabular-nums">{activeCount.toLocaleString()}</p></div>
        <div className="panel overflow-visible p-4"><span className="text-xs text-muted-foreground">Subscription records</span><p className="mb-0 mt-1 text-2xl font-semibold tabular-nums">{subscriptions.length.toLocaleString()}</p></div>
        <div className="panel overflow-visible p-4"><span className="text-xs text-muted-foreground">Paid transaction total</span><p className="mb-0 mt-1 text-2xl font-semibold tabular-nums">${paidTotal.toFixed(2)}</p></div>
      </div>

      <div className="toolbar">
        <div className="min-w-0 flex-1">
          <label htmlFor="subscription-search" className="sr-only">Search subscriptions and transactions</label>
          <input
            id="subscription-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by user, plan, transaction, or method…"
            className="min-h-11 w-full max-w-lg md:min-h-10"
          />
        </div>
        {query && <button type="button" className="btn btn-dark" onClick={() => setQuery('')}>Clear search</button>}
      </div>

      <section className="panel mb-4 overflow-visible" aria-labelledby="subscription-records-heading">
        <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 id="subscription-records-heading" className="m-0 text-base font-semibold">Active & Past Subscriptions</h2>
            <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">{filteredSubscriptions.length} of {subscriptions.length} records</p>
          </div>
          <div className="min-w-0">
            <label htmlFor="subscription-status" className="sr-only">Filter subscriptions by status</label>
            <select
              id="subscription-status"
              value={subscriptionStatus}
              onChange={(event) => setSubscriptionStatus(event.target.value)}
              className="h-11 min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground md:h-10"
            >
              <option value="all">All subscriptions</option>
              <option value="active">Active only</option>
              <option value="ended">Ended only</option>
            </select>
          </div>
        </div>

        {filteredSubscriptions.length === 0 ? (
          <EmptyCollection
            title={subscriptions.length === 0 ? 'No subscriptions yet' : 'No matching subscriptions'}
            help={subscriptions.length === 0 ? 'Subscriber plans will appear here when purchased.' : 'Try a different search or subscription status.'}
          />
        ) : (
          <>
            <div className="table-scroll hidden md:block" role="region" aria-label="Scrollable subscriptions table" tabIndex={0}>
              <table className="admin-table">
                <thead><tr><th scope="col">User</th><th scope="col">Plan</th><th scope="col">Amount</th><th scope="col">Start</th><th scope="col">End</th><th scope="col">Status</th></tr></thead>
                <tbody>
                  {filteredSubscriptions.map((subscription: any) => (
                    <tr key={subscription.id}>
                      <td><span className="break-words">{subscription.user_email ?? '—'}</span></td>
                      <td><span className="cell-title">{subscription.plan_name ?? '—'}</span><span className="cell-sub capitalize">{subscription.plan_type ?? ''}</span></td>
                      <td className="whitespace-nowrap font-medium tabular-nums">${Number(subscription.total_amount ?? subscription.amount ?? 0).toFixed(2)}</td>
                      <td className="whitespace-nowrap tabular-nums">{formatDate(subscription.start_date)}</td>
                      <td className="whitespace-nowrap tabular-nums">{formatDate(subscription.end_date)}</td>
                      <td><span className={`pill ${isActive(subscription.status) ? 'on' : 'off'}`}>{isActive(subscription.status) ? 'Active' : 'Ended'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:hidden" aria-label="Subscription records">
              {filteredSubscriptions.map((subscription: any) => (
                <li key={subscription.id} className="rounded-lg border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="m-0 break-words font-medium text-foreground">{subscription.plan_name ?? '—'}</p>
                      <p className="cell-sub break-words">{subscription.user_email ?? 'No user email'}</p>
                    </div>
                    <span className={`pill shrink-0 ${isActive(subscription.status) ? 'on' : 'off'}`}>{isActive(subscription.status) ? 'Active' : 'Ended'}</span>
                  </div>
                  <dl className="mb-0 mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div><dt className="text-muted-foreground">Amount</dt><dd className="m-0 mt-1 font-medium tabular-nums text-foreground">${Number(subscription.total_amount ?? subscription.amount ?? 0).toFixed(2)}</dd></div>
                    <div><dt className="text-muted-foreground">Plan type</dt><dd className="m-0 mt-1 capitalize text-foreground">{subscription.plan_type ?? '—'}</dd></div>
                    <div><dt className="text-muted-foreground">Starts</dt><dd className="m-0 mt-1 tabular-nums text-foreground">{formatDate(subscription.start_date)}</dd></div>
                    <div><dt className="text-muted-foreground">Ends</dt><dd className="m-0 mt-1 tabular-nums text-foreground">{formatDate(subscription.end_date)}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="panel overflow-visible" aria-labelledby="transaction-records-heading">
        <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 id="transaction-records-heading" className="m-0 text-base font-semibold">Transactions</h2>
            <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">{filteredTransactions.length} of {transactions.length} records</p>
          </div>
          <div className="min-w-0">
            <label htmlFor="transaction-status" className="sr-only">Filter transactions by payment status</label>
            <select
              id="transaction-status"
              value={transactionStatus}
              onChange={(event) => setTransactionStatus(event.target.value)}
              className="h-11 min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground md:h-10"
            >
              <option value="all">All payment states</option>
              <option value="paid">Paid only</option>
              <option value="attention">Needs attention</option>
            </select>
          </div>
        </div>

        {filteredTransactions.length === 0 ? (
          <EmptyCollection
            title={transactions.length === 0 ? 'No transactions yet' : 'No matching transactions'}
            help={transactions.length === 0 ? 'Payment activity will appear here.' : 'Try a different search or payment status.'}
          />
        ) : (
          <>
            <div className="table-scroll hidden md:block" role="region" aria-label="Scrollable transactions table" tabIndex={0}>
              <table className="admin-table min-w-[46rem]">
                <thead><tr><th scope="col">Transaction</th><th scope="col">User</th><th scope="col">Amount</th><th scope="col">Method</th><th scope="col">Status</th><th scope="col">Date</th></tr></thead>
                <tbody>
                  {filteredTransactions.map((transaction: any) => (
                    <tr key={transaction.id}>
                      <td><span className="break-all font-mono text-xs text-muted-foreground">{transaction.transaction_id ?? `#${transaction.id}`}</span></td>
                      <td><span className="break-words">{transaction.user_email ?? '—'}</span></td>
                      <td className="whitespace-nowrap font-medium tabular-nums">${Number(transaction.amount ?? 0).toFixed(2)}</td>
                      <td className="capitalize">{transaction.payment_type ?? '—'}</td>
                      <td><span className={`pill ${transaction.payment_status === 'paid' ? 'on' : 'warn'}`}>{paymentLabel(transaction.payment_status)}</span></td>
                      <td className="whitespace-nowrap tabular-nums">{formatDate(transaction.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:hidden" aria-label="Transaction records">
              {filteredTransactions.map((transaction: any) => (
                <li key={transaction.id} className="rounded-lg border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="m-0 break-all font-mono text-xs text-muted-foreground">{transaction.transaction_id ?? `#${transaction.id}`}</p>
                      <p className="mb-0 mt-1 break-words text-sm font-medium text-foreground">{transaction.user_email ?? 'No user email'}</p>
                    </div>
                    <span className={`pill shrink-0 ${transaction.payment_status === 'paid' ? 'on' : 'warn'}`}>{paymentLabel(transaction.payment_status)}</span>
                  </div>
                  <dl className="mb-0 mt-4 grid grid-cols-3 gap-3 text-xs">
                    <div><dt className="text-muted-foreground">Amount</dt><dd className="m-0 mt-1 font-medium tabular-nums text-foreground">${Number(transaction.amount ?? 0).toFixed(2)}</dd></div>
                    <div><dt className="text-muted-foreground">Method</dt><dd className="m-0 mt-1 break-words capitalize text-foreground">{transaction.payment_type ?? '—'}</dd></div>
                    <div><dt className="text-muted-foreground">Date</dt><dd className="m-0 mt-1 tabular-nums text-foreground">{formatDate(transaction.created_at)}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}
