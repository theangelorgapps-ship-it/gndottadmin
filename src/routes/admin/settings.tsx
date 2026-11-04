import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { adminGetSettings, adminSaveSetting } from '../../lib/admin'
import { img } from '../../components/Poster'

export const Route = createFileRoute('/admin/settings')({
  loader: async () => await adminGetSettings(),
  component: AdminSettings,
})

type FieldDef = { type: string; name: string; label: string; kind?: 'text' | 'toggle' | 'image' | 'textarea' }
type TabDef = { id: string; label: string; icon: string; fields: FieldDef[]; note?: string }

const TABS: TabDef[] = [
  {
    id: 'business', label: 'Business Settings', icon: 'M3 21V5a2 2 0 0 1 2-2h9l7 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    fields: [
      { type: 'bussiness', name: 'app_name', label: 'App' },
      { type: 'bussiness', label: 'Contact No', name: 'helpline_number' },
      { type: 'bussiness', name: 'inquriy_email', label: 'Inquiry Email' },
      { type: 'bussiness', name: 'short_description', label: 'Site Description', kind: 'textarea' },
      { type: 'bussiness', name: 'facebook_url', label: 'Facebook URL' },
      { type: 'bussiness', name: 'x_url', label: 'X (Twitter) URL' },
      { type: 'bussiness', name: 'instagram_url', label: 'Instagram URL' },
      { type: 'bussiness', name: 'youtube_url', label: 'YouTube URL' },
    ],
  },
  {
    id: 'custom-code', label: 'Custom Code', icon: 'M8 6l-6 6 6 6M16 6l6 6-6 6',
    note: 'Custom CSS/JS injection is not configured on this deployment.',
    fields: [],
  },
  {
    id: 'module', label: 'Module Settings', icon: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
    fields: [
      { type: 'module_settings', name: 'movie', label: 'Movie Module', kind: 'toggle' },
      { type: 'module_settings', name: 'tvshow', label: 'TV Show Module', kind: 'toggle' },
      { type: 'module_settings', name: 'livetv', label: 'Live TV Module', kind: 'toggle' },
      { type: 'module_settings', name: 'video', label: 'Video Module', kind: 'toggle' },
      { type: 'module_settings', name: 'demo_login', label: 'Demo Login', kind: 'toggle' },
      { type: 'module_settings', name: 'enable_tmdb_api', label: 'TMDB API', kind: 'toggle' },
      { type: 'module_settings', name: 'tmdb_api_key', label: 'TMDB API Key' },
    ],
  },
  {
    id: 'misc', label: 'Misc Settings', icon: 'M12 8v4l3 3M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z',
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
    ],
  },
  {
    id: 'customization', label: 'Customization', icon: 'M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 3 1.5-7.5L2 9h7z',
    fields: [
      { type: 'mini_logo', name: 'mini_logo', label: 'Mini Logo', kind: 'image' },
      { type: 'dark_logo', name: 'dark_logo', label: 'Dark Logo', kind: 'image' },
      { type: 'favicon', name: 'favicon', label: 'Favicon', kind: 'image' },
      { type: 'loader_gif', name: 'loader_gif', label: 'Loader GIF', kind: 'image' },
    ],
  },
  {
    id: 'mail', label: 'Mail Settings', icon: 'M4 4h16v16H4zM4 6l8 7 8-7',
    note: 'Mail delivery is configured via environment variables on this deployment; no database-backed mail settings exist.',
    fields: [],
  },
  {
    id: 'notification', label: 'Notification Settings', icon: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M10 21a2 2 0 0 0 4 0',
    fields: [
      { type: 'appconfig', name: 'is_firebase_notification', label: 'Firebase Notifications', kind: 'toggle' },
      { type: 'appconfig', name: 'is_user_push_notification', label: 'User Push Notifications', kind: 'toggle' },
    ],
  },
  {
    id: 'payment', label: 'Payment Method', icon: 'M3 6h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm1 4v2h6v-2z',
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
      { type: 'paypalPayment', name: 'paypal_payment_method', label: 'Paypal', kind: 'toggle' },
      { type: 'paypal_payment_method', name: 'paypal_secretkey', label: 'Paypal Secret Key' },
      { type: 'paypal_payment_method', name: 'paypal_clientid', label: 'Paypal Client Id' },
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
    id: 'language', label: 'Language Settings', icon: 'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20zM2 12h20M12 2c3 3.5 3 16.5 0 20-3-3.5-3-16.5 0-20z',
    fields: [
      { type: 'misc', name: 'default_language', label: 'Default Language' },
    ],
  },
  {
    id: 'notification-config', label: 'Notification Configuration', icon: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M12 2v2',
    fields: [
      { type: 'appconfig', name: 'firebase_key', label: 'Firebase Key' },
      { type: 'appconfig', name: 'projectId', label: 'Firebase Project ID' },
      { type: 'appconfig', name: 'apiKey', label: 'Firebase API Key' },
      { type: 'appconfig', name: 'messagingSenderId', label: 'Messaging Sender ID' },
      { type: 'appconfig', name: 'appId', label: 'Firebase App ID' },
    ],
  },
  {
    id: 'currency', label: 'Currency Settings', icon: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
    note: 'No currency settings are stored in the database for this deployment.',
    fields: [],
  },
  {
    id: 'storage', label: 'Storage Settings', icon: 'M4 7c0-2 3.6-3 8-3s8 1 8 3-3.6 3-8 3-8-1-8-3zm0 5c0 2 3.6 3 8 3s8-1 8-3M4 17c0 2 3.6 3 8 3s8-1 8-3M4 7v10M20 7v10',
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
    id: 'seo', label: 'SEO Settings', icon: 'M11 4a7 7 0 1 0 4.9 12L21 21l-1.4 1.4L14.5 17.4A7 7 0 0 0 11 4z',
    fields: [
      { type: 'text', name: 'google_analytics', label: 'Google Analytics', kind: 'textarea' },
    ],
  },
]

function AdminSettings() {
  const groups = Route.useLoaderData() as Record<string, { id: number; name: string; val: string | null; type: string }[]>
  const router = useRouter()
  const [tab, setTab] = useState('business')
  const [values, setValues] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lookup = new Map<string, { id: number; val: string | null }>()
  for (const t of Object.keys(groups)) for (const s of groups[t]) lookup.set(`${s.type}.${s.name}`, s)

  const active = TABS.find((t) => t.id === tab)!

  async function saveAll() {
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      for (const f of active.fields) {
        const row = lookup.get(`${f.type}.${f.name}`)
        if (row && values[row.id] !== undefined) {
          await adminSaveSetting({ data: { id: row.id, val: values[row.id] } })
        }
      }
      setValues({})
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      router.invalidate()
    } catch (e: any) {
      setError(e?.message ?? 'Save failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="breadcrumb">Dashboard <span className="sep">/</span> <span className="here">Settings</span></div>
      <div className="settings-shell">
        <div className="settings-tabs">
          {TABS.map((t) => (
            <button key={t.id} className={`settings-tab ${tab === t.id ? 'active' : ''}`} onClick={() => { setTab(t.id); setSaved(false); setError(null) }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={t.icon} /></svg>
              {t.label}
            </button>
          ))}
        </div>
        <div className="settings-panel">
          <h3>{active.label}</h3>
          {active.note && <div className="empty" style={{ padding: 18 }}>{active.note}</div>}
          <div className="settings-grid">
            {active.fields.map((f) => {
              const row = lookup.get(`${f.type}.${f.name}`)
              if (!row) return null
              const cur = values[row.id] ?? row.val ?? ''
              if (f.kind === 'toggle') {
                return (
                  <div className="set-toggle-row" key={`${f.type}.${f.name}`}>
                    <span>{f.label}</span>
                    <button
                      className={`toggle ${(values[row.id] ?? row.val) == '1' ? 'on' : ''}`}
                      onClick={() => setValues({ ...values, [row.id]: (values[row.id] ?? row.val) == '1' ? '0' : '1' })}
                    />
                  </div>
                )
              }
              return (
                <label className={`mfield ${f.kind === 'textarea' ? 'span2' : ''}`} key={`${f.type}.${f.name}`}>
                  <span>{f.label}</span>
                  {f.kind === 'textarea' ? (
                    <textarea rows={3} value={cur} onChange={(e) => setValues({ ...values, [row.id]: e.target.value })} />
                  ) : f.kind === 'image' ? (
                    <span className="img-field">
                      <input type="text" value={cur} onChange={(e) => setValues({ ...values, [row.id]: e.target.value })} />
                      {cur ? <img src={img(cur)} alt="" className="img-preview" /> : null}
                    </span>
                  ) : (
                    <input type="text" value={cur} onChange={(e) => setValues({ ...values, [row.id]: e.target.value })} />
                  )}
                </label>
              )
            })}
          </div>
          {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
          {active.fields.length > 0 && (
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={saveAll} disabled={busy || Object.keys(values).length === 0}>
                {busy ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
