// src/components/icons/chit-icon-graphic.tsx
import type { SVGProps } from 'react';

export function ChitIconGraphic(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" {...props}>
      {/* Teal Background with rounded corners */}
      <rect width="64" height="64" rx="10" ry="10" fill="#19A0A6" />

      {/* Laptop Screen (white) */}
      <rect x="7" y="18" width="50" height="30" rx="4" ry="4" fill="#FFFFFF" />

      {/* Laptop Base (white) */}
      <path
        d="M4 51C4 49.3431 5.34315 48 7 48H57C58.6569 48 60 49.3431 60 51V53C60 53.5523 59.5523 54 59 54H5C4.44772 54 4 53.5523 4 53V51Z"
        fill="#FFFFFF"
      />
      {/* Laptop trackpad/detail line (white) */}
      <rect x="27" y="49.5" width="10" height="1.5" rx="0.75" ry="0.75" fill="#FFFFFF" />

      {/* Glasses (white) */}
      <circle cx="23" cy="33" r="6.5" fill="#FFFFFF" /> {/* Left Lens */}
      <circle cx="41" cy="33" r="6.5" fill="#FFFFFF" /> {/* Right Lens */}
      {/* Bridge for glasses */}
      <path d="M29.5 33C29.5 32.1716 30.1716 31.5 31 31.5H33C33.8284 31.5 34.5 32.1716 34.5 33V33C34.5 33.8284 33.8284 34.5 33 34.5H31C30.1716 34.5 29.5 33.8284 29.5 33V33Z" fill="#FFFFFF"/>

      {/* Shine Lines above laptop screen (white) */}
      <line x1="32" y1="7" x2="32" y2="13" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="26" y1="10" x2="29" y2="14" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="38" y1="10" x2="35" y2="14" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
