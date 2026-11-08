import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AnimatePresence } from 'motion/react'
import {
  HaloPolishedNotification,
  type RimVariant,
} from '../components/ui/halo-notification'

export type ToastInput = {
  title: string
  description?: string
  variant?: RimVariant
}

type Toast = ToastInput & { id: number }

const ToastCtx = createContext<(t: ToastInput) => void>(() => {})

export const useToast = () => useContext(ToastCtx)

const TOAST_TTL_MS = 5200
const MAX_TOASTS = 4

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id))
  }, [])

  const notify = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++
      setToasts((ts) => [...ts.slice(-(MAX_TOASTS - 1)), { id, ...input }])
      setTimeout(() => dismiss(id), TOAST_TTL_MS)
    },
    [dismiss],
  )

  return (
    <ToastCtx.Provider value={notify}>
      {children}
      <div className="toast-host">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <HaloPolishedNotification
              key={t.id}
              title={t.title}
              description={t.description}
              rimVariant={t.variant ?? 'default'}
              politeness={t.variant === 'destructive' ? 'alert' : 'status'}
              onDismiss={() => dismiss(t.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}
