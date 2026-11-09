import { createElement } from 'react'
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPendingMs: 120,
    defaultPendingMinMs: 180,
    defaultPendingComponent: () => createElement('div', { role: 'status', className: 'p-6 text-sm text-muted-foreground' }, 'Loading Halobox…'),
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
