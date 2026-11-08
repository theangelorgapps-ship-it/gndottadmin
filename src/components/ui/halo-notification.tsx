'use client'

import {
  forwardRef,
  useId,
  type ComponentProps,
} from 'react'
import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { AlertCircle, CheckCircle2, Info, XIcon } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

export type RimVariant = 'default' | 'success' | 'destructive'

export interface HaloPolishedToastSurfaceProps {
  title: string
  description?: string
  messageKey?: string
  /** `status` for non-urgent updates; `alert` for urgent/interruptive content. */
  politeness?: 'status' | 'alert'
  onDismiss?: () => void
  translucent?: boolean
  rimVariant?: RimVariant
  className?: string
}

const APPEARANCE = {
  default: { icon: Info, token: '--info', label: 'Information' },
  success: { icon: CheckCircle2, token: '--success', label: 'Success' },
  destructive: { icon: AlertCircle, token: '--danger', label: 'Error' },
} as const

export function HaloPolishedToastSurface({
  title,
  description,
  messageKey: messageKeyProp,
  politeness = 'status',
  onDismiss,
  translucent = true,
  rimVariant = 'default',
  className,
}: HaloPolishedToastSurfaceProps) {
  const titleId = useId()
  const descriptionId = useId()
  const messageKey = messageKeyProp ?? `${title}\0${description ?? ''}`
  const appearance = APPEARANCE[rimVariant]
  const Icon = appearance.icon
  const ariaLive = politeness === 'alert' ? 'assertive' : 'polite'

  return (
    <div
      aria-live={ariaLive}
      aria-atomic="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={cn('w-full', className)}
      role={politeness === 'alert' ? 'alert' : 'status'}
    >
      <div
        className={cn(
          'relative w-full max-w-full rounded-[14px] border bg-card p-4 text-left',
          translucent && 'backdrop-blur-sm',
        )}
        data-slot="notification-halo-card"
        key={messageKey}
        role="group"
        aria-label={`${appearance.label} notification`}
        style={{
          borderColor: `color-mix(in srgb, var(${appearance.token}) 34%, var(--border))`,
          backgroundColor: `color-mix(in srgb, var(${appearance.token}) 7%, var(--card) ${translucent ? '96%' : '100%'})`,
        }}
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0" style={{ color: `var(${appearance.token})` }} aria-hidden="true">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p id={titleId} className="text-pretty text-sm font-semibold leading-snug text-foreground">{title}</p>
            {description ? (
              <p id={descriptionId} className="mt-1 text-pretty text-sm leading-relaxed text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {onDismiss ? (
            <ButtonPrimitive
              aria-label="Dismiss notification"
              className="-mr-1 -mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              onClick={onDismiss}
              type="button"
            >
              <XIcon aria-hidden="true" className="size-4" />
            </ButtonPrimitive>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export interface HaloPolishedNotificationProps
  extends HaloPolishedToastSurfaceProps,
    Omit<ComponentProps<typeof motion.div>, 'children' | 'title'> {
  slideFrom?: 'top' | 'bottom'
}

export const HaloPolishedNotification = forwardRef<
  HTMLDivElement,
  HaloPolishedNotificationProps
>(function HaloPolishedNotification(
  {
    title,
    description,
    messageKey,
    politeness,
    onDismiss,
    slideFrom = 'bottom',
    translucent,
    rimVariant,
    className,
    ...motionProps
  },
  ref,
) {
  const reduceMotion = useReducedMotion() ?? false
  const travelY = reduceMotion ? 0 : slideFrom === 'top' ? -12 : 12
  const { animate, exit, initial, transition, ...restMotionProps } = motionProps

  return (
    <motion.div
      animate={animate ?? { opacity: 1, y: 0 }}
      exit={exit ?? { opacity: 0, y: travelY }}
      initial={initial ?? { opacity: 0, y: travelY }}
      ref={ref}
      transition={transition ?? { duration: reduceMotion ? 0.01 : 0.18, ease: 'easeOut' }}
      {...restMotionProps}
    >
      <HaloPolishedToastSurface
        className={className}
        description={description}
        messageKey={messageKey}
        onDismiss={onDismiss}
        politeness={politeness}
        rimVariant={rimVariant}
        title={title}
        translucent={translucent}
      />
    </motion.div>
  )
})

HaloPolishedNotification.displayName = 'HaloPolishedNotification'

export default HaloPolishedNotification
