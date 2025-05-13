import type { SVGProps } from 'react';

export function ViteStartLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="150"
      height="30"
      viewBox="0 0 150 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="ViteStart Logo"
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
        ViteStart
      </text>
    </svg>
  );
}
