import React from 'react';

interface ScaleBarProps {
  width: number;
  height: number;
  invertImage?: boolean;
  degPerPixel: number; // degrees per pixel at the current zoom
}

const MAX_PX = 100; // longest the bar may be drawn
const RIGHT_MARGIN = 30; // px between the bar's right end and the viewer edge

export const ScaleBar: React.FC<ScaleBarProps> = ({ width, height, degPerPixel, invertImage }) => {

  // Pick the longest 1-2-5 length (..., 0.5", 1", 2", 5", 10", ...) that fits in MAX_PX.
  // There's no 1" floor, so at high zoom the bar drops to sub-arcsecond lengths instead of
  // growing past MAX_PX and running off the edge.
  const arcsecPerPixel = 3600 * degPerPixel;
  const maxArcsec = MAX_PX * arcsecPerPixel;
  const decade = Math.pow(10, Math.floor(Math.log10(maxArcsec)));
  const scaleBarLengthArcsec = [5, 2, 1].map((m) => m * decade).find((len) => len <= maxArcsec) ?? decade;
  const lengthPx = scaleBarLengthArcsec / arcsecPerPixel;
  const label = `${Number(scaleBarLengthArcsec.toPrecision(2))}"`;

  return (
    <svg
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none'
      }}
    >
      {/* Right end pinned RIGHT_MARGIN from the edge; the bar grows leftward */}
      <g transform={`translate(${width - RIGHT_MARGIN - lengthPx}, ${height - 30})`}>
        {/* Horizontal line */}
        <line
          x1="0"
          y1="0"
          x2={lengthPx}
          y2="0"
          stroke= {invertImage ? "black" : "white"}
          strokeWidth="2"
        />
        {/* Left tick */}
        <line
          x1="0"
          y1="-6"
          x2="0"
          y2="6"
          stroke= {invertImage ? "black" : "white"}
          strokeWidth="4"
        />
        {/* Right tick */}
        <line
          x1={lengthPx}
          y1="-6"
          x2={lengthPx}
          y2="6"
          stroke= {invertImage ? "black" : "white"}
          strokeWidth="4"
        />
        {/* Label */}
        <text
          x={lengthPx / 2}
          y="20"
          fontSize="16"
          textAnchor="middle"
          fontFamily="monospace"
          fill={invertImage ? "black" : "white"}
        >
          {label}
        </text>
      </g>
    </svg>
  );
};
