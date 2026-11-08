import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect, useId, useRef, useState } from 'react'
import { adminListPlans, adminUpsertPlan, adminDeletePlan } from '../../lib/admin'
import { useConfirm } from '../../lib/confirm'
import { useToast } from '../../lib/toast'
import { AdminDataTable } from '../../components/AdminDataTable'

export const Route = createFileRoute('/admin/plans')({
  loader: async () => await adminListPlans(),
  component: AdminPlans,
})

type PForm = {
  id?: number
  name: string
  price: string
  duration: string
  duration_value: string
  level: string
  status: number
  description: string
}

const EMPTY_PLAN: PForm = {
  name: '',
  price: '',
  duration: 'month',
  duration_value: '1',
  level: '1',
  status: 1,
  description: '',
}

function AdminPlans() {
  const items = Route.useLoaderData()
  const router = useRouter()
  const confirmAction = useConfirm()
  const notify = useToast()
  const [editing, setEditing] = useState<PForm | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const dialogTitleId = useId()
  const dialogHelpId = useId()
  const editorOpen = editing !== null

  useEffect(() => {
    if (!editorOpen) return
    const dialog = dialogRef.current
    if (!dialog) return
    const previousFocus = document.activeElement as HTMLElement | null
    if (!dialog.open) dialog.showModal()
    dialog.querySelector<HTMLElement>('[data-initial-focus]')?.focus()
    return () => {
      if (dialog.open) dialog.close()
      setTimeout(() => {
        if (previousFocus?.isConnected) previousFocus.focus()
      }, 0)
    }
  }, [editorOpen])

  function openPlan(plan: PForm) {
    setError(null)
    setEditing(plan)
  }

  function requestClose() {
    if (busy) return
    setEditing(null)
    setError(null)
  }

  async function save() {
    if (!editing || busy) return
    const price = Number(editing.price)
    const durationValue = Number(editing.duration_value)
    const level = Number(editing.level)
    if (!editing.name.trim()) {
      setError('Name is required.')
      return
    }
    if (editing.price.trim() === '' || !Number.isFinite(price) || price < 0) {
      setError('Enter a valid price of zero or more.')
      return
    }
    if (!Number.isInteger(durationValue) || durationValue < 1) {
      setError('Duration value must be a whole number of at least 1.')
      return
    }
    if (!Number.isInteger(level) || level < 1) {
      setError('Level must be a whole number of at least 1.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      await adminUpsertPlan({
        data: {
          ...editing,
          price,
          duration_value: durationValue,
          level,
        },
      })
      notify({ title: editing.id ? 'Plan updated' : 'Plan created', description: editing.name, variant: 'success' })
      setEditing(null)
      router.invalidate()
    } catch (e: any) {
      setError(e?.message ?? 'Save failed.')
      notify({ title: 'Save failed', description: e?.message ?? 'Could not save the plan.', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: number, name: string) {
    const ok = await confirmAction({
      title: `Delete plan "${name}"?`,
      description: 'Subscribers on this plan are not affected retroactively.',
      approveLabel: 'Delete',
    })
    if (!ok) return
    setBusy(true)
    try {
      await adminDeletePlan({ data: id })
      notify({ title: 'Plan deleted', description: name, variant: 'success' })
      router.invalidate()
    } catch (e: any) {
      notify({ title: 'Delete failed', description: e?.message ?? 'Could not delete the plan.', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-w-0">
      <div className="breadcrumb">Dashboard <span className="sep">/</span> <span className="here">Plans</span></div>
      <p className="mb-5 text-sm text-muted-foreground">Monthly plans include the owner and 1 invited email login with 5 pooled devices. Annual plans include the owner and 3 invited email logins with 10 pooled devices. Profiles stay private to each account; they do not count as shared members.</p>
      <div className="toolbar">
        <span className="text-sm text-muted-foreground">Manage subscription pricing, duration, level, and availability.</span>
        <span className="spacer" />
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => openPlan({ ...EMPTY_PLAN })}>
          + New Plan
        </button>
      </div>
      <AdminDataTable
        rows={items.map((plan: any) => ({
          ...plan,
          sharing: plan.duration === 'year' ? '4 email logins · 10 devices' : plan.duration === 'month' ? '2 email logins · 5 devices' : '1 email login · 5 devices',
          duration_label: `${plan.duration_value} ${plan.duration}${Number(plan.duration_value) > 1 ? 's' : ''}`,
        }))}
        columns={[
          { key: 'name', label: 'Plan', kind: 'title' },
          { key: 'price', label: 'Price', kind: 'money' },
          { key: 'duration_label', label: 'Duration' },
          { key: 'sharing', label: 'Shared access (owner included)' },
          { key: 'level', label: 'Level' },
          { key: 'subscribers', label: 'Subscribers' },
          { key: 'status', label: 'Status', kind: 'pill' },
        ]}
        searchable={['name', 'identifier']}
        searchPlaceholder="Search plans…"
        empty="No subscription plans found. Add a plan to offer recurring access."
        busy={busy}
        onEdit={(plan) => openPlan({
          id: plan.id,
          name: plan.name,
          price: String(plan.price),
          duration: plan.duration ?? 'month',
          duration_value: String(plan.duration_value ?? 1),
          level: String(plan.level ?? 1),
          status: plan.status ?? 1,
          description: plan.description ?? '',
        })}
        onDelete={(plan) => remove(plan.id, plan.name)}
      />

      {editing && (
        <dialog
          ref={dialogRef}
          className="modal modal-wide m-auto max-h-[calc(100dvh-2rem)] w-[min(45rem,calc(100vw-2rem))] max-w-full overflow-y-auto overscroll-contain p-5 sm:p-6 [&::backdrop]:bg-[rgba(2,8,18,0.82)]"
          aria-modal="true"
          aria-labelledby={dialogTitleId}
          aria-describedby={dialogHelpId}
          aria-busy={busy}
          onCancel={(event) => {
            event.preventDefault()
            requestClose()
          }}
          onClick={(event) => {
            if (event.target !== event.currentTarget || busy) return
            const rect = event.currentTarget.getBoundingClientRect()
            const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom
            if (outside) requestClose()
          }}
        >
          <form
            className="min-w-0"
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              void save()
            }}
          >
            <div className="mb-5">
              <h2 id={dialogTitleId} className="mb-1">{editing.id ? 'Edit' : 'New'} Plan</h2>
              <p id={dialogHelpId} className="text-sm text-muted-foreground">Fields marked * are required. Set the billing period and display level before saving.</p>
            </div>
            <div className="modal-form">
              <div className="mfield span2">
                <label htmlFor="plan-name">Name *</label>
                <input
                  id="plan-name"
                  data-initial-focus
                  value={editing.name}
                  disabled={busy}
                  aria-required="true"
                  onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                />
              </div>
              <div className="mfield">
                <label htmlFor="plan-price">Price (USD) *</label>
                <input
                  id="plan-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editing.price}
                  disabled={busy}
                  aria-required="true"
                  onChange={(event) => setEditing({ ...editing, price: event.target.value })}
                />
              </div>
              <div className="mfield">
                <label htmlFor="plan-level">Level *</label>
                <input
                  id="plan-level"
                  type="number"
                  min="1"
                  step="1"
                  value={editing.level}
                  disabled={busy}
                  aria-required="true"
                  onChange={(event) => setEditing({ ...editing, level: event.target.value })}
                />
              </div>
              <div className="mfield">
                <label htmlFor="plan-duration">Duration</label>
                <select
                  id="plan-duration"
                  value={editing.duration}
                  disabled={busy}
                  onChange={(event) => setEditing({ ...editing, duration: event.target.value })}
                >
                  <option value="day">Days</option>
                  <option value="week">Weeks</option>
                  <option value="month">Months</option>
                  <option value="year">Years</option>
                </select>
              </div>
              <div className="mfield">
                <label htmlFor="plan-duration-value">Duration value *</label>
                <input
                  id="plan-duration-value"
                  type="number"
                  min="1"
                  step="1"
                  value={editing.duration_value}
                  disabled={busy}
                  aria-required="true"
                  onChange={(event) => setEditing({ ...editing, duration_value: event.target.value })}
                />
              </div>
              <div className="mfield">
                <label htmlFor="plan-status">Status</label>
                <select
                  id="plan-status"
                  value={editing.status}
                  disabled={busy}
                  onChange={(event) => setEditing({ ...editing, status: Number(event.target.value) })}
                >
                  <option value={1}>Active</option>
                  <option value={0}>Inactive</option>
                </select>
              </div>
              <div className="mfield span2">
                <label htmlFor="plan-description">Description</label>
                <textarea
                  id="plan-description"
                  rows={3}
                  value={editing.description}
                  disabled={busy}
                  onChange={(event) => setEditing({ ...editing, description: event.target.value })}
                />
              </div>
            </div>
            {error && <div className="error mt-3" role="alert">{error}</div>}
            <div className="modal-actions border-t border-border pt-4">
              <button type="button" className="btn btn-dark" onClick={requestClose} disabled={busy}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busy} aria-disabled={busy}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </div>
  )
}
