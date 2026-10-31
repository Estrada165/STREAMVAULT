// Ícono del asistente: burbuja de mensaje con un destello (no es un robot)
export default function AssistantIcon({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20 12.5a7.5 7.5 0 01-11.2 6.5L4 20.5l1.4-4.3A7.5 7.5 0 1120 12.5z" />
      <path d="M12.5 8.2l.75 1.8 1.8.75-1.8.75-.75 1.8-.75-1.8-1.8-.75 1.8-.75z" fill="currentColor" strokeWidth="1" />
      <path d="M17.6 2.6l.4 1 1 .4-1 .4-.4 1-.4-1-1-.4 1-.4z" fill="currentColor" strokeWidth=".8" />
    </svg>
  )
}
