import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const base = process.env.ADMIN_LIVE_URL ?? 'https://gndottadmin.theangelorgapps.workers.dev'
const routes = [
  '/admin', '/admin/media-library', '/admin/genres', '/admin/movies', '/admin/tv-shows',
  '/admin/series', '/admin/episodes', '/admin/teaching', '/admin/teaching-volumes',
  '/admin/teaching-episodes', '/admin/videos', '/admin/tv-category', '/admin/live-tv',
  '/admin/actors', '/admin/directors', '/admin/vast-ads', '/admin/custom-ads',
  '/admin/subscriptions', '/admin/plans', '/admin/plan-limits', '/admin/rent-history',
  '/admin/coupons', '/admin/users', '/admin/soon-to-expire', '/admin/banners',
  '/admin/constants', '/admin/notification-templates', '/admin/settings', '/admin/pages',
  '/admin/onboarding', '/admin/tax', '/admin/faq', '/admin/language', '/admin/world',
  '/admin/currency', '/admin/countries', '/admin/access-control', '/admin/user/2',
]
const failures = []
const check = (condition, message) => { if (!condition) failures.push(message) }

const config = readFileSync(join(root, 'wrangler.jsonc'), 'utf8')
check(config.includes('"name": "gndottadmin"'), 'Unexpected Worker name')
check(config.includes('"binding": "DB"'), 'D1 binding DB is missing')
check(config.includes('"database_name": "streamit"'), 'Confirmed D1 database name is missing')
check(config.includes('"database_id": "3bc8aa15-6d59-42be-93df-23397c737c56"'), 'Confirmed D1 database ID changed')
check(config.includes('"binding": "MEDIA"'), 'R2 binding MEDIA is missing')
check(config.includes('"bucket_name": "halobox-migrated-media-20261105"'), 'Confirmed R2 bucket changed')
check(!/["']SESSION_SECRET["']\s*:/.test(config), 'Plaintext SESSION_SECRET must not be committed to Wrangler configuration')

async function request(path) {
  const response = await fetch(new URL(path, base), { redirect: 'manual', signal: AbortSignal.timeout(25000) })
  return { response, text: await response.text() }
}

try {
  const login = await request('/login')
  check(login.response.status === 200, `/login returned ${login.response.status}`)
  check(login.text.includes('GoodNews Halobox'), 'Deployed login does not serve GoodNews Halobox branding')
  check(login.text.includes('Admin workspace'), 'Deployed login does not serve the current admin workspace design')
  check(!/Streamit|Your Ultimate Entertainment Hub/i.test(login.text), 'Deployed login still serves legacy branding')

  for (const route of routes) {
    try {
      const { response, text } = await request(route)
      const location = response.headers.get('location') ?? ''
      const redirectedToLogin = response.status >= 300 && response.status < 400 && /\/login(?:$|[?#])/.test(location)
      const renderedLogin = response.status === 200 && text.includes('Welcome back') && text.includes('GoodNews Halobox')
      check(redirectedToLogin || renderedLogin, `${route} is not protected as expected (status=${response.status}, location=${location || 'none'})`)
      check(response.status !== 500 && !/internal server error|worker threw exception/i.test(text), `${route} returned a server error`)
    } catch (error) {
      failures.push(`${route} request failed: ${error.message}`)
    }
  }
} catch (error) {
  failures.push(`Deployed login request failed: ${error.message}`)
}

if (failures.length > 0) {
  console.error(`DEPLOYED_ADMIN_FAILED ${failures.length} failure(s)`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`DEPLOYED_ADMIN_OK routes=${routes.length}`)
