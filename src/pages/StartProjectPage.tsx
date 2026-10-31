import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/SiteLayout'
import { Alert, Field, describedBy } from '../components/Field'
import { api, ApiFailure } from '../lib/api'
import {
  BUDGET_LABELS, BUDGET_RANGES, DEADLINE_LABELS, DEADLINE_PREFERENCES, SERVICE_LABELS, SERVICE_TYPES, inquirySchema,
} from '../../shared/domain'

type FormState = {
  name: string; contactMethod: 'email' | 'whatsapp'; contactValue: string; serviceType: (typeof SERVICE_TYPES)[number]
  title: string; objective: string; description: string; intendedUse: string; desiredFormat: string
  deadlinePreference: (typeof DEADLINE_PREFERENCES)[number]; deadlineDate: string; brandUrl: string; referenceLinks: string
  budgetRange: (typeof BUDGET_RANGES)[number]; consent: boolean; rightsConfirmed: boolean; website: string
}

export function StartProjectPage() {
  const [params] = useSearchParams()
  const preset = params.get('service')
  const startedAt = useRef(Date.now())
  const idemKey = useRef(crypto.randomUUID())
  const [showMore, setShowMore] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [reference, setReference] = useState<string | null>(null)
  const [f, setF] = useState<FormState>({
    name: '', contactMethod: 'email', contactValue: '',
    serviceType: preset === 'video' || preset === 'image' ? preset : 'image',
    title: '', objective: '', description: '', intendedUse: '', desiredFormat: '',
    deadlinePreference: 'flexible', deadlineDate: '', brandUrl: '', referenceLinks: '',
    budgetRange: 'undisclosed', consent: false, rightsConfirmed: false, website: '',
  })
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }))
  const minDate = useMemo(() => new Date().toISOString().slice(0, 10), [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setServerError(null)
    const payload = {
      ...f,
      referenceLinks: f.referenceLinks.split(/\s+/).map((s) => s.trim()).filter(Boolean),
      deadlineDate: f.deadlinePreference === 'specific_date' ? f.deadlineDate : '',
      formStartedAt: startedAt.current,
    }
    const parsed = inquirySchema.safeParse(payload)
    if (!parsed.success) {
      const errs: Record<string, string> = {}
      for (const i of parsed.error.issues) {
        const k = String(i.path[0] ?? '_')
        if (!errs[k]) errs[k] = i.message
      }
      setErrors(errs)
      if (errs.brandUrl || errs.referenceLinks || errs.budgetRange) setShowMore(true)
      requestAnimationFrame(() => document.querySelector<HTMLElement>('.has-error input, .has-error textarea, .has-error select')?.focus())
      return
    }
    setErrors({})
    setSubmitting(true)
    try {
      const res = await api<{ reference: string }>('/inquiries', { method: 'POST', json: payload, headers: { 'idempotency-key': idemKey.current } })
      setReference(res.reference)
      window.scrollTo(0, 0)
    } catch (err) {
      if (err instanceof ApiFailure && err.body.details?.fields) setErrors(err.body.details.fields)
      setServerError(err instanceof ApiFailure ? err.body.message : 'Terjadi kesalahan. Coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  if (reference) {
    return (
      <>
        <PageHeader eyebrow="Brief terkirim" title="Terima kasih." />
        <section className="section">
          <div className="container narrow">
            <div className="success-card" role="status">
              <p className="small muted">Nomor referensi proyek Anda</p>
              <p className="reference">{reference}</p>
              <p>Simpan nomor ini. Brief Anda sudah kami terima dan akan ditinjau oleh tim. Kami akan menghubungi Anda melalui kanal kontak yang Anda pilih.</p>
              <p className="small muted">Mengirim brief belum berarti proyek diterima. Lingkup, waktu dan harga dikirim terpisah setelah peninjauan. Saat ini belum ada notifikasi otomatis.</p>
              <Link to="/" className="btn btn-ghost">Kembali ke beranda</Link>
            </div>
          </div>
        </section>
      </>
    )
  }

  const err = (k: string) => errors[k]
  return (
    <>
      <PageHeader eyebrow="Mulai Proyek" title="Ceritakan kebutuhan Anda" intro="Sekitar 5 menit. Kami meninjau setiap brief secara manual lalu mengirim lingkup dan penawaran." />
      <section className="section">
        <div className="container narrow">
          <form className="inquiry-form" id="inquiry-form" onSubmit={onSubmit} noValidate>
            {serverError && <Alert kind="error">{serverError}</Alert>}

            <fieldset>
              <legend className="h4">1. Kontak</legend>
              <Field id="name" label="Nama" required error={err('name')}>
                <input id="name" autoComplete="name" value={f.name} onChange={(e) => set('name', e.target.value)} aria-invalid={!!err('name')} aria-describedby={describedBy('name', undefined, err('name'))} maxLength={120} />
              </Field>
              <div className="grid-2">
                <Field id="contactMethod" label="Kanal kontak" required>
                  <select id="contactMethod" value={f.contactMethod} onChange={(e) => set('contactMethod', e.target.value as FormState['contactMethod'])}>
                    <option value="email">Email</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </Field>
                <Field id="contactValue" label={f.contactMethod === 'email' ? 'Alamat email' : 'Nomor WhatsApp'} required error={err('contactValue')}>
                  <input id="contactValue" type={f.contactMethod === 'email' ? 'email' : 'tel'} autoComplete={f.contactMethod === 'email' ? 'email' : 'tel'} value={f.contactValue} onChange={(e) => set('contactValue', e.target.value)} aria-invalid={!!err('contactValue')} aria-describedby={describedBy('contactValue', undefined, err('contactValue'))} placeholder={f.contactMethod === 'email' ? 'nama@perusahaan.com' : '+62 812 3456 7890'} maxLength={160} />
                </Field>
              </div>
            </fieldset>

            <fieldset>
              <legend className="h4">2. Proyek</legend>
              <Field id="serviceType" label="Layanan" required>
                <div className="segmented" role="radiogroup" aria-label="Layanan">
                  {SERVICE_TYPES.map((t) => (
                    <label key={t} className={f.serviceType === t ? 'is-selected' : ''}>
                      <input type="radio" name="serviceType" value={t} checked={f.serviceType === t} onChange={() => set('serviceType', t)} />
                      {SERVICE_LABELS[t]}
                    </label>
                  ))}
                </div>
              </Field>
              <Field id="title" label="Judul proyek singkat" required error={err('title')} hint="Contoh: Visual peluncuran produk skincare">
                <input id="title" value={f.title} onChange={(e) => set('title', e.target.value)} aria-invalid={!!err('title')} aria-describedby={describedBy('title', 'x', err('title'))} maxLength={140} />
              </Field>
              <Field id="objective" label="Tujuan proyek" required error={err('objective')} hint="Apa yang ingin dicapai, dan untuk audiens siapa?">
                <textarea id="objective" rows={3} value={f.objective} onChange={(e) => set('objective', e.target.value)} aria-invalid={!!err('objective')} aria-describedby={describedBy('objective', 'x', err('objective'))} maxLength={1000} />
              </Field>
              <Field id="description" label="Deskripsi singkat" required error={err('description')} hint="Produk/brand, gaya visual yang diinginkan, klaim wajib dan hal yang harus dihindari.">
                <textarea id="description" rows={5} value={f.description} onChange={(e) => set('description', e.target.value)} aria-invalid={!!err('description')} aria-describedby={describedBy('description', 'x', err('description'))} maxLength={4000} />
              </Field>
              <div className="grid-2">
                <Field id="intendedUse" label="Platform / penggunaan" required error={err('intendedUse')} hint="Mis. Instagram feed, marketplace, iklan">
                  <input id="intendedUse" value={f.intendedUse} onChange={(e) => set('intendedUse', e.target.value)} aria-invalid={!!err('intendedUse')} aria-describedby={describedBy('intendedUse', 'x', err('intendedUse'))} maxLength={300} />
                </Field>
                <Field id="desiredFormat" label="Format yang diinginkan" required error={err('desiredFormat')} hint="Mis. 5 gambar 4:5, 1 video 15 detik 9:16">
                  <input id="desiredFormat" value={f.desiredFormat} onChange={(e) => set('desiredFormat', e.target.value)} aria-invalid={!!err('desiredFormat')} aria-describedby={describedBy('desiredFormat', 'x', err('desiredFormat'))} maxLength={300} />
                </Field>
              </div>
              <div className="grid-2">
                <Field id="deadlinePreference" label="Preferensi tenggat" required>
                  <select id="deadlinePreference" value={f.deadlinePreference} onChange={(e) => set('deadlinePreference', e.target.value as FormState['deadlinePreference'])}>
                    {DEADLINE_PREFERENCES.map((d) => <option key={d} value={d}>{DEADLINE_LABELS[d]}</option>)}
                  </select>
                </Field>
                {f.deadlinePreference === 'specific_date' && (
                  <Field id="deadlineDate" label="Tanggal" required error={err('deadlineDate')}>
                    <input id="deadlineDate" type="date" min={minDate} value={f.deadlineDate} onChange={(e) => set('deadlineDate', e.target.value)} aria-invalid={!!err('deadlineDate')} />
                  </Field>
                )}
              </div>
            </fieldset>

            <button type="button" className="disclosure" aria-expanded={showMore} aria-controls="optional-fields" onClick={() => setShowMore((v) => !v)}>
              {showMore ? '− Sembunyikan detail tambahan' : '+ Tambahkan referensi & anggaran (opsional)'}
            </button>
            {showMore && (
              <fieldset id="optional-fields">
                <legend className="h4">3. Detail tambahan</legend>
                <Field id="brandUrl" label="URL brand / produk" error={err('brandUrl')}>
                  <input id="brandUrl" type="url" inputMode="url" value={f.brandUrl} onChange={(e) => set('brandUrl', e.target.value)} placeholder="https://" aria-invalid={!!err('brandUrl')} />
                </Field>
                <Field id="referenceLinks" label="Tautan referensi visual" error={err('referenceLinks')} hint="Maksimal 5 tautan, pisahkan dengan baris baru.">
                  <textarea id="referenceLinks" rows={3} value={f.referenceLinks} onChange={(e) => set('referenceLinks', e.target.value)} aria-invalid={!!err('referenceLinks')} aria-describedby={describedBy('referenceLinks', 'x', err('referenceLinks'))} />
                </Field>
                <Field id="budgetRange" label="Rentang anggaran">
                  <select id="budgetRange" value={f.budgetRange} onChange={(e) => set('budgetRange', e.target.value as FormState['budgetRange'])}>
                    {BUDGET_RANGES.map((b) => <option key={b} value={b}>{BUDGET_LABELS[b]}</option>)}
                  </select>
                </Field>
                <p className="hint">Unggah file belum tersedia di tahap ini. Jika perlu, kami akan meminta aset melalui kanal privat setelah peninjauan.</p>
              </fieldset>
            )}

            {/* Honeypot: hidden from humans and assistive tech */}
            <div className="hp" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input id="website" tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => set('website', e.target.value)} />
            </div>

            <fieldset>
              <legend className="h4">Persetujuan</legend>
              <div className={`check ${err('consent') ? 'has-error' : ''}`}>
                <input id="consent" type="checkbox" checked={f.consent} onChange={(e) => set('consent', e.target.checked)} aria-invalid={!!err('consent')} aria-describedby={err('consent') ? 'consent-error' : undefined} />
                <label htmlFor="consent">Saya setuju AVORLUNE memproses informasi ini untuk meninjau dan menindaklanjuti proyek, sesuai <Link to="/privacy" target="_blank">Kebijakan Privasi</Link>. *</label>
              </div>
              {err('consent') && <p className="error-text" id="consent-error" role="alert">{err('consent')}</p>}
              <div className={`check ${err('rightsConfirmed') ? 'has-error' : ''}`}>
                <input id="rightsConfirmed" type="checkbox" checked={f.rightsConfirmed} onChange={(e) => set('rightsConfirmed', e.target.checked)} aria-invalid={!!err('rightsConfirmed')} aria-describedby={err('rightsConfirmed') ? 'rights-error' : undefined} />
                <label htmlFor="rightsConfirmed">Saya memiliki hak atas materi, logo dan referensi yang saya kirimkan. *</label>
              </div>
              {err('rightsConfirmed') && <p className="error-text" id="rights-error" role="alert">{err('rightsConfirmed')}</p>}
            </fieldset>

            <button type="submit" className="btn btn-primary btn-block" disabled={submitting} aria-busy={submitting}>
              {submitting ? 'Mengirim…' : 'Kirim brief'}
            </button>
          </form>
        </div>
      </section>
    </>
  )
}
