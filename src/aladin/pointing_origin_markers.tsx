import React from 'react';

export interface PointingOriginMarker {
    name: string;
    position: [number, number]; // [x, y] pixel coordinates
}

interface LabelPosition {
    x: number;
    y: number;
    angle: number;
    distance: number;
}

/**
 * Check if two rectangles overlap
 */
const rectanglesOverlap = (
    x1: number, y1: number, w1: number, h1: number,
    x2: number, y2: number, w2: number, h2: number,
    padding: number = 5
): boolean => {
    return !(
        x1 + w1 + padding < x2 ||
        x2 + w2 + padding < x1 ||
        y1 + h1 + padding < y2 ||
        y2 + h2 + padding < y1
    );
};

/**
 * Calculate label positions to minimize overlaps
 * Uses a radial placement strategy with collision detection
 */
const calculateLabelPositions = (
    markers: PointingOriginMarker[],
    textWidth: number = 80,
    textHeight: number = 20,
    minDistance: number = 30,
    maxDistance: number = 80
): LabelPosition[] => {
    const positions: LabelPosition[] = [];
    const preferredAngles = [0, 45, 315, 90, 270, 135, 225, 180]; // Right, top-right, bottom-right, top, bottom, etc.

    markers.forEach((marker, index) => {
        const [starX, starY] = marker.position;
        let bestPosition: LabelPosition | null = null;
        let minOverlaps = Infinity;

        // Try different angles and distances
        for (const angle of preferredAngles) {
            for (let distance = minDistance; distance <= maxDistance; distance += 10) {
                const rad = (angle * Math.PI) / 180;
                const x = starX + Math.cos(rad) * distance;
                const y = starY + Math.sin(rad) * distance;

                // Count overlaps with existing labels
                let overlaps = 0;
                for (const existingPos of positions) {
                    if (rectanglesOverlap(
                        x, y, textWidth, textHeight,
                        existingPos.x, existingPos.y, textWidth, textHeight
                    )) {
                        overlaps++;
                    }
                }

                // Also check overlaps with other marker positions
                for (let j = 0; j < markers.length; j++) {
                    if (j !== index) {
                        const [otherX, otherY] = markers[j].position;
                        const dist = Math.sqrt((x - otherX) ** 2 + (y - otherY) ** 2);
                        if (dist < 20) overlaps++; // Penalize labels too close to other markers
                    }
                }

                // Keep track of position with minimum overlaps
                if (overlaps < minOverlaps) {
                    minOverlaps = overlaps;
                    bestPosition = { x, y, angle, distance };
                }

                // If we found a position with no overlaps, use it
                if (overlaps === 0) {
                    break;
                }
            }

            if (minOverlaps === 0) break;
        }

        // Use best position found, or default if none found
        if (bestPosition) {
            positions.push(bestPosition);
        } else {
            // Fallback: place to the right
            positions.push({
                x: starX + minDistance,
                y: starY,
                angle: 0,
                distance: minDistance
            });
        }
    });

    return positions;
};

interface PointingOriginMarkersProps {
    markers: PointingOriginMarker[];
    width: number;
    height: number;
    markerSize?: number;
    fontSize?: number;
    textOffset?: number;
    lineColor?: string;
    textColor?: string;
    markerColor?: string;
}

/**
 * Component to render pointing origin markers with non-overlapping text labels
 */
export const PointingOriginMarkers: React.FC<PointingOriginMarkersProps> = ({
    markers,
    width,
    height,
    markerSize = 8,
    fontSize = 12,
    textOffset = 40,
    lineColor = '#FFD700', // Gold
    textColor = '#FFFFFF',
    markerColor = '#FFFF00' // Yellow
}) => {
    // Calculate approximate text dimensions based on font size
    const avgCharWidth = fontSize * 0.6;
    const textHeight = fontSize + 4;

    // Calculate label positions
    const labelPositions = React.useMemo(() => {
        return calculateLabelPositions(
            markers,
            Math.max(...markers.map(m => m.name.length)) * avgCharWidth,
            textHeight,
            textOffset,
            textOffset + 40
        );
    }, [markers, avgCharWidth, textHeight, textOffset]);

    const style: React.CSSProperties = {
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        width: '100%',
        height: '100%'
    };

    return (
        <div className="pointing-origin-markers" style={style}>
            <svg width={width} height={height} style={{ overflow: 'visible' }}>
                {/* Render pointing origins with labels */}
                {markers.map((marker, index) => {
                    const [markerX, markerY] = marker.position;
                    const labelPos = labelPositions[index];

                    // Calculate text anchor based on label position relative to marker
                    const dx = labelPos.x - markerX;
                    const textAnchor = dx > 0 ? 'start' : dx < 0 ? 'end' : 'middle';

                    return (
                        <g key={`pointing-origin-${index}`} className="pointing-origin-group">
                            {/* Line from marker to label */}
                            <line
                                x1={markerX}
                                y1={markerY}
                                x2={labelPos.x}
                                y2={labelPos.y}
                                stroke={lineColor}
                                strokeWidth="1"
                                strokeDasharray="2,2"
                                opacity="0.7"
                            />

                            {/* Diamond marker */}
                            <path
                                d={`M ${markerX},${markerY - markerSize / 2} 
                                   L ${markerX + markerSize / 2},${markerY} 
                                   L ${markerX},${markerY + markerSize / 2} 
                                   L ${markerX - markerSize / 2},${markerY} Z`}
                                fill={markerColor}
                                stroke={lineColor}
                                strokeWidth="1.5"
                            />

                            {/* Text label with background stroke for visibility */}
                            <text
                                x={labelPos.x}
                                y={labelPos.y}
                                fontSize={fontSize}
                                fill={textColor}
                                textAnchor={textAnchor}
                                dominantBaseline="middle"
                                fontFamily="Arial, sans-serif"
                                fontWeight="500"
                                stroke="#000000"
                                strokeWidth="3"
                                paintOrder="stroke"
                            >
                                {marker.name}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};

export default PointingOriginMarkers;
