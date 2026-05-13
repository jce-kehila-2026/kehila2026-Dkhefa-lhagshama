export default function PageHeader({ title, subtitle, children }) {
  return (
    <div style={{
      background: 'linear-gradient(160deg, var(--navy-dark) 0%, var(--navy) 100%)',
      padding: '56px 0 52px',
      textAlign: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* decorative dots */}
      <div style={{
        position:'absolute', inset:0, opacity:0.04,
        backgroundImage:'radial-gradient(circle, #fff 1px, transparent 1px)',
        backgroundSize:'28px 28px',
        pointerEvents:'none',
      }} />
      <div className="page-container" style={{ position:'relative', zIndex:1 }}>
        <div className="gold-line center" />
        <h1 style={{
          fontFamily:'Frank Ruhl Libre, serif',
          fontSize:'clamp(26px, 4vw, 38px)',
          fontWeight:900, color:'#fff', marginBottom:'10px',
        }}>{title}</h1>
        {subtitle && (
          <p style={{ color:'rgba(255,255,255,0.7)', fontSize:'15.5px', maxWidth:'520px', margin:'0 auto' }}>
            {subtitle}
          </p>
        )}
        {children}
      </div>
    </div>
  )
}