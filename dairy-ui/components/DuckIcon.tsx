// Duck silhouette, drawn here because the icon set has no duck.
export default function DuckIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <ellipse cx="10.5" cy="15.5" rx="8" ry="5" />
      <path d="M12.5 13.5c-.6-1.4-.7-2.8-.1-4.2.7-1.6 2.3-2.6 4-2.4 1.9.2 3.3 1.9 3.1 3.8-.1 1.2-.8 2.2-1.8 2.8-1.3.8-2.9 1-4.2.5z" />
      <path d="M19.2 8.6 23 9.4l-3.6 1.5z" />
      <path d="M3.4 13.6 1 10.8l4.2 1.6z" />
      <circle cx="16.6" cy="9.3" r="0.8" fill="white" />
      <path d="M6.5 15.2c1.8 1.3 4.6 1.6 6.8.6" fill="none" stroke="white" strokeOpacity="0.6" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}
