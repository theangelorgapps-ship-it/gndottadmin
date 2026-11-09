// Public RPC surface for bulk upload. Client code imports these server functions;
// the D1/Bunny implementation lives in bulk-import.server.ts and is dynamic-imported
// so it never enters the client bundle.
import { createServerFn } from '@tanstack/react-start'
import type { BulkRow } from './bulk-import-core'

export const bulkImportContext = createServerFn({ method: 'GET' })
  .handler(async () => (await import('./bulk-import.server')).importContext())

export const bulkImportRows = createServerFn({ method: 'POST' })
  .validator((payload: { rows: BulkRow[] }) => payload)
  .handler(async ({ data }) => (await import('./bulk-import.server')).importRows(data))
