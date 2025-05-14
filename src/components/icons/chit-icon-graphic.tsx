// src/components/icons/chit-icon-graphic.tsx
import type { SVGProps } from 'react';

export function ChitIconGraphic(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" {...props}>
      {/* Teal Background with rounded corners */}
      <rect width="64" height="64" rx="10" ry="10" fill="#19A0A6" />

      {/* Laptop Body (White) */}
      {/* Screen part */}
      <rect x="8" y="16" width="48" height="30" rx="3" ry="3" fill="#FFFFFF" />
      {/* Base part (trapezoidal) */}
      <path d="M6 46 H58 L54 52 H10 Z" fill="#FFFFFF" />
      {/* Trackpad detail line */}
      <rect x="27" y="47.5" width="10" height="1.5" rx="0.5" ry="0.5" fill="#FFFFFF" />

      {/* Glasses (White) */}
      {/* Left Lens */}
      <circle cx="23" cy="31" r="7" fill="#FFFFFF" />
      {/* Right Lens */}
      <circle cx="41" cy="31" r="7" fill="#FFFFFF" />
      {/* Bridge */}
      <rect x="30" y="30" width="4" height="2" rx="1" fill="#FFFFFF" />

      {/* Shine Lines (White) */}
      <line x1="23" y1="11" x2="27" y2="15" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="32" y1="7" x2="32" y2="13" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="41" y1="11" x2="37" y2="15" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
