// Public RPC surface for the media ingest pipeline. Client code imports these
// server functions; the D1/Bunny implementation lives in media-ingest.server.ts
// and is dynamic-imported so it never enters the client bundle (the
// import-protection plugin blocks client imports of *.server.* modules).
import { createServerFn } from '@tanstack/react-start'
import type { IngestInput } from './media-ingest-core'

export const ingestDropboxLink = createServerFn({ method: 'POST' })
  .validator((input: IngestInput) => input)
  .handler(async ({ data }) => (await import('./media-ingest.server')).ingestDropbox(data))

export const listIngestJobs = createServerFn({ method: 'GET' })
  .handler(async () => (await import('./media-ingest.server')).listJobsResponse())

export const refreshIngestJobs = createServerFn({ method: 'POST' })
  .handler(async () => (await import('./media-ingest.server')).refreshJobsResponse())

export const cancelIngestJob = createServerFn({ method: 'POST' })
  .validator((id: number) => id)
  .handler(async ({ data }) => (await import('./media-ingest.server')).cancelJob(Number(data)))

export const retryIngestJob = createServerFn({ method: 'POST' })
  .validator((id: number) => id)
  .handler(async ({ data }) => (await import('./media-ingest.server')).retryJob(Number(data)))

export const ingestFormOptions = createServerFn({ method: 'GET' })
  .handler(async () => (await import('./media-ingest.server')).formOptionsResponse())
