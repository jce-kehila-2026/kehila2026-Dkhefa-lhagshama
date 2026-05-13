import { useState } from 'react'
import { CheckCircle, MapPin, Clock } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { FormGroup, Label, Input, Select } from '../components/FormElements'
import { useLanguage } from '../contexts/LanguageContext'
import { useApp } from '../contexts/AppContext'
import { useForm } from '../hooks/useForm'

export default function VolunteerPage() {
  const { t, lang } = useLanguage()
  const { volunteers, addVolunteer, toast } = useApp()
  const v = t.volunteers
  const [submitted, setSubmitted] = useState(false)
  const [selectedAreas, setSelectedAreas] = useState([])

  const { values, errors, handleChange, setValue, setFieldErrors, reset } = useForm({
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

  const STATUS_COLORS = { available:'#15803D', assigned:'#C9971A' }

  return (
    <>
      <PageHeader title={v.pageTitle} subtitle={v.pageSubtitle} />
      <div className="page-container section-padding">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:'40px' }}>

          {/* REGISTRATION FORM */}
          <div>
            <div className="gold-line" />
            <h2 style={{ fontFamily:'Frank Ruhl Libre, serif', fontSize:'26px', fontWeight:900, color:'var(--navy)', marginBottom:'8px' }}>
              {v.registerTitle}
            </h2>
            <p style={{ color:'var(--gray-500)', marginBottom:'24px' }}>{v.registerSub}</p>

            {submitted ? (
              <div className="card" style={{ padding:'40px', textAlign:'center' }}>
                <div style={{
                  width:'64px', height:'64px',
                  background:'var(--gold-pale)',
                  borderRadius:'50%',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  margin:'0 auto 16px',
                }}>
                  <CheckCircle size={30} color="var(--gold)" />
                </div>
                <h3 style={{ fontFamily:'Frank Ruhl Libre, serif', fontSize:'20px', color:'var(--navy)', marginBottom:'8px' }}>
                  {lang === 'he' ? 'תודה רבה!' : 'Thank You!'}
                </h3>
                <p style={{ color:'var(--gray-500)', marginBottom:'20px' }}>
                  {lang === 'he' ? 'הרשמתך התקבלה. נציג יצור איתך קשר בקרוב.' : 'Your registration was received. A representative will contact you soon.'}
                </p>
                <button className="btn btn-primary" onClick={() => setSubmitted(false)}>
                  {lang === 'he' ? 'הרשמה נוספת' : 'Register Another'}
                </button>
              </div>
            ) : (
              <div className="card" style={{ padding:'32px' }}>
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

                {/* Areas */}
                <FormGroup>
                  <Label>{v.form.areas}</Label>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginTop:'6px' }}>
                    {v.form.areasList.map(area => (
                      <label key={area} style={{
                        display:'flex', alignItems:'center', gap:'8px',
                        padding:'9px 13px', borderRadius:'8px',
                        border:`1.5px solid ${selectedAreas.includes(area) ? 'var(--navy)' : 'var(--gray-200)'}`,
                        background: selectedAreas.includes(area) ? '#EBF0FA' : 'var(--white)',
                        cursor:'pointer', fontSize:'13px', transition:'all .18s',
                      }}>
                        <input
                          type="checkbox"
                          checked={selectedAreas.includes(area)}
                          onChange={() => toggleArea(area)}
                          style={{ accentColor:'var(--navy)', width:'15px', height:'15px' }}
                        />
                        {area}
                      </label>
                    ))}
                  </div>
                </FormGroup>

                <FormGroup>
                  <Label>{v.form.availability}</Label>
                  <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginTop:'6px' }}>
                    {[['1', v.form.avail1], ['2', v.form.avail2], ['3', v.form.avail3]].map(([val, label]) => (
                      <label key={val} style={{
                        display:'flex', alignItems:'center', gap:'8px',
                        padding:'10px 14px', borderRadius:'8px',
                        border:`1.5px solid ${values.availability === val ? 'var(--navy)' : 'var(--gray-200)'}`,
                        background: values.availability === val ? '#EBF0FA' : 'var(--white)',
                        cursor:'pointer', fontSize:'13.5px', transition:'all .18s',
                      }}>
                        <input type="radio" name="availability" value={val}
                          checked={values.availability === val} onChange={handleChange}
                          style={{ accentColor:'var(--navy)' }} />
                        {label}
                      </label>
                    ))}
                  </div>
                </FormGroup>

                <button className="btn btn-primary btn-full" style={{ marginTop:'8px' }} onClick={handleSubmit}>
                  <CheckCircle size={16} /> {v.form.submitBtn}
                </button>
              </div>
            )}
          </div>

          {/* ACTIVE VOLUNTEERS LIST */}
          <div>
            <div className="gold-line" />
            <h2 style={{ fontFamily:'Frank Ruhl Libre, serif', fontSize:'26px', fontWeight:900, color:'var(--navy)', marginBottom:'8px' }}>
              {v.activeTitle}
            </h2>
            <p style={{ color:'var(--gray-500)', marginBottom:'24px' }}>
              {volunteers.length}+ {v.activeSub}
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              {volunteers.map(vol => (
                <div key={vol.id} style={{
                  background:'var(--white)', borderRadius:'var(--radius)',
                  border:'1px solid var(--gray-200)',
                  padding:'18px 20px',
                  display:'grid', gridTemplateColumns:'52px 1fr auto',
                  gap:'14px', alignItems:'center',
                  transition:'box-shadow .2s',
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow='var(--shadow-sm)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow='none'}
                >
                  {/* Avatar */}
                  <div style={{
                    width:'52px', height:'52px', borderRadius:'50%',
                    background:'var(--navy)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:'Frank Ruhl Libre, serif', fontWeight:900,
                    color:'var(--gold-light)', fontSize:'17px',
                  }}>
                    {vol.initials}
                  </div>
                  {/* Info */}
                  <div>
                    <div style={{ fontSize:'15px', fontWeight:700, color:'var(--navy)', marginBottom:'3px' }}>
                      {lang === 'he' ? vol.name : vol.nameEn}
                    </div>
                    <div style={{ fontSize:'12.5px', color:'var(--gray-500)', marginBottom:'6px' }}>
                      {lang === 'he' ? vol.profession : vol.professionEn}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'12px', fontSize:'12px', color:'var(--gray-400)' }}>
                      <span style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                        <MapPin size={11} />
                        {lang === 'he' ? vol.city : vol.cityEn}
                      </span>
                      <span style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                        <Clock size={11} />
                        {lang === 'he' ? vol.availability : vol.availabilityEn}
                      </span>
                    </div>
                  </div>
                  {/* Status */}
                  <div style={{
                    display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'5px',
                  }}>
                    <div style={{
                      width:'9px', height:'9px', borderRadius:'50%',
                      background: STATUS_COLORS[vol.status] || 'var(--gray-400)',
                    }} />
                    <span style={{
                      fontSize:'11.5px', fontWeight:600,
                      color: STATUS_COLORS[vol.status],
                    }}>
                      {vol.status === 'available' ? v.available : (lang === 'he' ? 'משויך' : 'Assigned')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}