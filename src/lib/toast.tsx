import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (timer) clearTimeout(timer)
    timers.current.delete(id)
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  useEffect(() => () => {
    for (const timer of timers.current.values()) clearTimeout(timer)
    timers.current.clear()
  }, [])

  const notify = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++
      setToasts((current) => [...current.slice(-(MAX_TOASTS - 1)), { id, ...input }])
      const timer = setTimeout(() => dismiss(id), TOAST_TTL_MS)
      timers.current.set(id, timer)
    },
    [dismiss],
  )

  return (
    <ToastCtx.Provider value={notify}>
      {children}
      <div className="toast-host" aria-label="Notifications" aria-relevant="additions text">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <HaloPolishedNotification
              key={toast.id}
              title={toast.title}
              description={toast.description}
              rimVariant={toast.variant ?? 'default'}
              politeness={toast.variant === 'destructive' ? 'alert' : 'status'}
              onDismiss={() => dismiss(toast.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}
