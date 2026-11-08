import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion } from 'motion/react'
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

  const ask = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setPending({ ...opts, resolve })),
    [],
  )

  const decide = (value: string) => {
    pending?.resolve(value === 'approve')
    setPending(null)
  }

  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      <AnimatePresence>
        {pending && (
          <motion.div
            className="approval-back"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => decide('deny')}
          >
            <motion.div
              className="w-full max-w-md"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
            >
              <ApprovalCard
                title={pending.title}
                description={pending.description}
                options={[
                  { label: pending.approveLabel ?? 'Approve', value: 'approve' },
                  { label: pending.denyLabel ?? 'Cancel', value: 'deny' },
                ]}
                onDecision={decide}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmCtx.Provider>
  )
}
