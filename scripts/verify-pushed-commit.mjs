import { execFileSync } from 'node:child_process'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const git = (args) => execFileSync('git', args, {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
}).trim()

try {
  const head = git(['rev-parse', 'HEAD'])
  const status = git(['status', '--porcelain'])
  if (status) throw new Error('The worktree is not clean; commit or remove all intended changes first')

  const remote = git(['ls-remote', 'origin', 'refs/heads/main'])
  const remoteHead = remote.split(/\s+/)[0] ?? ''
  if (!/^[0-9a-f]{40}$/.test(remoteHead)) throw new Error('origin/main did not return a valid commit hash')
  if (head !== remoteHead) throw new Error(`Local HEAD ${head} does not match origin/main ${remoteHead}`)

  console.log('ADMIN_COMMIT_PUSHED')
} catch (error) {
  console.error(`ADMIN_COMMIT_PUSH_FAILED ${error.message}`)
  process.exit(1)
}
