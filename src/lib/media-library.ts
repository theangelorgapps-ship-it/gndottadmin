import { createServerFn } from '@tanstack/react-start'
import type { MediaFilters } from './media-library-core'

// Client imports only these RPC boundaries. Storage, database, authorization,
// and validation stay in the server implementation and run on every request.
export const listMediaLibrary = createServerFn({ method: 'GET' })
  .validator((data?: MediaFilters) => data)
  .handler(async ({ data }) => (await import('./media-library.server')).listMediaLibrary(data))

export const discoverMediaBatch = createServerFn({ method: 'POST' })
  .validator((data?: { restart?: boolean }) => data)
  .handler(async ({ data }) => (await import('./media-library.server')).discoverMediaBatch(data))

export const claimMediaOcr = createServerFn({ method: 'POST' })
  .validator((data?: { retryErrors?: boolean }) => data)
  .handler(async ({ data }) => (await import('./media-library.server')).claimMediaOcr(data))

export const completeMediaOcr = createServerFn({ method: 'POST' })
  .validator((data: { key: string; etag: string; lease: string; text?: string; confidence?: number; error?: string }) => data)
  .handler(async ({ data }) => (await import('./media-library.server')).completeMediaOcr(data))

export const deleteLibraryMedia = createServerFn({ method: 'POST' })
  .validator((data: { key: string; etag: string }) => data)
  .handler(async ({ data }) => (await import('./media-library.server')).deleteLibraryMedia(data))

export const releaseMediaOcr = createServerFn({ method: 'POST' })
  .validator((data: { key: string; lease: string }[]) => data)
  .handler(async ({ data }) => (await import('./media-library.server')).releaseMediaOcr(data))
