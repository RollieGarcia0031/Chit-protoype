// src/components/icons/logo.tsx
import type { SVGProps } from 'react';
import { ChitIconGraphic } from './chit-icon-graphic';

export function ChitLogo({
  showText = true,
  className,
  ...props
}: SVGProps<SVGSVGElement> & { showText?: boolean }) {
  const iconSize = 28; 
  const textYPosition = 21; 
  const textXPosition = iconSize + 7; // Space between icon and text
  const svgHeight = 30; 

  // Estimate text width for "Chit" based on font size and character count
  const estimatedTextWidth = showText ? 45 : 0; 
  const svgWidth = showText ? textXPosition + estimatedTextWidth : iconSize;
  const viewBoxWidth = showText ? textXPosition + estimatedTextWidth : iconSize;

  return (
    <svg
      width={svgWidth}
      height={svgHeight}
      viewBox={`0 0 ${viewBoxWidth} ${svgHeight}`}
      className={className}
      aria-label="Chit Logo" // Added aria-label
      {...props}
    >
      <ChitIconGraphic 
        width={iconSize} 
        height={iconSize} 
        x="0" 
        y={(svgHeight - iconSize) / 2} // Center icon vertically
      />
      {showText && (
        <text
          x={textXPosition}
          y={textYPosition}
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
