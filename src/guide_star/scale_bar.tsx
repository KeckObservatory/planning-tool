import React from 'react';

interface ScaleBarProps {
  width: number;
  height: number;
}

export const ScaleBar: React.FC<ScaleBarProps> = ({ width, height }) => {
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
      {/* Scale bar: 100 pixels = 20 arcseconds */}
      <g transform={`translate(${width - 120}, ${height - 30})`}>
        {/* Horizontal line */}
        <line
          x1="0"
          y1="0"
          x2="100"
          y2="0"
          stroke="white"
          strokeWidth="2"
        />
        {/* Left tick */}
        <line
          x1="0"
          y1="-3"
          x2="0"
          y2="3"
          stroke="white"
          strokeWidth="2"
        />
        {/* Right tick */}
        <line
          x1="100"
          y1="-3"
          x2="100"
          y2="3"
          stroke="white"
          strokeWidth="2"
        />
        {/* Label */}
        <text
          x="50"
          y="15"
          fill="white"
          fontSize="12"
          textAnchor="middle"
          fontFamily="monospace"
        >
          20"
        </text>
      </g>
    </svg>
  );
};
