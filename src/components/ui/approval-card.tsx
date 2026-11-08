'use client'

import { QuestionCircleIcon as CircleHelpIcon } from '@solar-icons/react/linear/question-circle'
import * as React from 'react'
import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from 'cn'

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/80',
        outline:
          'border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground',
        ghost:
          'hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50',
        destructive:
          'bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default:
          'h-8 gap-1.5 px-2.5 pb-0.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 pb-0.5 text-xs in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 pb-0.5 text-[0.8rem] in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: 'h-9 gap-1.5 px-2.5 pb-0.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
        icon: 'size-8',
        'icon-xs':
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-md [&_svg:not([class*='size-'])]:size-3",
        'icon-sm':
          'size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-md',
        'icon-lg': 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

interface ApprovalOption {
  description?: string
  label: string
  value: string
}

interface ApprovalCardProps extends React.ComponentProps<'section'> {
  description?: string
  onDecision?: (value: string) => void
  options?: ApprovalOption[]
  status?: 'approved' | 'denied' | 'pending'
  title: string
}

const defaultOptions: ApprovalOption[] = [
  { label: 'Approve', value: 'approve' },
  { label: 'Deny', value: 'deny' },
]

function ApprovalCard({
  className,
  description,
  onDecision,
  options = defaultOptions,
  status = 'pending',
  title,
  ...props
}: ApprovalCardProps) {
  return (
    <section
      data-slot="approval-card"
      className={cn(
        'rounded-[16px] bg-card p-5 font-sans text-sm font-[450] tracking-[-0.05px] text-muted-foreground shadow-card transition-[opacity,translate] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] starting:translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0',
        className,
      )}
      {...props}
    >
      <div className="flex gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-muted text-muted-foreground">
          <CircleHelpIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="card-heading">{title}</h3>
            {status !== 'pending' && (
              <span className="rounded-full bg-muted px-2 py-1 text-sm font-[450] text-muted-foreground capitalize transition-[opacity,scale] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] starting:scale-95 starting:opacity-0 motion-reduce:starting:scale-100">
                {status}
              </span>
            )}
          </div>
          {description && (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {status === 'pending' && (
        <div
          className={cn(
            'mt-4 gap-2',
            options.some((option) => option.description)
              ? 'grid sm:grid-cols-2'
              : 'flex flex-wrap justify-end',
          )}
        >
          {options.map((option, index) => (
            <Button
              className={cn(
                'border-0 px-3 text-sm font-[450] tracking-[-0.05px] shadow-none',
                option.description
                  ? 'h-auto min-h-9 justify-start rounded-[10px] py-2 text-left whitespace-normal'
                  : 'h-7 rounded-full',
                index === 0 &&
                  'bg-primary bg-linear-to-b from-[color-mix(in_oklch,var(--primary),var(--primary-foreground)_30%)] to-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.18)] hover:brightness-110 dark:bg-none',
                index !== 0 && 'text-muted-foreground hover:text-muted-foreground',
              )}
              key={option.value}
              onClick={() => onDecision?.(option.value)}
              size="sm"
              variant={index === 0 ? 'default' : 'ghost'}
            >
              <span>
                <span className="block">{option.label}</span>
                {option.description && (
                  <span className="mt-0.5 block text-sm font-[450] opacity-70">
                    {option.description}
                  </span>
                )}
              </span>
            </Button>
          ))}
        </div>
      )}
    </section>
  )
}

export { ApprovalCard }
export type { ApprovalOption, ApprovalCardProps }
export default ApprovalCard
