import { useId } from 'react';

interface NotePdfIconProps {
  size?: number;
  featured?: boolean;
  className?: string;
}

export const NotePdfIcon = ({ size = 64, featured = false, className = '' }: NotePdfIconProps) => {
  const uid = useId().replace(/:/g, '');

  const bodyStart  = featured ? '#FBBF24' : '#818CF8';
  const bodyEnd    = featured ? '#B45309' : '#3730A3';
  const shadowClr  = featured ? 'rgba(245,158,11,0.40)' : 'rgba(79,70,229,0.38)';
  const accentClr  = featured ? 'rgba(251,191,36,0.45)' : 'rgba(99,102,241,0.35)';

  return (
    <svg
      width={size}
      height={Math.round(size * 1.25)}
      viewBox="0 0 64 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        {/* Main body gradient */}
        <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="64" y2="80" gradientUnits="userSpaceOnUse">
          <stop stopColor={bodyStart} />
          <stop offset="1" stopColor={bodyEnd} />
        </linearGradient>

        {/* Fold corner gradient */}
        <linearGradient id={`${uid}-fold`} x1="40" y1="2" x2="58" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="rgba(255,255,255,0.40)" />
          <stop offset="1" stopColor="rgba(255,255,255,0.08)" />
        </linearGradient>

        {/* Shine on body */}
        <linearGradient id={`${uid}-shine`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="rgba(255,255,255,0.18)" />
          <stop offset="0.6" stopColor="rgba(255,255,255,0)" />
        </linearGradient>

        {/* Drop shadow */}
        <filter id={`${uid}-shadow`} x="-20%" y="-12%" width="140%" height="140%">
          <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor={shadowClr} floodOpacity="1" />
        </filter>
      </defs>

      {/* ── Document body (folded-corner path) ── */}
      <path
        d="M6 8 C6 5.2 8.2 3 11 3 H40 L57 20 V72 C57 74.8 54.8 77 52 77 H11 C8.2 77 6 74.8 6 72 Z"
        fill={`url(#${uid}-body)`}
        filter={`url(#${uid}-shadow)`}
      />

      {/* Shine overlay on body */}
      <path
        d="M6 8 C6 5.2 8.2 3 11 3 H40 L57 20 V40 H6 Z"
        fill={`url(#${uid}-shine)`}
      />

      {/* Fold corner – darker fill */}
      <path d="M40 3 L57 20 H40 Z" fill={`url(#${uid}-fold)`} />

      {/* Fold corner – crease stroke */}
      <path d="M40 3 L40 20 H57" stroke="rgba(255,255,255,0.45)" strokeWidth="1.1" />

      {/* Horizontal accent band */}
      <rect x="6" y="27" width="51" height="7" fill="rgba(255,255,255,0.11)" />

      {/* ── Content lines ── */}
      {/* Line 1 – long */}
      <rect x="14" y="41" width="32" height="3.5" rx="1.75" fill="rgba(255,255,255,0.82)" />
      {/* Line 2 – medium */}
      <rect x="14" y="50" width="25" height="3.5" rx="1.75" fill="rgba(255,255,255,0.58)" />
      {/* Line 3 – short */}
      <rect x="14" y="59" width="17" height="3.5" rx="1.75" fill="rgba(255,255,255,0.36)" />

      {/* ── Decorative badge / stamp in lower-right ── */}
      <circle cx="46" cy="57" r="8"   fill={accentClr} />
      <circle cx="46" cy="57" r="5.5" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.50)" strokeWidth="1.2" />
      <circle cx="46" cy="57" r="2.5" fill="rgba(255,255,255,0.45)" />
    </svg>
  );
};
