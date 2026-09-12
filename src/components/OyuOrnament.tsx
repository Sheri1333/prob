/** Kazakh koshkar-muiz (қошқар мүйіз) oyu. */
function HornPair() {
  const horn =
    "M70 104C18 104 6 58 32 30c18-20 50-22 64 2 8 14 4 30-10 36-12 6-26-2-28-16 2 14 16 28 36 30-4 8-12 16-24 20-24 8-48 2-70-2z";

  return (
    <g fill="currentColor">
      <path d={horn} />
      <path d={horn} transform="translate(140 0) scale(-1 1)" />
      <circle cx="70" cy="96" r="6" />
    </g>
  );
}

export function OyuOrnament({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 300 112" aria-hidden="true">
      <g transform="translate(8 4)">
        <HornPair />
      </g>
      <g transform="translate(154 4)">
        <HornPair />
      </g>
    </svg>
  );
}
