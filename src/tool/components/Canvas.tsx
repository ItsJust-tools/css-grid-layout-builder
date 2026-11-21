'use client';

import React, { useMemo } from 'react';
import type { GridToolState } from '../types';
import { buildAreaMatrix, sanitizeAreaName, GRID_ID_PREFIX } from '../grid-logic';

interface CanvasProps {
  state: GridToolState;
  onStateChange: (state: GridToolState) => void;
  canvasRef?: React.RefObject<HTMLDivElement | null>;
}

/** Live preview canvas: renders the grid with labeled areas. */
export const Canvas: React.FC<CanvasProps> = ({ state, onStateChange, canvasRef }) => {
  const matrix = useMemo(() => buildAreaMatrix(state), [state]);

  const cellCount = state.rows.length * state.columns.length;
  if (!canvasRef) canvasRef = React.useRef<HTMLDivElement | null>(null);

  const cells: Array<{ key: string; label: string; area?: string }> = [];
  for (let r = 1; r <= state.rows.length; r++) {
    for (let c = 1; c <= state.columns.length; c++) {
      cells.push({
        key: `${r}-${c}`,
        label: `${r}/${c}`,
        area: (matrix[r - 1]?.[c - 1] ?? '.') !== '.' ? matrix[r - 1]?.[c - 1] : undefined,
      });
    }
  }

  // dedupe by area name: one labeled box per named area
  const areaCells = new Map<string, { startRow: number; startCol: number; rowSpan: number; colSpan: number }>();
  for (const area of state.areas) {
    areaCells.set(sanitizeAreaName(area.name || GRID_ID_PREFIX + area.id), {
      startRow: area.rowStart,
      startCol: area.colStart,
      rowSpan: area.rowSpan,
      colSpan: area.colSpan,
    });
  }

  return (
    <div ref={canvasRef} className="grid-canvas p-4 overflow-auto" data-testid="grid-canvas">
      <div
        role="application"
        aria-label="Grid preview canvas"
        data-testid="grid-preview"
        className="grid-canvas-frame"
        style={{
          display: 'grid',
          gridTemplateColumns: state.columns.join(' '),
          gridTemplateRows: state.rows.join(' '),
          columnGap: `${state.columnGap}px`,
          rowGap: `${state.rowGap}px`,
          minHeight: '320px',
          border: '1px solid var(--border, #d4d4d8)',
          padding: '12px',
          borderRadius: 8,
        }}
      >
        {state.areas.map((area) => {
          const name = sanitizeAreaName(area.name || GRID_ID_PREFIX + area.id);
          return (
            <button
              key={area.id}
              type="button"
              data-testid={`grid-area-${name}`}
              className="grid-area-cell"
              title={`${name} — click to remove`}
              onClick={() =>
                onStateChange({
                  ...state,
                  areas: state.areas.filter((a) => a.id !== area.id),
                })
              }
              style={{
                gridRow: `${area.rowStart} / span ${area.rowSpan}`,
                gridColumn: `${area.colStart} / span ${area.colSpan}`,
                border: '2px dashed var(--accent, #6366f1)',
                background: 'color-mix(in srgb, var(--accent, #6366f1) 12%, transparent)',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                cursor: 'grab',
                color: 'inherit',
                fontWeight: 600,
              }}
            >
              {name}
            </button>
          );
        })}
        {/* dotted placeholders for empty cells */}
        {Array.from({ length: Math.max(0, cellCount) }).map((_, i) => {
          const r = Math.floor(i / state.columns.length) + 1;
          const c = (i % state.columns.length) + 1;
          return (
            <div
              key={`ph-${i}`}
              data-testid={`grid-place-${r}-${c}`}
              className="grid-placeholder"
              style={{
                gridRow: `${r} / span 1`,
                gridColumn: `${c} / span 1`,
                border: '1px dotted var(--border, #a1a1aa)',
                borderRadius: 6,
                minHeight: 40,
                opacity: 0.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                color: 'var(--muted-foreground, #71717a)',
              }}
            >
              {r}/{c}
            </div>
          );
        })}
        {/* area cells render after placeholders so they layer on top */}
      </div>
    </div>
  );
};

export const ToolCanvas = Canvas;
export default Canvas;
