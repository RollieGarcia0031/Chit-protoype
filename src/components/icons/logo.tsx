
import type { SVGProps } from 'react';

export function ChitLogo({
  showText = true,
  ...props
}: SVGProps<SVGSVGElement> & { showText?: boolean }) {
  const svgWidth = showText ? 100 : 30; // Adjusted width based on text visibility
  const iconRadius = 10;
  const iconCenterX = 15;
  const textXPosition = iconCenterX + iconRadius + 10; // Position text after the icon

  return (
    <svg
      width={svgWidth}
      height="30"
      viewBox={`0 0 ${svgWidth} 30`} // ViewBox dynamically adjusts
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Chit Logo"
      {...props}
    >
      {/* Simple graphical mark (circle) */}
      <circle cx={iconCenterX} cy="15" r={iconRadius} fill="currentColor" />
      {showText && (
        <text
          x={textXPosition}
          y="22"
          fontFamily="var(--font-geist-sans), Arial, sans-serif"
          fontSize="20"
          fontWeight="bold"
          fill="currentColor"
        >
          Chit
        </text>
      )}
    </svg>
  );
}
