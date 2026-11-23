import type { Tool, DeserializeResult } from '@itsjust/core';
import { toolConfig } from './tool.config';
import type { GridToolState, GridArea, GridBreakpoint } from './types';
import {
  isGridToolState,
  clampStateToTracks,
  presets,
  applyPreset,
  nextAreaId,
} from './grid-logic';

function defaultState(): GridToolState {
  return (
    applyPreset('sidebar') ?? {
      version: 1,
      columns: ['1fr'],
      rows: ['1fr'],
      columnGap: 16,
      rowGap: 16,
      areas: [],
      breakpoints: [],
      placementMode: 'areas',
    }
  );
}

export const gridTool: Tool<GridToolState> = {
  id: toolConfig.id,
  name: toolConfig.name,
  version: toolConfig.version ?? '1.0.0',
  config: toolConfig as unknown as Tool['config'],
  initialState:
    (toolConfig as { id: string }).id === 'css-grid-layout-builder'
      ? defaultState()
      : defaultState(),
  serialize: (state) => JSON.stringify(clampStateToTracks(state)),
  deserialize: (data: unknown): DeserializeResult<GridToolState> => {
    try {
      if (isGridToolState(data)) {
        return { success: true, data: clampStateToTracks(data) };
      }
      return {
        success: false,
        error: 'Invalid data format: expected a CSS grid layout state',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Deserialization error';
      return { success: false, error: `Failed to deserialize state: ${message}` };
    }
  },
  exporters: [
    { format: 'png', loader: () => import('./exporters/png') },
    { format: 'jpeg', loader: () => import('./exporters/jpeg') },
    { format: 'webp', loader: () => import('./exporters/webp') },
    { format: 'pdf', loader: () => import('./exporters/pdf') },
  ],
};

// ---------------------------------------------------------------------------
// Layout editing operations (pure functions over state)
// ---------------------------------------------------------------------------

export function setTracks(
  state: GridToolState,
  axis: 'rows' | 'columns',
  tracks: string[]
): GridToolState {
  const trimmed = tracks.map((t) => t.trim()).filter(Boolean);
  const next: GridToolState = { ...state, [axis]: trimmed };
  return clampStateToTracks(next);
}

export function addTrack(
  state: GridToolState,
  axis: 'rows' | 'columns',
  value?: string,
  index?: number
): GridToolState {
  const list = state[axis];
  const idx = index === undefined ? list.length : Math.max(0, Math.min(list.length, index));
  const nextList = [...list];
  nextList.splice(idx, 0, value && value.trim() ? value.trim() : '1fr');
  const next: GridToolState = { ...state, [axis]: nextList };
  return clampStateToTracks(next);
}

export function removeTrack(
  state: GridToolState,
  axis: 'rows' | 'columns',
  index: number
): GridToolState {
  const list = state[axis];
  if (list.length <= 1) return state; // keep at least one track
  const idx = Math.max(0, Math.min(list.length - 1, index));
  const nextList = list.filter((_, i) => i !== idx);
  const next: GridToolState = { ...state, [axis]: nextList };
  return clampStateToTracks(next);
}

export function setGap(state: GridToolState, axis: 'row' | 'column', value: number): GridToolState {
  const clamped = Math.max(0, Math.min(64, Math.round(value) || 0));
  return axis === 'row' ? { ...state, rowGap: clamped } : { ...state, columnGap: clamped };
}

export function setPlacementMode(
  state: GridToolState,
  mode: GridToolState['placementMode']
): GridToolState {
  return { ...state, placementMode: mode };
}

export function upsertArea(state: GridToolState, area: GridArea): GridToolState {
  const exists = state.areas.some((a) => a.id === area.id);
  const areas = exists
    ? state.areas.map((a) => (a.id === area.id ? area : a))
    : [...state.areas, { ...area, id: area.id || nextAreaId() }];
  return clampStateToTracks({ ...state, areas });
}

export function removeArea(state: GridToolState, areaId: string): GridToolState {
  return { ...state, areas: state.areas.filter((a) => a.id !== areaId) };
}

export function renameArea(state: GridToolState, areaId: string, name: string): GridToolState {
  return {
    ...state,
    areas: state.areas.map((a) => (a.id === areaId ? { ...a, name } : a)),
  };
}

export function moveArea(
  state: GridToolState,
  areaId: string,
  rowStart: number,
  colStart: number
): GridToolState {
  return clampStateToTracks({
    ...state,
    areas: state.areas.map((a) => (a.id === areaId ? { ...a, rowStart, colStart } : a)),
  });
}

export function resizeArea(
  state: GridToolState,
  areaId: string,
  rowSpan: number,
  colSpan: number
): GridToolState {
  return clampStateToTracks({
    ...state,
    areas: state.areas.map((a) =>
      a.id === areaId ? { ...a, rowSpan: Math.max(1, rowSpan), colSpan: Math.max(1, colSpan) } : a
    ),
  });
}

export function applyPresetToState(state: GridToolState, presetId: string): GridToolState {
  const presetState = applyPreset(presetId);
  return presetState ? clampStateToTracks(presetState) : state;
}

export function presetIds(): string[] {
  return Object.keys(presets);
}

// ---------------------------------------------------------------------------
// Breakpoints
// ---------------------------------------------------------------------------

export function addBreakpoint(state: GridToolState, bp: GridBreakpoint): GridToolState {
  return { ...state, breakpoints: [...(state.breakpoints ?? []), bp] };
}

export function removeBreakpoint(state: GridToolState, bpId: string): GridToolState {
  return { ...state, breakpoints: (state.breakpoints ?? []).filter((b) => b.id !== bpId) };
}

// ---------------------------------------------------------------------------
// Import CSS into state (reverse-engineering)
// ---------------------------------------------------------------------------

export { importGridCSS } from './grid-logic';

/** Class wrapper for tests that prefer instance-style API. */
export class GridToolDefinition {
  initialState: GridToolState = gridTool.initialState;

  serialize(state: GridToolState): string {
    return gridTool.serialize(state);
  }

  deserialize(serialized: string): DeserializeResult<GridToolState> {
    try {
      const parsed: unknown = JSON.parse(serialized);
      return gridTool.deserialize(parsed);
    } catch {
      return {
        success: false,
        error: 'Invalid data format: expected a CSS grid layout state',
      };
    }
  }
}
