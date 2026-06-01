import { useState } from 'react'
import { CheckCircle, MapPin, Clock, HeartHandshake, Users, Sparkles } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { FormGroup, Label, Input, Select } from '../components/FormElements'
import { useLanguage } from '../contexts/LanguageContext'
import { useApp } from '../contexts/AppContext'
import { useForm } from '../hooks/useForm'
import Reveal from '../components/motion/Reveal'

const MONO = 'ui-monospace, "SF Mono", Menlo, monospace'
const SERIF = 'Frank Ruhl Libre, Georgia, serif'

export default function VolunteerPage() {
  const { t, lang } = useLanguage()
  const { volunteers, addVolunteer, toast } = useApp()
  const v = t.volunteers
  const [submitted, setSubmitted] = useState(false)
  const [selectedAreas, setSelectedAreas] = useState([])
  const [focusedArea, setFocusedArea] = useState(null)
  const [focusedAvail, setFocusedAvail] = useState(null)

  const { values, errors, handleChange, setFieldErrors, reset } = useForm({
    fullName:'', profession:'', availability:'1', city:'',
  })

  const toggleArea = (area) => {
    setSelectedAreas(prev =>
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    )
  }

  const handleSubmit = () => {
    const errs = {}
    if (!values.fullName.trim())    errs.fullName   = t.request.validation.required
    if (!values.profession.trim())  errs.profession = t.request.validation.required
    if (!values.city.trim())        errs.city       = t.request.validation.required
    if (Object.keys(errs).length)   { setFieldErrors(errs); return }

    addVolunteer({
      name:         values.fullName,
      nameEn:       values.fullName,
      initials:     values.fullName.split(' ').slice(0,2).map(w => w[0]).join(''),
      profession:   values.profession,
      professionEn: values.profession,
      areas:        selectedAreas,
      availability: v.form[`avail${values.availability}`],
      availabilityEn: v.form[`avail${values.availability}`],
      city:         values.city,
      cityEn:       values.city,
    })
    toast(lang === 'he' ? 'תודה על הרשמתך! נצור קשר בקרוב.' : 'Thank you! We\'ll contact you soon.', 'success')
    setSubmitted(true)
    reset()
    setSelectedAreas([])
  }

  const STATUS_COLORS = { available:'var(--success)', assigned:'var(--ember)' }
  const availableCount = volunteers.filter(vol => vol.status === 'available').length

  return (
    <main>
      <PageHeader eyebrow={lang === 'he' ? 'הצטרפות מתנדבים' : 'Join the team'} title={v.pageTitle} subtitle={v.pageSubtitle} />

      <section className="section-padding" style={{ background: 'var(--paper)' }}>
        <div className="page-container">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 'clamp(32px, 5vw, 56px)',
              alignItems: 'start',
            }}
          >

            {/* ── REGISTRATION FORM ─────────────────────────────────────── */}
            <Reveal>
              <div>
                <span className="eyebrow" style={{ color: 'var(--ember)', display: 'block', marginBlockEnd: '12px' }}>
                  {lang === 'he' ? 'טופס הרשמה' : 'Sign up'}
                </span>
                <h2 className="section-display-bold" style={{ marginBlockEnd: '10px', fontSize: 'var(--fs-h2)' }}>
                  {v.registerTitle}
                </h2>
                <p className="section-lede" style={{ margin: '0 0 24px', fontSize: 'var(--fs-body)' }}>
                  {v.registerSub}
                </p>

                {submitted ? (
                  <div
                    className="card"
                    style={{
                      padding: 'clamp(32px, 5vw, 48px) 32px',
                      textAlign: 'center',
                      border: '1px solid var(--hair)',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    <div
                      style={{
                        width: '72px', height: '72px',
                        background: 'var(--success-soft)',
                        borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 20px',
                      }}
                    >
                      <CheckCircle size={34} color="var(--success)" strokeWidth={2} />
                    </div>
                    <h3 style={{ fontFamily: SERIF, fontSize: 'var(--fs-h3)', fontWeight: 700, color: 'var(--ink)', marginBlockEnd: '8px' }}>
                      {lang === 'he' ? 'תודה רבה!' : 'Thank You!'}
                    </h3>
                    <p style={{ color: 'var(--gray-600)', lineHeight: 1.6, margin: '0 auto 24px', maxWidth: '24rem' }}>
                      {lang === 'he' ? 'הרשמתך התקבלה. נציג יצור איתך קשר בקרוב.' : 'Your registration was received. A representative will contact you soon.'}
                    </p>
                    <button className="btn btn-outline" onClick={() => setSubmitted(false)}>
                      {lang === 'he' ? 'הרשמה נוספת' : 'Register Another'}
                    </button>
                  </div>
                ) : (
                  <div
                    className="card"
                    style={{
                      padding: 'clamp(24px, 4vw, 36px)',
                      border: '1px solid var(--hair)',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    <FormGroup>
                      <Label htmlFor="fullName" required>{v.form.fullName}</Label>
                      <Input id="fullName" name="fullName" value={values.fullName}
                        onChange={handleChange} error={errors.fullName} />
                    </FormGroup>
                    <FormGroup>
                      <Label htmlFor="profession" required>{v.form.profession}</Label>
                      <Input id="profession" name="profession" value={values.profession}
                        onChange={handleChange} placeholder={v.form.profPH} error={errors.profession} />
                    </FormGroup>
                    <FormGroup>
                      <Label htmlFor="vol-city" required>{t.request.step1.city}</Label>
                      <Select id="vol-city" name="city" value={values.city} onChange={handleChange} error={errors.city}>
                        <option value="">{lang === 'he' ? 'בחר עיר...' : 'Select city...'}</option>
                        {t.request.cities.map(c => <option key={c} value={c}>{c}</option>)}
                      </Select>
                    </FormGroup>

                    {/* Areas of interest — selectable chips */}
                    <FormGroup>
                      <Label>{v.form.areas}</Label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBlockStart: '8px' }}>
                        {v.form.areasList.map(area => {
                          const on = selectedAreas.includes(area)
                          const focused = focusedArea === area
                          return (
                            <label
                              key={area}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '11px 14px', borderRadius: 'var(--radius-sm)',
                                border: `1px solid ${(on || focused) ? 'var(--ember)' : 'var(--hair)'}`,
                                background: on ? 'var(--ember-soft)' : 'var(--white)',
                                color: on ? 'var(--ember-700)' : 'var(--gray-700)',
                                fontWeight: on ? 600 : 500,
                                cursor: 'pointer', fontSize: 'var(--fs-sm)',
                                textAlign: 'start',
                                boxShadow: focused ? '0 0 0 4px var(--ember-soft)' : 'none',
                                transition: 'border-color var(--dur-2) var(--ease-out), background var(--dur-2) var(--ease-out), color var(--dur-2) var(--ease-out), box-shadow var(--dur-2) var(--ease-out)',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() => toggleArea(area)}
                                onFocus={() => setFocusedArea(area)}
                                onBlur={() => setFocusedArea(null)}
                                style={{ accentColor: 'var(--ember)', width: '16px', height: '16px', flexShrink: 0 }}
                              />
                              {area}
                            </label>
                          )
                        })}
                      </div>
                    </FormGroup>

                    {/* Availability — radio cards */}
                    <FormGroup>
                      <Label>{v.form.availability}</Label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBlockStart: '8px' }}>
                        {[['1', v.form.avail1], ['2', v.form.avail2], ['3', v.form.avail3]].map(([val, label]) => {
                          const on = values.availability === val
                          const focused = focusedAvail === val
                          return (
                            <label
                              key={val}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '12px',
                                padding: '13px 16px', borderRadius: 'var(--radius-sm)',
                                border: `1px solid ${(on || focused) ? 'var(--ember)' : 'var(--hair)'}`,
                                background: on ? 'var(--ember-soft)' : 'var(--white)',
                                color: on ? 'var(--ember-700)' : 'var(--gray-700)',
                                fontWeight: on ? 600 : 500,
                                cursor: 'pointer', fontSize: 'var(--fs-sm)',
                                textAlign: 'start',
                                boxShadow: focused ? '0 0 0 4px var(--ember-soft)' : 'none',
                                transition: 'border-color var(--dur-2) var(--ease-out), background var(--dur-2) var(--ease-out), color var(--dur-2) var(--ease-out), box-shadow var(--dur-2) var(--ease-out)',
                              }}
                            >
                              <input type="radio" name="availability" value={val}
                                checked={on} onChange={handleChange}
                                onFocus={() => setFocusedAvail(val)}
                                onBlur={() => setFocusedAvail(null)}
                                style={{ accentColor: 'var(--ember)', width: '16px', height: '16px', flexShrink: 0 }} />
                              {label}
                            </label>
                          )
                        })}
                      </div>
                    </FormGroup>

                    <button className="btn btn-ember btn-full btn-lg" style={{ marginBlockStart: '12px' }} onClick={handleSubmit}>
                      <CheckCircle size={18} /> {v.form.submitBtn}
                    </button>
                  </div>
                )}
              </div>
            </Reveal>

            {/* ── ACTIVE VOLUNTEERS LIST ─────────────────────────────────── */}
            <Reveal delay={0.1}>
              <div>
                <span className="eyebrow" style={{ color: 'var(--ember)', display: 'block', marginBlockEnd: '12px' }}>
                  {lang === 'he' ? 'הקהילה שלנו' : 'Our community'}
                </span>
                <h2 className="section-display-bold" style={{ marginBlockEnd: '10px', fontSize: 'var(--fs-h2)' }}>
                  {v.activeTitle}
                </h2>
                <p className="section-lede" style={{ margin: '0 0 24px', fontSize: 'var(--fs-body)' }}>
                  {volunteers.length}+ {v.activeSub}
                </p>

                {/* Summary strip */}
                <div
                  style={{
                    display: 'flex', flexWrap: 'wrap', gap: '24px',
                    padding: '18px 20px', marginBlockEnd: '20px',
                    background: 'var(--sky-3)', borderRadius: 'var(--radius)',
                    border: '1px solid var(--hair)',
                  }}
                >
                  {[
                    { icon: <Users size={18} />, num: volunteers.length, label: lang === 'he' ? 'מתנדבים פעילים' : 'Active volunteers' },
                    { icon: <Sparkles size={18} />, num: availableCount, label: lang === 'he' ? 'זמינים כעת' : 'Available now' },
                  ].map((stat, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span
                        style={{
                          width: '40px', height: '40px', borderRadius: 'var(--radius-sm)',
                          background: 'var(--white)', color: 'var(--ember)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: '1px solid var(--hair)', flexShrink: 0,
                        }}
                      >
                        {stat.icon}
                      </span>
                      <span style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontFamily: SERIF, fontSize: '1.4rem', fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>
                          {stat.num}
                        </span>
                        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--gray-600)', fontFamily: MONO, letterSpacing: '0.04em', textTransform: 'uppercase', marginBlockStart: '4px' }}>
                          {stat.label}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>

                {volunteers.length === 0 ? (
                  <div
                    className="card"
                    style={{
                      padding: '40px 32px', textAlign: 'center',
                      border: '1px dashed var(--line)', boxShadow: 'none', background: 'var(--white)',
                    }}
                  >
                    <div
                      style={{
                        width: '56px', height: '56px', borderRadius: '50%',
                        background: 'var(--ember-soft)', color: 'var(--ember)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 16px',
                      }}
                    >
                      <HeartHandshake size={26} />
                    </div>
                    <p style={{ color: 'var(--gray-600)', lineHeight: 1.6, margin: 0 }}>
                      {lang === 'he' ? 'עדיין אין מתנדבים רשומים — היו הראשונים להצטרף.' : 'No volunteers yet — be the first to join.'}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {volunteers.map(vol => {
                      const isAvailable = vol.status === 'available'
                      const statusColor = STATUS_COLORS[vol.status] || 'var(--gray-400)'
                      return (
                        <div
                          key={vol.id}
                          className="card"
                          style={{
                            background: 'var(--white)', borderRadius: 'var(--radius)',
                            border: '1px solid var(--hair)',
                            boxShadow: 'var(--shadow-xs)',
                            padding: '18px 20px',
                            display: 'grid', gridTemplateColumns: '52px 1fr auto',
                            gap: '16px', alignItems: 'center',
                          }}
                        >
                          {/* Avatar */}
                          <div
                            style={{
                              width: '52px', height: '52px', borderRadius: '50%',
                              background: 'var(--ink)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontFamily: SERIF, fontWeight: 700,
                              color: 'var(--cream)', fontSize: '17px',
                            }}
                            aria-hidden="true"
                          >
                            {vol.initials}
                          </div>
                          {/* Info */}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--ink)', marginBlockEnd: '3px' }}>
                              {lang === 'he' ? vol.name : vol.nameEn}
                            </div>
                            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--gray-600)', marginBlockEnd: '8px' }}>
                              {lang === 'he' ? vol.profession : vol.professionEn}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px', fontSize: 'var(--fs-xs)', color: 'var(--gray-500)' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <MapPin size={12} aria-hidden="true" />
                                {lang === 'he' ? vol.city : vol.cityEn}
                              </span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <Clock size={12} aria-hidden="true" />
                                {lang === 'he' ? vol.availability : vol.availabilityEn}
                              </span>
                            </div>
                          </div>
                          {/* Status pill */}
                          <span
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '7px',
                              padding: '6px 12px', borderRadius: '999px',
                              fontSize: 'var(--fs-xs)', fontWeight: 600,
                              fontFamily: MONO, letterSpacing: '0.03em',
                              color: statusColor,
                              background: isAvailable ? 'var(--success-soft)' : 'var(--ember-soft)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <span
                              style={{
                                width: '8px', height: '8px', borderRadius: '50%',
                                background: statusColor, flexShrink: 0,
                              }}
                              aria-hidden="true"
                            />
                            {isAvailable ? v.available : (lang === 'he' ? 'משויך' : 'Assigned')}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </main>
  )
}
