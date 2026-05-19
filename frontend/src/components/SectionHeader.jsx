/**
 * Eyebrow + serif display heading + optional lede.
 *
 * Wrap one word in <em> within `title` to get the ember-accent italic
 * (e.g. title={<>Lift every <em>voice</em></>}).
 */
export default function SectionHeader({ eyebrow, title, lede, center = false }) {
  return (
    <header style={{ textAlign: center ? 'center' : 'inherit', marginBottom: '2rem' }}>
      {eyebrow && <div className="section-eyebrow">{eyebrow}</div>}
      <h2 className="section-display">{title}</h2>
      {lede && <p className="section-lede" style={{ margin: center ? '0 auto' : 0 }}>{lede}</p>}
    </header>
  );
}
