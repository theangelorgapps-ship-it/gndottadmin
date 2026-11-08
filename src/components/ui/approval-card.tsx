'use client'

import { QuestionCircleIcon as CircleHelpIcon } from '@solar-icons/react/linear/question-circle'
import * as React from 'react'
import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cn } from 'cn'

interface ApprovalOption {
  description?: string
  label: string
  value: string
  tone?: 'default' | 'destructive'
}

interface ApprovalCardProps extends React.ComponentProps<'section'> {
  description?: string
  descriptionId?: string
  onDecision?: (value: string) => void
  options?: ApprovalOption[]
  status?: 'approved' | 'denied' | 'pending'
  title: string
  titleId?: string
}

const defaultOptions: ApprovalOption[] = [
  { label: 'Approve', value: 'approve' },
  { label: 'Deny', value: 'deny' },
]

function ApprovalCard({
  className,
  description,
  descriptionId,
  onDecision,
  options = defaultOptions,
  status = 'pending',
  title,
  titleId,
  ...props
}: ApprovalCardProps) {
  const generatedTitleId = React.useId()
  const generatedDescriptionId = React.useId()
  const labelledBy = titleId ?? generatedTitleId
  const describedBy = description ? (descriptionId ?? generatedDescriptionId) : undefined

  return (
    <section
      data-slot="approval-card"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className={cn(
        'w-full rounded-[14px] bg-card p-5 font-sans text-sm text-muted-foreground sm:p-6',
        className,
      )}
      {...props}
    >
      <div className="flex gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-secondary text-accent" aria-hidden="true">
          <CircleHelpIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h2 id={labelledBy} className="card-heading mt-1 text-balance">{title}</h2>
            {status !== 'pending' && (
              <span className="rounded-md bg-secondary px-2 py-1 text-xs font-semibold capitalize text-muted-foreground">
                {status}
              </span>
            )}
          </div>
          {description && (
            <p id={describedBy} className="mt-2 text-pretty text-sm leading-6 text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {status === 'pending' && (
        <div
          className={cn(
            'mt-5 gap-2',
            options.some((option) => option.description)
              ? 'grid sm:grid-cols-2'
              : 'flex flex-col-reverse sm:flex-row sm:flex-wrap sm:justify-end',
          )}
        >
          {options.map((option, index) => (
            <ButtonPrimitive
              data-slot="button"
              data-confirm-cancel={option.value === 'deny' ? true : undefined}
              className={cn(
                'inline-flex min-h-10 shrink-0 items-center justify-center rounded-md border border-transparent px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:pointer-events-none disabled:opacity-50',
                option.description && 'h-auto min-h-11 justify-start py-2 text-left whitespace-normal',
                index === 0 && option.tone === 'destructive' && 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
                index === 0 && option.tone !== 'destructive' && 'bg-primary text-primary-foreground hover:bg-primary/90',
                index !== 0 && 'border-border bg-secondary text-secondary-foreground hover:bg-secondary/80',
              )}
              key={option.value}
              onClick={() => onDecision?.(option.value)}
              type="button"
            >
              <span>
                <span className="block">{option.label}</span>
                {option.description && (
                  <span className="mt-0.5 block text-xs font-normal opacity-80">
                    {option.description}
                  </span>
                )}
              </span>
            </ButtonPrimitive>
          ))}
        </div>
      )}
    </section>
  )
}

export { ApprovalCard }
export type { ApprovalOption, ApprovalCardProps }
export default ApprovalCard
