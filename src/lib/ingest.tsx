import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  ingestDropboxLink,
  refreshIngestJobs as refreshIngestJobsFn,
  cancelIngestJob as cancelIngestJobFn,
  retryIngestJob as retryIngestJobFn,
} from './media-ingest'
import type { IngestInput, IngestJob } from './media-ingest-core'

export type IngestContextValue = {
  /** False until the first refresh round-trip finishes. */
  loaded: boolean
  configured: boolean
  libraryId: string | null
  jobs: IngestJob[]
  ingest(input: IngestInput): Promise<IngestJob>
  cancel(id: number): Promise<void>
  retry(id: number): Promise<IngestJob>
  refresh(): Promise<void>
}

const IngestCtx = createContext<IngestContextValue | null>(null)

/** Reads ingest state; null outside IngestProvider (e.g. moderator shell). */
export const useIngest = () => useContext(IngestCtx)

export const INGEST_POLL_MS = 4000

/** Human-readable stage line shared by the floating widget and the jobs page. */
export function ingestStatusLabel(job: IngestJob): string {
  if (job.phase === 'fetching') return 'Fetching from Dropbox…'
  if (job.phase === 'transcoding') return 'Transcoding on Bunny Stream…'
  if (job.phase === 'complete') return 'Complete'
  if (job.phase === 'failed') return job.error ?? 'Ingest failed.'
  return 'Cancelled'
}

/** Test seam: gates shrink the poll interval via window.__INGEST_POLL_MS__. */
const pollInterval = () => (typeof window !== 'undefined' && (window as any).__INGEST_POLL_MS__) || INGEST_POLL_MS

type JobsResponse = { configured: boolean; libraryId: string | null; jobs: IngestJob[] }

/**
 * Single poller for the media ingest pipeline. Mounted once in the admin shell;
 * the floating widget and the Media Ingest page both read from it, so Bunny is
 * polled once per interval no matter how many surfaces are open.
 */
export function IngestProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ loaded: boolean; configured: boolean; libraryId: string | null; jobs: IngestJob[] }>({
    loaded: false,
    configured: true,
    libraryId: null,
    jobs: [],
  })
  const inFlight = useRef(false)

  const apply = useCallback((res: JobsResponse) => {
    setState({ loaded: true, configured: res.configured, libraryId: res.libraryId, jobs: res.jobs })
  }, [])

  const refresh = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      apply(await refreshIngestJobsFn())
    } catch {
      // A failed poll must not kill the loop; the next interval retries.
    } finally {
      inFlight.current = false
    }
  }, [apply])

  useEffect(() => {
    void refresh()
    const timer = setInterval(() => void refresh(), pollInterval())
    return () => clearInterval(timer)
  }, [refresh])

  const ingest = useCallback(async (input: IngestInput) => {
    const job = await ingestDropboxLink({ data: input })
    await refresh()
    return job
  }, [refresh])

  const cancel = useCallback(async (id: number) => {
    await cancelIngestJobFn({ data: id })
    await refresh()
  }, [refresh])

  const retry = useCallback(async (id: number) => {
    const job = await retryIngestJobFn({ data: id })
    await refresh()
    return job
  }, [refresh])

  return (
    <IngestCtx.Provider value={{ ...state, ingest, cancel, retry, refresh }}>
      {children}
    </IngestCtx.Provider>
  )
}
