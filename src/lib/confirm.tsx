import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ApprovalCard } from '../components/ui/approval-card'

export type ConfirmOptions = {
  title: string
  description?: string
  approveLabel?: string
  denyLabel?: string
}

const ConfirmCtx = createContext<(opts: ConfirmOptions) => Promise<boolean>>(
  async () => false,
)

export const useConfirm = () => useContext(ConfirmCtx)

type Pending = ConfirmOptions & { resolve: (approved: boolean) => void }

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  const ask = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setPending({ ...opts, resolve })),
    [],
  )

  useEffect(() => {
    if (!pending) return
    const dialog = dialogRef.current
    if (!dialog) return
    const previousFocus = document.activeElement as HTMLElement | null
    if (!dialog.open) dialog.showModal()
    // Destructive confirmation starts on Cancel to prevent accidental approval.
    dialog.querySelector<HTMLElement>('[data-confirm-cancel]')?.focus()
    return () => {
      if (dialog.open) dialog.close()
      setTimeout(() => {
        if (previousFocus?.isConnected) previousFocus.focus()
      }, 0)
    }
  }, [pending])

  const decide = (value: string) => {
    if (!pending) return
    pending.resolve(value === 'approve')
    setPending(null)
  }

  const destructive = pending?.approveLabel?.toLowerCase().includes('delete') ?? false

  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      {pending && (
        <dialog
          ref={dialogRef}
          className="modal m-auto max-h-[calc(100dvh-2rem)] w-[min(28rem,calc(100vw-2rem))] max-w-full overflow-y-auto overscroll-contain p-0 [&::backdrop]:bg-[rgba(2,8,18,0.82)]"
          aria-modal="true"
          aria-labelledby="confirmation-title"
          aria-describedby={pending.description ? 'confirmation-description' : undefined}
          onCancel={(event) => {
            // Escape always means cancel for a destructive confirmation.
            event.preventDefault()
            decide('deny')
          }}
          onClick={(event) => {
            if (event.target !== event.currentTarget) return
            const rect = event.currentTarget.getBoundingClientRect()
            const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom
            if (outside) decide('deny')
          }}
        >
          <ApprovalCard
            title={pending.title}
            titleId="confirmation-title"
            description={pending.description}
            descriptionId="confirmation-description"
            options={[
              { label: pending.approveLabel ?? 'Approve', value: 'approve', tone: destructive ? 'destructive' : 'default' },
              { label: pending.denyLabel ?? 'Cancel', value: 'deny' },
            ]}
            onDecision={decide}
          />
        </dialog>
      )}
    </ConfirmCtx.Provider>
  )
}
