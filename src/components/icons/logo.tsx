
import type { SVGProps } from 'react';

export function ChitLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="100" // Adjusted width for a shorter name
      height="30"
      viewBox="0 0 100 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Chit Logo"
      {...props}
    >
      <text
        x="5"
        y="22"
        fontFamily="var(--font-geist-sans), Arial, sans-serif"
        fontSize="20"
        fontWeight="bold"
        fill="currentColor"
      >
        Chit
      </text>
    </svg>
  );
}
