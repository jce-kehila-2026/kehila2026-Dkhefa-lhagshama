export default function Eyebrow({ children, className = '', ...rest }) {
  return (
    <span className={`eyebrow ${className}`.trim()} {...rest}>
      {children}
    </span>
  );
}
