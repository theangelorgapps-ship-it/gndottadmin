import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import {
  Bell,
  Blocks,
  Braces,
  Building2,
  CirclePlay,
  Check,
  CircleDollarSign,
  Code2,
  CreditCard,
  Database,
  Languages,
  KeyRound,
  LoaderCircle,
  Mail,
  Palette,
  Save,
  Settings2,
  SlidersHorizontal,
  TestTube2,
  Upload,
  type LucideIcon,
} from 'lucide-react'
import { adminGetSettings, adminSaveSetting, adminUpsertSetting, adminListCurrencies, adminTestNovu } from '../../lib/admin'
import { useToast } from '../../lib/toast'
import { img } from '../../components/Poster'
import { SocialSignIn } from '../../components/SocialSignIn'
import { UploadDialog } from '../../components/UploadDialog'

export const Route = createFileRoute('/admin/settings')({
  validateSearch: (search: Record<string, unknown>) => ({ section: typeof search.section === 'string' && TABS.some(tab => tab.id === search.section) ? search.section : undefined }),
  loader: async () => {
    const [groups, currencies] = await Promise.all([adminGetSettings(), adminListCurrencies()])
    return { groups, currencies }
  },
  component: AdminSettings,
})

type FieldDef = {
  type: string
  name: string
  label: string
  kind?: 'text' | 'toggle' | 'image' | 'textarea' | 'currency'
  placeholder?: string
}
type TabDef = {
  id: string
  label: string
  description: string
  icon: LucideIcon
  fields: FieldDef[]
  note?: string
}

const TABS: TabDef[] = [
  {
    id: 'sign-in', label: 'My Sign-in', description: 'Manage the sign-in methods connected to your administrator account.', icon: KeyRound,
    note: 'Connect Google or Apple to the administrator account you are signed in to. This keeps your existing access and account data.',
    fields: [],
  },
  {
    id: 'business', label: 'Business Settings', description: 'Public identity, contact details, and social links.', icon: Building2,
    fields: [
      { type: 'bussiness', name: 'app_name', label: 'App Name' },
      { type: 'bussiness', label: 'Contact Number', name: 'helpline_number' },
      { type: 'bussiness', name: 'inquriy_email', label: 'Inquiry Email' },
      { type: 'bussiness', name: 'short_description', label: 'Site Description', kind: 'textarea' },
      { type: 'bussiness', name: 'facebook_url', label: 'Facebook URL' },
      { type: 'bussiness', name: 'x_url', label: 'X (Twitter) URL' },
      { type: 'bussiness', name: 'instagram_url', label: 'Instagram URL' },
      { type: 'bussiness', name: 'youtube_url', label: 'YouTube URL' },
    ],
  },
  {
    id: 'custom-code', label: 'Custom Code', description: 'Custom styling and script availability.', icon: Code2,
    note: 'Custom CSS and JavaScript injection are not configured on this deployment.',
    fields: [],
  },
  {
    id: 'module', label: 'Module Settings', description: 'Choose which content and access modules are available.', icon: Blocks,
    fields: [
      { type: 'module_settings', name: 'movie', label: 'Sermons Module', kind: 'toggle' },
      { type: 'module_settings', name: 'tvshow', label: 'Shows Module', kind: 'toggle' },
      { type: 'module_settings', name: 'livetv', label: 'Live TV Module', kind: 'toggle' },
      { type: 'module_settings', name: 'video', label: 'Videos Module', kind: 'toggle' },
      { type: 'module_settings', name: 'demo_login', label: 'Demo Login', kind: 'toggle' },
    ],
  },
  {
    id: 'misc', label: 'Misc Settings', description: 'Playback, localization, storage defaults, and sign-in options.', icon: SlidersHorizontal,
    fields: [
      { type: 'misc', name: 'default_language', label: 'Default Language' },
      { type: 'misc', name: 'default_time_zone', label: 'Default Time Zone' },
      { type: 'misc', name: 'forward_seconds', label: 'Forward Seconds' },
      { type: 'misc', name: 'backward_seconds', label: 'Backward Seconds' },
      { type: 'misc', name: 'disc_type', label: 'Storage Disk' },
      { type: 'appconfig', name: 'is_social_login', label: 'Social Login', kind: 'toggle' },
      { type: 'appconfig', name: 'is_google_login', label: 'Google Login', kind: 'toggle' },
      { type: 'appconfig', name: 'is_apple_login', label: 'Apple Login', kind: 'toggle' },
      { type: 'appconfig', name: 'is_otp_login', label: 'OTP Login', kind: 'toggle' },
      { type: 'appconfig', name: 'google_client_id', label: 'Google Client ID (OAuth Web)' },
    ],
  },
  {
    id: 'customization', label: 'Customization', description: 'Logos and visual identity for GoodNews Halobox.', icon: Palette,
    fields: [
      { type: 'bussiness', name: 'app_name', label: 'Site Name' },
      { type: 'mini_logo', name: 'mini_logo', label: 'Mini Logo', kind: 'image' },
      { type: 'dark_logo', name: 'dark_logo', label: 'Dark Logo', kind: 'image' },
      { type: 'favicon', name: 'favicon', label: 'Favicon', kind: 'image' },
      { type: 'loader_gif', name: 'loader_gif', label: 'Loader GIF', kind: 'image' },
    ],
  },
  {
    id: 'mail', label: 'Mail Settings', description: 'Mail delivery configuration for this deployment.', icon: Mail,
    note: 'Mail delivery is configured through environment variables on this deployment; no database-backed mail settings exist.',
    fields: [],
  },
  {
    id: 'notification', label: 'Notification Settings', description: 'Push notification delivery options.', icon: Bell,
    fields: [
      { type: 'appconfig', name: 'is_firebase_notification', label: 'Firebase Notifications', kind: 'toggle' },
      { type: 'appconfig', name: 'is_user_push_notification', label: 'User Push Notifications', kind: 'toggle' },
    ],
  },
  {
    id: 'payment', label: 'Payment Methods', description: 'Payment providers and their saved credentials.', icon: CreditCard,
    fields: [
      { type: 'razorpayPayment', name: 'razor_payment_method', label: 'Razorpay', kind: 'toggle' },
      { type: 'razor_payment_method', name: 'razorpay_secretkey', label: 'Razorpay Secret Key' },
      { type: 'razor_payment_method', name: 'razorpay_publickey', label: 'Razorpay App Key' },
      { type: 'stripePayment', name: 'str_payment_method', label: 'Stripe', kind: 'toggle' },
      { type: 'str_payment_method', name: 'stripe_secretkey', label: 'Stripe Secret Key' },
      { type: 'str_payment_method', name: 'stripe_publickey', label: 'Stripe App Key' },
      { type: 'paystackPayment', name: 'paystack_payment_method', label: 'Paystack', kind: 'toggle' },
      { type: 'paystack_payment_method', name: 'paystack_secretkey', label: 'Paystack Secret Key' },
      { type: 'paystack_payment_method', name: 'paystack_publickey', label: 'Paystack App Key' },
      { type: 'paypalPayment', name: 'paypal_payment_method', label: 'PayPal', kind: 'toggle' },
      { type: 'paypal_payment_method', name: 'paypal_secretkey', label: 'PayPal Secret Key' },
      { type: 'paypal_payment_method', name: 'paypal_clientid', label: 'PayPal Client ID' },
      { type: 'flutterwavePayment', name: 'flutterwave_payment_method', label: 'Flutterwave', kind: 'toggle' },
      { type: 'flutterwave_payment_method', name: 'flutterwave_secretkey', label: 'Flutterwave Secret Key' },
      { type: 'flutterwave_payment_method', name: 'flutterwave_publickey', label: 'Flutterwave App Key' },
      { type: 'cashpayment', name: 'cash_payment_method', label: 'Cash Payment', kind: 'toggle' },
      { type: 'paymentcinet', name: 'cinet_payment_method', label: 'CinetPay', kind: 'toggle' },
      { type: 'paymentsadad', name: 'sadad_payment_method', label: 'Sadad', kind: 'toggle' },
      { type: 'airtelpayment', name: 'airtel_payment_method', label: 'Airtel Money', kind: 'toggle' },
      { type: 'phonepepayment', name: 'phonepe_payment_method', label: 'PhonePe', kind: 'toggle' },
      { type: 'midtranspayment', name: 'midtrans_payment_method', label: 'Midtrans', kind: 'toggle' },
    ],
  },
  {
    id: 'language', label: 'Language Settings', description: 'Default language for the viewer experience.', icon: Languages,
    fields: [
      { type: 'misc', name: 'default_language', label: 'Default Language' },
    ],
  },
  {
    id: 'notification-config', label: 'Notification Configuration', description: 'Saved Novu credentials and connection testing.', icon: Settings2,
    note: 'Notifications are delivered through Novu. Enter your Novu Secret Key and Application Identifier, save, then test the saved connection.',
    fields: [
      { type: 'appconfig', name: 'novu_api_key', label: 'Novu Secret Key', placeholder: 'Paste your Novu secret key' },
      { type: 'appconfig', name: 'novu_application_id', label: 'Novu Application Identifier' },
      { type: 'appconfig', name: 'novu_backend_url', label: 'Novu Backend URL', placeholder: 'https://api.novu.co' },
    ],
  },
  {
    id: 'currency', label: 'Currency Settings', description: 'Default currency for purchases and plans.', icon: CircleDollarSign,
    fields: [
      { type: 'misc', name: 'default_currency', label: 'Default Currency', kind: 'currency' },
    ],
  },
  {
    id: 'storage', label: 'Storage Settings', description: 'Media storage provider and AWS credentials.', icon: Database,
    fields: [
      { type: 'storage_settings', name: 'local', label: 'Local Storage', kind: 'toggle' },
      { type: 'storage_settings', name: 's3', label: 'Amazon S3', kind: 'toggle' },
      { type: 'storage_settings', name: 'aws_access_key', label: 'AWS Access Key' },
      { type: 'storage_settings', name: 'aws_secret_key', label: 'AWS Secret Key' },
      { type: 'storage_settings', name: 'aws_region', label: 'AWS Region' },
      { type: 'storage_settings', name: 'aws_bucket', label: 'AWS Bucket' },
    ],
  },
  {
    id: 'bunny', label: 'Bunny Stream', description: 'Bunny Stream library and delivery defaults.', icon: CirclePlay,
    note: 'Paste a video ID on any content form to embed it, or upload directly to your Bunny library from the content form.',
    fields: [
      { type: 'bunny', name: 'bunny_library_id', label: 'Bunny Stream Library ID' },
      { type: 'bunny', name: 'bunny_api_key', label: 'Bunny Stream API Key' },
      { type: 'bunny', name: 'bunny_cdn_hostname', label: 'Bunny CDN Hostname', placeholder: 'Optional, for example vz-xxx.b-cdn.net' },
    ],
  },
  {
    id: 'seo', label: 'SEO Settings', description: 'Analytics and discovery tools.', icon: Braces,
    fields: [
      { type: 'text', name: 'google_analytics', label: 'Google Analytics', kind: 'textarea', placeholder: 'G-XXXXXXX measurement ID or the full gtag.js snippet' },
    ],
  },
]

function AdminSettings() {
  const { groups, currencies } = Route.useLoaderData() as {
    groups: Record<string, { id: number; name: string; val: string | null; type: string }[]>
    currencies: { id: number; currency_name: string; currency_code: string; currency_symbol: string; is_primary: number }[]
  }
  const router = useRouter()
  const notify = useToast()
  const { section } = Route.useSearch()
  const [tab, setTab] = useState(section ?? 'business')
  useEffect(() => { if (section) setTab(section) }, [section])
  const [values, setValues] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const lookup = new Map<string, { id: number; val: string | null }>()
  for (const t of Object.keys(groups)) for (const s of groups[t]) lookup.set(`${s.type}.${s.name}`, s)

  const active = TABS.find((t) => t.id === tab)!
  const fieldKey = (f: FieldDef) => `${f.type}.${f.name}`
  const activeDirtyCount = active.fields.filter((field) => values[fieldKey(field)] !== undefined).length
  const dirtyCount = Object.keys(values).length

  function selectTab(id: string) {
    setTab(id)
    setError(null)
  }

  function handleTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % TABS.length
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + TABS.length) % TABS.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = TABS.length - 1
    if (nextIndex === null) return
    event.preventDefault()
    selectTab(TABS[nextIndex].id)
    tabRefs.current[nextIndex]?.focus()
  }

  async function saveAll() {
    setBusy(true)
    setError(null)
    try {
      for (const f of active.fields) {
        const key = fieldKey(f)
        if (values[key] === undefined) continue
        const row = lookup.get(key)
        if (row) await adminSaveSetting({ data: { id: row.id, val: values[key] } })
        else await adminUpsertSetting({ data: { type: f.type, name: f.name, val: values[key] } })
      }
      setValues((current) => {
        const next = { ...current }
        for (const field of active.fields) delete next[fieldKey(field)]
        return next
      })
      notify({ title: 'Settings saved', description: `${active.label} updated.`, variant: 'success' })
      router.invalidate()
    } catch (e: any) {
      const message = e?.message ?? 'Could not save settings.'
      setError(message)
      notify({ title: 'Save failed', description: message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  async function testNovu() {
    setTesting(true)
    setError(null)
    try {
      const res = await adminTestNovu()
      notify({
        title: 'Novu connection OK',
        description: res.workflows !== undefined ? `${res.workflows} workflow(s) found in this app.` : 'Credentials accepted by Novu.',
        variant: 'success',
      })
    } catch (e: any) {
      const message = e?.message ?? 'Could not reach Novu.'
      setError(message)
      notify({ title: 'Novu connection failed', description: message, variant: 'destructive' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="min-w-0">
      <div className="breadcrumb">Dashboard <span className="sep">/</span> <span className="here">Settings</span></div>

      <header className="mb-5 flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-semibold tracking-[0.02em] text-accent">Workspace configuration</p>
          <h1 className="m-0 text-[1.625rem] font-semibold">Settings</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Configure GoodNews Halobox for Sermons, Shows, Teachings, Videos, Personalities, and Locations.
          </p>
        </div>
        <span className="rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground" role="status">
          {dirtyCount === 0 ? 'All changes saved' : `${dirtyCount} unsaved ${dirtyCount === 1 ? 'change' : 'changes'}`}
        </span>
      </header>

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <div
          className="flex min-w-0 gap-2 overflow-x-auto pb-2 lg:sticky lg:top-[5.5rem] lg:flex-col lg:overflow-visible lg:pb-0"
          role="tablist"
          aria-label="Settings sections"
          style={{ overscrollBehaviorX: 'contain', scrollbarWidth: 'thin' }}
        >
          {TABS.map((item, index) => {
            const Icon = item.icon
            const selected = tab === item.id
            return (
              <button
                key={item.id}
                ref={(element) => { tabRefs.current[index] = element }}
                id={`settings-tab-${item.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="settings-active-panel"
                tabIndex={selected ? 0 : -1}
                disabled={busy || testing || uploadingKey !== null}
                onClick={() => selectTab(item.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                className={`flex min-h-11 min-w-[11rem] flex-none items-center gap-2.5 rounded-[10px] border px-3 py-2.5 text-left text-[0.8125rem] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 lg:w-full lg:min-w-0 ${selected ? 'border-[rgba(96,165,250,0.45)] bg-primary/15 text-[#bfdbfe]' : 'border-border bg-card text-muted-foreground hover:border-[#38516f] hover:text-foreground'}`}
              >
                <Icon className="size-4 flex-none" aria-hidden="true" />
                <span className="min-w-0">{item.label}</span>
              </button>
            )
          })}
        </div>

        <section
          key={active.id}
          id="settings-active-panel"
          role="tabpanel"
          aria-labelledby={`settings-tab-${active.id}`}
          aria-busy={busy || testing}
          tabIndex={0}
          className="min-w-0 rounded-[14px] border border-border bg-card"
        >
          <div className="border-b border-border px-4 py-4 sm:px-5">
            <h2 className="m-0 text-base font-semibold">{active.label}</h2>
            <p className="mb-0 mt-1 text-sm text-muted-foreground">{active.description}</p>
          </div>

          <div className="p-4 sm:p-5">
            {active.note && (
              <div className={`mb-5 rounded-[10px] border px-4 py-3 text-sm ${active.fields.length === 0 ? 'border-border bg-background text-muted-foreground' : 'border-[rgba(96,165,250,0.25)] bg-primary/10 text-[#bfdbfe]'}`} role="status">
                {active.note}
              </div>
            )}

            {active.id === 'sign-in' && <SocialSignIn link callbackURL="/admin/settings" />}

            {active.fields.length > 0 && (
              <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
                {active.fields.map((field) => {
                  const key = fieldKey(field)
                  const row = lookup.get(key)
                  const cur = values[key] ?? row?.val ?? ''
                  const inputId = `setting-${key.replace(/[^a-zA-Z0-9_-]/g, '-')}`
                  const helpId = `${inputId}-help`
                  const enabled = (values[key] ?? row?.val) == '1'

                  if (field.kind === 'toggle') {
                    const labelId = `${inputId}-label`
                    return (
                      <button
                        key={key}
                        type="button"
                        role="switch"
                        aria-checked={enabled}
                        aria-labelledby={labelId}
                        disabled={busy}
                        onClick={() => setValues((current) => ({ ...current, [key]: enabled ? '0' : '1' }))}
                        className="flex min-h-[4.5rem] min-w-0 items-center justify-between gap-4 rounded-[10px] border border-border bg-background px-4 py-3 text-left transition-colors hover:border-[#38516f] disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        <span className="min-w-0">
                          <span id={labelId} className="block text-sm font-medium text-foreground">{field.label}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">{enabled ? 'Enabled' : 'Disabled'}</span>
                        </span>
                        <span className={`toggle ${enabled ? 'on' : ''}`} aria-hidden="true" />
                      </button>
                    )
                  }

                  return (
                    <div className={`mfield min-w-0 ${field.kind === 'textarea' || field.kind === 'image' ? 'md:col-span-2' : ''}`} key={key}>
                      <label htmlFor={inputId} className="text-xs font-semibold tracking-[0.02em] text-muted-foreground">
                        {field.label}
                      </label>
                      {field.kind === 'textarea' ? (
                        <textarea
                          id={inputId}
                          name={field.name}
                          rows={4}
                          placeholder={field.placeholder}
                          value={cur}
                          disabled={busy}
                          onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
                        />
                      ) : field.kind === 'currency' ? (
                        <>
                          <select
                            id={inputId}
                            name={field.name}
                            value={cur}
                            disabled={busy}
                            aria-describedby={helpId}
                            onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
                          >
                            <option value="">— Select currency —</option>
                            {currencies.map((currency) => (
                              <option key={currency.id} value={currency.currency_code}>
                                {currency.currency_name} ({currency.currency_symbol ?? currency.currency_code}){currency.is_primary ? ' — current primary' : ''}
                              </option>
                            ))}
                          </select>
                          <p id={helpId} className="m-0 text-xs font-normal text-muted-foreground">Choose from the currencies configured in this workspace.</p>
                        </>
                      ) : field.kind === 'image' ? (
                        <div className="flex min-w-0 flex-col gap-4 rounded-[10px] border border-border bg-background p-3 sm:flex-row sm:items-start">
                          <div className="min-w-0 flex-1">
                            <input
                              id={inputId}
                              name={field.name}
                              type="text"
                              placeholder="Image filename or URL"
                              value={cur}
                              disabled={busy}
                              aria-describedby={helpId}
                              onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
                            />
                            <button
                              type="button"
                              className="btn btn-dark btn-sm mt-2"
                              disabled={busy || uploadingKey !== null}
                              aria-busy={uploadingKey === key}
                              onClick={() => setUploadingKey(key)}
                            >
                              {uploadingKey === key ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}
                              {`Upload ${field.label}`}
                            </button>
                            <p id={helpId} className="mb-0 mt-2 text-xs font-normal text-muted-foreground">Upload an image or enter its existing location, then save this section.</p>
                          </div>
                          {cur ? (
                            <img
                              src={img(cur)}
                              alt={`${field.label} preview`}
                              className="size-28 max-w-full flex-none self-start rounded-[10px] border border-border bg-card object-contain"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex size-28 max-w-full flex-none items-center justify-center rounded-[10px] border border-dashed border-border text-center text-xs font-normal text-muted-foreground">
                              No image selected
                            </div>
                          )}
                        </div>
                      ) : (
                        <input
                          id={inputId}
                          name={field.name}
                          type="text"
                          placeholder={field.placeholder}
                          value={cur}
                          disabled={busy}
                          autoComplete="off"
                          spellCheck={false}
                          onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {error && <div className="error mb-0 mt-4" role="alert">{error}</div>}
          </div>

          {(active.fields.length > 0 || active.id === 'notification-config') && (
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-4 sm:px-5">
              <p className="m-0 text-xs text-muted-foreground">
                {active.id === 'notification-config' ? 'Connection testing uses the last saved Novu settings.' : `Save applies to ${active.label}.`}
              </p>
              <div className="flex flex-wrap gap-2 max-[35rem]:w-full max-[35rem]:[&>button]:flex-1">
                {active.id === 'notification-config' && (
                  <button type="button" className="btn btn-dark" onClick={testNovu} disabled={testing || busy || uploadingKey !== null} aria-busy={testing}>
                    {testing ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <TestTube2 className="size-4" aria-hidden="true" />}
                    {testing ? 'Testing…' : 'Test Novu Connection'}
                  </button>
                )}
                {active.fields.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={saveAll}
                    disabled={busy || activeDirtyCount === 0 || uploadingKey !== null}
                    aria-busy={busy}
                  >
                    {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : activeDirtyCount > 0 ? <Save className="size-4" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
                    {busy ? 'Saving…' : activeDirtyCount > 0 ? `Save ${activeDirtyCount === 1 ? 'Change' : 'Changes'}` : 'Saved'}
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
      <UploadDialog open={uploadingKey !== null} currentValue={uploadingKey ? values[uploadingKey] : null} title="Choose settings image" accept="image/*" onClose={() => setUploadingKey(null)} onUploaded={(url) => { if (uploadingKey) setValues(current => ({ ...current, [uploadingKey]: url })); setUploadingKey(null) }} />
    </div>
  )
}
