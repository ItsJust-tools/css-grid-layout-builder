'use client';

import React from 'react';
import type { GridToolState, GridArea, GridBreakpoint } from '../types';
import {
  presets,
  isValidTrack,
  sanitizeAreaName,
  nextAreaId,
  GRID_ID_PREFIX,
} from '../grid-logic';
import {
  addTrack,
  removeTrack,
  setTracks,
  setGap,
  applyPresetToState,
  upsertArea,
  removeArea,
  addBreakpoint,
  removeBreakpoint,
} from '../tool-definition';

interface SidebarProps {
  state: GridToolState;
  onStateChange: (state: GridToolState) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

const btn = 'tool-btn';
const label = 'tool-label';

/** Sidebar: presets, tracks, gaps, areas editor with mini map, breakpoints. */
export const Sidebar: React.FC<SidebarProps> = ({
  state,
  onStateChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}) => {
  const [newAreaName, setNewAreaName] = React.useState('');
  const [bpLabel, setBpLabel] = React.useState('');
  const [bpWidth, setBpWidth] = React.useState('');

  const rowCount = state.rows.length;
  const colCount = state.columns.length;

  const addArea = () => {
    // find first free cell
    const taken = new Set(state.areas.flatMap((a) => {
      const cells: string[] = [];
      for (let r = a.rowStart; r < a.rowStart + a.rowSpan; r++)
        for (let c = a.colStart; c < a.colStart + a.colSpan; c++) cells.push(`${r}:${c}`);
      return cells;
    }));
    let placed: { r: number; c: number } | null = null;
    for (let r = 1; r <= rowCount && !placed; r++)
      for (let c = 1; c <= colCount && !placed; c++)
        if (!taken.has(`${r}:${c}`)) placed = { r, c };
    const name = sanitizeAreaName(newAreaName || `area-${state.areas.length + 1}`);
    const area: GridArea = {
      id: nextAreaId(),
      name,
      rowStart: placed?.r ?? 1,
      colStart: placed?.c ?? 1,
      rowSpan: 1,
      colSpan: 1,
    };
    onStateChange(upsertArea(state, area));
    setNewAreaName('');
  };

  const handleAddBreakpoint = () => {
    const w = parseInt(bpWidth, 10);
    const bp: GridBreakpoint = {
      id: `bp-${Date.now()}`,
      label: sanitizeAreaName(bpLabel || 'breakpoint'),
      minWidth: Number.isFinite(w) && w > 0 ? w : 0,
      columns: [...state.columns],
      rows: [...state.rows],
    };
    onStateChange(addBreakpoint(state, bp));
    setBpLabel('');
    setBpWidth('');
  };

  return (
    <div className="grid-sidebar p-3 space-y-4 overflow-y-auto" data-testid="grid-sidebar">
      {/* undo/redo */}
      <div className="flex gap-2">
        <button className={btn} onClick={onUndo} disabled={!canUndo} data-testid="undo-btn">
          Undo
        </button>
        <button className={btn} onClick={onRedo} disabled={!canRedo} data-testid="redo-btn">
          Redo
        </button>
      </div>

      {/* presets */}
      <section>
        <h3 className={label}>Presets</h3>
        <div className="flex flex-wrap gap-2">
          {Object.values(presets).map((p) => (
            <button
              key={p.id}
              className={btn}
              data-testid={`preset-${p.id}`}
              onClick={() => onStateChange(applyPresetToState(state, p.id))}
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      {/* tracks */}
      <section>
        <h3 className={label}>Columns</h3>
        {state.columns.map((t, i) => (
          <div key={`col-${i}`} className="flex items-center gap-1 mb-1">
            <input
              data-testid={`col-track-${i}`}
              value={t}
              onChange={(e) => {
                const next = [...state.columns];
                next[i] = e.target.value;
                onStateChange(setTracks(state, 'columns', next));
              }}
              className="tool-input"
              aria-label={`Column track ${i + 1}`}
            />
            <button
              data-testid={`col-remove-${i}`}
              className={btn}
              onClick={() => onStateChange(removeTrack(state, 'columns', i))}
              aria-label={`Remove column track ${i + 1}`}
            >
              ×
            </button>
          </div>
        ))}
        <button
          data-testid="col-add"
          className={btn}
          onClick={() => onStateChange(addTrack(state, 'columns'))}
        >
          + Column
        </button>

        <h3 className={label} style={{ marginTop: 12 }}>
          Rows
        </h3>
        {state.rows.map((t, i) => (
          <div key={`row-${i}`} className="flex items-center gap-1 mb-1">
            <input
              data-testid={`row-track-${i}`}
              value={t}
              onChange={(e) => {
                const next = [...state.rows];
                next[i] = e.target.value;
                onStateChange(setTracks(state, 'rows', next));
              }}
              className="tool-input"
              aria-label={`Row track ${i + 1}`}
            />
            <button
              data-testid={`row-remove-${i}`}
              className={btn}
              onClick={() => onStateChange(removeTrack(state, 'rows', i))}
              aria-label={`Remove row track ${i + 1}`}
            >
              ×
            </button>
          </div>
        ))}
        <button
          data-testid="row-add"
          className={btn}
          onClick={() => onStateChange(addTrack(state, 'rows'))}
        >
          + Row
        </button>
      </section>

      {/* gaps */}
      <section>
        <h3 className={label}>Gaps</h3>
        <label style={{ display: 'block', marginBottom: 4 }}>
          Column gap
          <input
            type="number"
            data-testid="column-gap"
            value={state.columnGap}
            min={0}
            max={64}
            onChange={(e) => onStateChange(setGap(state, 'column', Number(e.target.value)))}
            className="tool-input"
          />
        </label>
        <label style={{ display: 'block' }}>
          Row gap
          <input
            type="number"
            data-testid="row-gap"
            value={state.rowGap}
            min={0}
            max={64}
            onChange={(e) => onStateChange(setGap(state, 'row', Number(e.target.value)))}
            className="tool-input"
          />
        </label>
      </section>

      {/* areas */}
      <section>
        <h3 className={label}>Areas ({state.areas.length})</h3>
        <div className="flex gap-1 mb-2">
          <input
            data-testid="new-area-name"
            value={newAreaName}
            onChange={(e) => setNewAreaName(e.target.value)}
            placeholder="New area name"
            className="tool-input"
            aria-label="New area name"
          />
          <button data-testid="area-add" className={btn} onClick={addArea}>
            Add
          </button>
        </div>
        {/* mini map */}
        <div
          data-testid="area-minimap"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${colCount}, 1fr)`,
            gap: 2,
            marginBottom: 8,
          }}
        >
          {Array.from({ length: rowCount * colCount }).map((_, i) => {
            const r = Math.floor(i / colCount) + 1;
            const c = (i % colCount) + 1;
            const a = state.areas.find(
              (x) => r >= x.rowStart && r < x.rowStart + x.rowSpan && c >= x.colStart && c < x.colStart + x.colSpan
            );
            return (
              <div
                key={`mm-${i}`}
                title={a ? sanitizeAreaName(a.name || GRID_ID_PREFIX + a.id) : `${r}/${c}`}
                style={{
                  height: 18,
                  borderRadius: 3,
                  border: '1px solid var(--border, #d4d4d8)',
                  background: a ? 'var(--accent-subtle, rgba(99,102,241,0.2))' : 'transparent',
                  fontSize: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {a ? sanitizeAreaName(a.name || GRID_ID_PREFIX + a.id).slice(0, 6) : ''}
              </div>
            );
          })}
        </div>
        {state.areas.map((a) => {
          const n = sanitizeAreaName(a.name || GRID_ID_PREFIX + a.id);
          return (
            <div key={a.id} className="flex items-center gap-1 mb-1 flex-wrap">
              <input
                data-testid={`area-name-${a.id}`}
                value={a.name}
                onChange={(e) =>
                  onStateChange({ ...state, areas: state.areas.map((x) => x.id === a.id ? { ...x, name: e.target.value } : x) })
                }
                className="tool-input"
                style={{ flex: '1 1 90px' }}
                aria-label={`Area name for ${n}`}
              />
              <span style={{ fontSize: 11 }}>{`${a.rowStart},${a.colStart} ${a.rowSpan}×${a.colSpan}`}</span>
              <button
                data-testid={`area-row-span-inc-${a.id}`}
                className={btn}
                onClick={() =>
                  onStateChange({
                    ...state,
                    areas: state.areas.map((x) => x.id === a.id ? { ...x, rowSpan: x.rowSpan + 1 } : x),
                  })
                }
                aria-label={`Increase row span of ${n}`}
              >
                r+
              </button>
              <button
                data-testid={`area-col-span-inc-${a.id}`}
                className={btn}
                onClick={() =>
                  onStateChange({
                    ...state,
                    areas: state.areas.map((x) => x.id === a.id ? { ...x, colSpan: x.colSpan + 1 } : x),
                  })
                }
                aria-label={`Increase col span of ${n}`}
              >
                c+
              </button>
              <button
                data-testid={`area-remove-${a.id}`}
                className={btn}
                onClick={() => onStateChange(removeArea(state, a.id))}
                aria-label={`Remove area ${n}`}
              >
                ×
              </button>
            </div>
          );
        })}
      </section>

      {/* breakpoints */}
      <section>
        <h3 className={label}>Breakpoints</h3>
        <div className="flex gap-1 mb-1">
          <input
            data-testid="bp-label"
            value={bpLabel}
            onChange={(e) => setBpLabel(e.target.value)}
            placeholder="Label"
            className="tool-input"
            aria-label="Breakpoint label"
          />
          <input
            data-testid="bp-width"
            value={bpWidth}
            onChange={(e) => setBpWidth(e.target.value)}
            placeholder="min-width"
            className="tool-input"
            style={{ width: 90 }}
            aria-label="Breakpoint min width"
          />
          <button data-testid="bp-add" className={btn} onClick={handleAddBreakpoint}>
            Add
          </button>
        </div>
        {(state.breakpoints ?? []).map((b) => (
          <div key={b.id} className="flex items-center gap-1 mb-1">
            <span style={{ fontSize: 12 }}>
              {b.label} (min {b.minWidth}px)
            </span>
            <button
              data-testid={`bp-remove-${b.id}`}
              className={btn}
              onClick={() => onStateChange(removeBreakpoint(state, b.id))}
              aria-label={`Remove breakpoint ${b.label}`}
            >
              ×
            </button>
          </div>
        ))}
      </section>

      {/* track validation hint */}
      <section>
        <h3 className={label}>Track validity</h3>
        <div data-testid="track-validity" style={{ fontSize: 11 }}>
          {[...state.columns, ...state.rows].map((t, i) =>
            isValidTrack(t) ? null : (
              <div key={i} style={{ color: '#ef4444' }}>
                Invalid track: {t || '(empty)'}
              </div>
            )
          )}
          {isValidTrack(state.columns.join(' ')) && (
            <div style={{ color: '#22c55e' }}>All tracks valid</div>
          )}
        </div>
      </section>
    </div>
  );
};

export const ToolSidebar = Sidebar;
export default Sidebar;
