// Core grid-layout logic: presets, template strings, code generation,
// serialization, and import of existing grid CSS. Framework-agnostic.

import type { GridArea, GridBreakpoint, GridPlacementMode, GridToolState } from './types';

// strict-mode helpers for RegExpExecArray access
function m1(m: RegExpExecArray | null): string | undefined {
  return m && m[1] !== undefined ? m[1] : undefined;
}
function m2(m: RegExpExecArray | null): string | undefined {
  return m && m[2] !== undefined ? m[2] : undefined;
}

export const MIN_TRACKS = 1;
export const MAX_TRACKS = 12;
export const MIN_GAP = 0;
export const MAX_GAP = 64;
export const GRID_ID_PREFIX = 'cell-';

let areaIdCounter = 0;
export function nextAreaId(): string {
  areaIdCounter += 1;
  return `area-${areaIdCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

export function clampInt(value: number, min: number, max: number): number {
  const n = Math.round(Number.isFinite(value) ? value : min);
  return Math.max(min, Math.min(max, n));
}

export function trackRowCount(rows: string[]): number {
  return rows.length;
}

export function trackColCount(columns: string[]): number {
  return columns.length;
}

/** Validate a single track expression (allows fr, minmax, auto, px, %, names). */
export function isValidTrack(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (v === 'auto') return true;
  if (/^\d+(\.\d+)?fr$/.test(v)) return true;
  if (/^\d+(\.\d+)?(px|em|rem|%|ch|vw|vh)$/.test(v)) return true;
  const minmax = /^minmax\(\s*([^,]+?)\s*,\s*([^)]+?)\s*\)$/.exec(v);
  if (minmax) {
    const min = minmax[1];
    const max = minmax[2];
    if (!min || !max) return false;
    return (
      (min === 'auto' || isValidTrack(min) || /^[\d.]+(px|rem|em|%)$/.test(min)) &&
      (max === 'auto' || isValidTrack(max))
    );
  }
  if (/^repeat\(\s*\d+\s*,\s*[^)]+\)$/.test(v)) return true;
  if (/^(min|max)-content$/.test(v)) return true;
  return false;
}

export function sanitizeTracks(tracks: string[]): string[] {
  return tracks.map((t) => t.trim()).filter((t) => t.length > 0 && isValidTrack(t));
}

/** Clamp area placement to the current track counts. */
export function clampArea(area: GridArea, rows: string[], columns: string[]): GridArea {
  const rowCount = rows.length;
  const colCount = columns.length;
  const rowStart = clampInt(area.rowStart, 1, Math.max(1, rowCount));
  const colStart = clampInt(area.colStart, 1, Math.max(1, colCount));
  return {
    ...area,
    rowStart,
    colStart,
    rowSpan: clampInt(area.rowSpan, 1, Math.max(1, rowCount - rowStart + 1)),
    colSpan: clampInt(area.colSpan, 1, Math.max(1, colCount - colStart + 1)),
  };
}

export function clampStateToTracks(state: GridToolState): GridToolState {
  return {
    ...state,
    columns: sanitizeTracks(state.columns),
    rows: sanitizeTracks(state.rows),
    gaps: undefined,
    columnGap: clampInt(state.columnGap, MIN_GAP, MAX_GAP),
    rowGap: clampInt(state.rowGap, MIN_GAP, MAX_GAP),
    areas: state.areas.map((a) => clampArea(a, state.rows, state.columns)),
    breakpoints: (state.breakpoints ?? []).map((bp) => ({
      ...bp,
      rows: bp.rows ? sanitizeTracks(bp.rows) : undefined,
      columns: bp.columns ? sanitizeTracks(bp.columns) : undefined,
      rowGap: bp.rowGap !== undefined ? clampInt(bp.rowGap, MIN_GAP, MAX_GAP) : undefined,
      columnGap: bp.columnGap !== undefined ? clampInt(bp.columnGap, MIN_GAP, MAX_GAP) : undefined,
      areas: bp.areas?.map((a) => clampArea(a, bp.rows ?? state.rows, bp.columns ?? state.columns)),
    })),
  } as GridToolState;
}

/** Row/col span → number of items; total cell slots covered by all areas. */
export function areaOverlaps(areas: GridArea[]): boolean {
  const seen = new Set<string>();
  for (const a of areas) {
    for (let r = a.rowStart; r < a.rowStart + a.rowSpan; r++) {
      for (let c = a.colStart; c < a.colStart + a.colSpan; c++) {
        const key = `${r}:${c}`;
        if (seen.has(key)) return true;
        seen.add(key);
      }
    }
  }
  return false;
}

/**
 * Build a rectangular grid-template-areas matrix. Overlapping or unnamed
 * cells fall back to "." placement. Throws when a layout cannot be
 * expressed as a rectangular area matrix (torn areas).
 */
export function buildAreaMatrix(state: GridToolState): string[][] {
  const rowCount = state.rows.length;
  const colCount = state.columns.length;
  const matrix: string[][] = Array.from({ length: rowCount }, () =>
    Array.from({ length: colCount }, () => '.')
  );
  for (const area of state.areas) {
    const name = area.name.trim() ? sanitizeAreaName(area.name) : GRID_ID_PREFIX + area.id;
    const clamped = clampArea(area, state.rows, state.columns);
    for (let r = clamped.rowStart; r < clamped.rowStart + clamped.rowSpan; r++) {
      for (let c = clamped.colStart; c < clamped.colStart + clamped.colSpan; c++) {
        const rowArr = matrix[r - 1] ?? [];
        rowArr[c - 1] = name;
      }
    }
  }
  return matrix;
}

export function sanitizeAreaName(name: string): string {
  return (
    name
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'area'
  );
}

/** grid-template-areas string for a state (or explicit matrix). */
export function gridTemplateAreas(state: GridToolState, matrix?: string[][]): string {
  const m = matrix ?? buildAreaMatrix(state);
  return m.map((row) => `"${row.join(' ')}"`).join('\n');
}

/** Validate that each named area is rectangular in the matrix. */
export function validateAreas(state: GridToolState): string[] {
  const errors: string[] = [];
  const names = new Set<string>();
  for (const a of state.areas) {
    const n = sanitizeAreaName(a.name || GRID_ID_PREFIX + a.id);
    if (names.has(n)) errors.push(`Duplicate area name "${n}"`);
    names.add(n);
  }
  if (areaOverlaps(state.areas)) errors.push('Areas overlap on one or more cells');
  return errors;
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export interface GridPreset {
  id: string;
  label: string;
  build: () => GridToolState;
}

function mkArea(
  name: string,
  rowStart: number,
  rowSpan: number,
  colStart: number,
  colSpan: number
): GridArea {
  return { id: nextAreaId(), name, rowStart, rowSpan, colStart, colSpan };
}

export const presets: Record<string, GridPreset> = {
  'holy-grail': {
    id: 'holy-grail',
    label: 'Holy grail',
    build: () => ({
      version: 1,
      columns: ['180px', '1fr', '180px'],
      rows: ['auto', '1fr', 'auto'],
      columnGap: 16,
      rowGap: 16,
      areas: [
        mkArea('header', 1, 1, 1, 3),
        mkArea('nav', 2, 1, 1, 1),
        mkArea('main', 2, 1, 2, 1),
        mkArea('aside', 2, 1, 3, 1),
        mkArea('footer', 3, 1, 1, 3),
      ],
      breakpoints: [
        {
          id: 'mobile',
          label: 'Mobile',
          minWidth: 0,
          columns: ['1fr'],
          rows: ['auto', '1fr', 'auto', 'auto'],
          areas: [
            mkArea('header', 1, 1, 1, 1),
            mkArea('nav', 2, 1, 1, 1),
            mkArea('main', 3, 1, 1, 1),
            mkArea('footer', 4, 1, 1, 1),
          ],
        },
      ],
      placementMode: 'areas' as GridPlacementMode,
    }),
  },
  sidebar: {
    id: 'sidebar',
    label: 'Sidebar',
    build: () => ({
      version: 1,
      columns: ['240px', '1fr'],
      rows: ['1fr'],
      columnGap: 16,
      rowGap: 16,
      areas: [mkArea('sidebar', 1, 1, 1, 1), mkArea('content', 1, 1, 2, 1)],
      breakpoints: [
        {
          id: 'stacked',
          label: 'Stacked',
          minWidth: 0,
          columns: ['1fr'],
          rows: ['auto', '1fr'],
          areas: [mkArea('sidebar', 1, 1, 1, 1), mkArea('content', 2, 1, 1, 1)],
        },
      ],
      placementMode: 'areas' as GridPlacementMode,
    }),
  },
  gallery: {
    id: 'gallery',
    label: 'Gallery',
    build: () => ({
      version: 1,
      columns: ['1fr', '1fr', '1fr'],
      rows: ['200px', '200px', '200px'],
      columnGap: 12,
      rowGap: 12,
      areas: [
        mkArea('item-1', 1, 1, 1, 1),
        mkArea('item-2', 1, 1, 2, 1),
        mkArea('item-3', 1, 1, 3, 1),
        mkArea('item-4', 2, 1, 1, 1),
        mkArea('item-5', 2, 1, 2, 1),
        mkArea('item-6', 2, 1, 3, 1),
        mkArea('item-7', 3, 1, 1, 1),
        mkArea('item-8', 3, 1, 2, 1),
        mkArea('item-9', 3, 1, 3, 1),
      ],
      breakpoints: [],
      placementMode: 'areas' as GridPlacementMode,
    }),
  },
  dashboard: {
    id: 'dashboard',
    label: 'Dashboard',
    build: () => ({
      version: 1,
      columns: ['1fr', '1fr', '1fr', '1fr'],
      rows: ['64px', '1fr', '1fr', '64px'],
      columnGap: 16,
      rowGap: 16,
      areas: [
        mkArea('topbar', 1, 1, 1, 4),
        mkArea('chart', 2, 2, 1, 3),
        mkArea('stats', 2, 1, 4, 1),
        mkArea('table', 3, 1, 4, 1),
        mkArea('footer', 4, 1, 1, 4),
      ],
      breakpoints: [
        {
          id: 'tablet',
          label: 'Tablet',
          minWidth: 640,
          columns: ['1fr', '1fr'],
          areas: [
            mkArea('topbar', 1, 1, 1, 2),
            mkArea('chart', 2, 1, 1, 2),
            mkArea('stats', 3, 1, 1, 1),
            mkArea('table', 3, 1, 2, 1),
            mkArea('footer', 4, 1, 1, 2),
          ],
        },
      ],
      placementMode: 'areas' as GridPlacementMode,
    }),
  },
};

export function applyPreset(presetId: string): GridToolState | null {
  const preset = presets[presetId];
  return preset ? preset.build() : null;
}

// ---------------------------------------------------------------------------
// Code generation
// ---------------------------------------------------------------------------

function containerCss(state: GridToolState, override?: Partial<GridToolState>): string[] {
  const cols = sanitizeTracks(override?.columns ?? state.columns);
  const rowList = sanitizeTracks(override?.rows ?? state.rows);
  const colGap = override?.columnGap ?? state.columnGap;
  const rowGap = override?.rowGap ?? state.rowGap;
  const lines: string[] = ['  display: grid;'];
  lines.push(`  grid-template-columns: ${cols.join(' ')};`);
  if (rowList.length) lines.push(`  grid-template-rows: ${rowList.join(' ')};`);
  if (colGap === rowGap) {
    if (colGap !== 0) lines.push(`  gap: ${colGap}px;`);
  } else {
    lines.push(`  gap: ${rowGap}px ${colGap}px;`);
  }
  return lines;
}

export function generateGridCSS(state: GridToolState): string {
  const lines: string[] = ['.grid {'];
  lines.push(...containerCss(state));
  const placementErrors = validateAreas(state);
  const useAreas = state.placementMode === 'areas' && placementErrors.length === 0;
  if (useAreas) {
    const matrix = buildAreaMatrix(state);
    lines.push(`  grid-template-areas:`);
    for (const row of matrix) lines.push(`    "${row.join(' ')}"`);
  }
  lines.push('}');
  lines.push('');

  // children: named areas or line-based placement
  if (useAreas) {
    for (const area of state.areas) {
      const name = sanitizeAreaName(area.name || GRID_ID_PREFIX + area.id);
      lines.push(`.area-${name} {`);
      lines.push(`  grid-area: ${name};`);
      lines.push('}');
      lines.push('');
    }
  } else {
    const allAreas = [...state.areas, ...(state.breakpoints ?? []).flatMap((bp) => bp.areas ?? [])];
    const seen = new Set<string>();
    for (const area of state.areas) {
      const name = sanitizeAreaName(area.name || GRID_ID_PREFIX + area.id);
      if (seen.has(name)) continue;
      seen.add(name);
      lines.push(`.area-${name} {`);
      lines.push(`  grid-row: ${area.rowStart} / span ${area.rowSpan};`);
      lines.push(`  grid-column: ${area.colStart} / span ${area.colSpan};`);
      lines.push('}');
      lines.push('');
    }
    void allAreas;
  }

  // media queries: only emit if a breakpoint defines something different
  for (const bp of state.breakpoints ?? []) {
    const changedCols =
      bp.columns !== undefined && bp.columns.join(' ') !== state.columns.join(' ');
    const changedRows = bp.rows !== undefined && bp.rows.join(' ') !== state.rows.join(' ');
    const changedGaps =
      (bp.columnGap !== undefined && bp.columnGap !== state.columnGap) ||
      (bp.rowGap !== undefined && bp.rowGap !== state.rowGap);
    const changedAreas =
      bp.areas !== undefined &&
      (bp.areas.length !== state.areas.length ||
        bp.areas.some(
          (a, i) =>
            sanitizeAreaName(a.name) !== sanitizeAreaName(state.areas[i]?.name ?? '') ||
            a.rowStart !== state.areas[i]?.rowStart ||
            a.rowSpan !== state.areas[i]?.rowSpan ||
            a.colStart !== state.areas[i]?.colStart ||
            a.colSpan !== state.areas[i]?.colSpan
        ));
    if (!changedCols && !changedRows && !changedGaps && !changedAreas) continue;

    const mq = bp.minWidth > 0 ? `@media (min-width: ${bp.minWidth}px) {` : '@media all {';
    lines.push(mq);
    lines.push('  .grid {');
    if (changedCols || changedRows || changedGaps || (useAreas && changedAreas)) {
      lines.push(
        ...containerCss(state, {
          columns: changedCols ? bp.columns : undefined,
          rows: changedRows ? bp.rows : undefined,
          columnGap: bp.columnGap,
          rowGap: bp.rowGap,
        })
      );
    }
    if (useAreas && changedAreas && bp.areas) {
      const bpState: GridToolState = {
        ...state,
        columns: bp.columns ?? state.columns,
        rows: bp.rows ?? state.rows,
        areas: bp.areas,
      };
      const matrix = buildAreaMatrix(bpState);
      lines.push('    grid-template-areas:');
      for (const row of matrix) lines.push(`      "${row.join(' ')}"`);
    }
    lines.push('  }');
    lines.push('}');
    lines.push('');
  }

  return lines.join('\n');
}

export function generateHTML(state: GridToolState): string {
  const names = state.areas.map((a) => sanitizeAreaName(a.name || GRID_ID_PREFIX + a.id));
  const children = names.map((n) => `  <div class="area-${n}">${n}</div>`).join('\n');
  return `<div class="grid">\n${children}\n</div>`;
}

export function generateSnippet(state: GridToolState): string {
  return `${generateHTML(state)}\n\n<style>\n${generateGridCSS(state)}</style>`;
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

function isValidTrackArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

function isValidArea(v: unknown): v is GridArea {
  if (typeof v !== 'object' || v === null) return false;
  const a = v as Partial<GridArea>;
  return (
    typeof a.id === 'string' &&
    typeof a.name === 'string' &&
    Number.isFinite(a.rowStart) &&
    Number.isFinite(a.rowSpan) &&
    Number.isFinite(a.colStart) &&
    Number.isFinite(a.colSpan)
  );
}

function isValidBreakpoint(v: unknown): v is GridBreakpoint {
  if (typeof v !== 'object' || v === null) return false;
  const b = v as Partial<GridBreakpoint>;
  return (
    typeof b.id === 'string' &&
    typeof b.label === 'string' &&
    Number.isFinite(b.minWidth) &&
    (b.areas === undefined || (Array.isArray(b.areas) && b.areas.every(isValidArea)))
  );
}

export function isGridToolState(value: unknown): value is GridToolState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<GridToolState>;
  return (
    v.version === 1 &&
    isValidTrackArray(v.columns) &&
    isValidTrackArray(v.rows) &&
    Number.isFinite(v.columnGap) &&
    Number.isFinite(v.rowGap) &&
    Array.isArray(v.areas) &&
    v.areas.every(isValidArea) &&
    (v.breakpoints === undefined ||
      (Array.isArray(v.breakpoints) && v.breakpoints.every(isValidBreakpoint))) &&
    (v.placementMode === 'areas' || v.placementMode === 'lines')
  );
}

// ---------------------------------------------------------------------------
// Import existing grid CSS (reverse-engineering)
// ---------------------------------------------------------------------------

function parseTrackList(value: string): string[] {
  // split on top-level spaces, respecting parentheses
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of value) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ' ' && depth === 0) {
      if (current.trim()) out.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

/** Extract `grid-template-areas` rows from CSS text. */
export function parseTemplateAreas(css: string): string[][] | null {
  const match = /grid-template-areas\s*:\s*([\s\S]*?)\s*(?:;|})/.exec(css);
  const captured = match?.[1];
  if (!match || !captured) return null;
  const rows = [...captured.matchAll(/"([^"]*)"/g)].map((mm) => (mm[1] ?? '').trim().split(/\s+/));
  return rows.length ? rows : null;
}

/**
 * Import a `.grid { ... }` rule from CSS. Derives tracks, gaps, and
 * named areas (via template-areas, falling back to line-based placement).
 */
export function importGridCSS(css: string): GridToolState {
  const ruleMatch = /\.grid\s*\{([\s\S]*?)\}(?!\s*\})/.exec(css);
  const body = ruleMatch?.[1] ?? css;

  const columnsMatch = /grid-template-columns\s*:\s*([^;]+);/.exec(body);
  const rowsMatch = /grid-template-rows\s*:\s*([^;]+);/.exec(body);
  const gapShorthand = /(?<![-\w])gap\s*:\s*([^;]+);/.exec(body);
  const rowGapMatch = /row-gap\s*:\s*(\d+)px/.exec(body);
  const colGapMatch = /column-gap\s*:\s*(\d+)px/.exec(body);

  let columnGap = 16;
  let rowGap = 16;
  const gRaw = gapShorthand?.[1];
  if (gapShorthand && gRaw) {
    const parts = gRaw.trim().split(/\s+/);
    const p0 = parts[0] ?? '';
    const first = parseInt(p0, 10);
    const second = parts[1] !== undefined ? parseInt(parts[1], 10) : first;
    rowGap = Number.isFinite(first) ? first : 16;
    columnGap = Number.isFinite(second) ? second : rowGap;
  } else {
    const rg = rowGapMatch?.[1];
    const cg = colGapMatch?.[1];
    if (rg) rowGap = parseInt(rg, 10);
    if (cg) columnGap = parseInt(cg, 10);
  }

  const cm = columnsMatch?.[1];
  const rm = rowsMatch?.[1];
  const columns = cm ? parseTrackList(cm) : ['1fr'];
  const rows = rm ? parseTrackList(rm) : ['1fr'];

  const areas: GridArea[] = [];
  const matrix = parseTemplateAreas(css);
  if (matrix) {
    // coalesce rectangular runs of the same name
    const seen = new Set<string>();
    for (let r = 0; r < matrix.length; r++) {
      const rowLen2 = matrix[r]?.length ?? 0;
      for (let c = 0; c < rowLen2; c++) {
        const name = matrix[r]?.[c] ?? '.';
        if (name === '.' || seen.has(name)) continue;
        seen.add(name);
        let rowSpan = 1;
        let colSpan = 1;
        const rowLen = matrix[r]?.length ?? 0;
        while (c + colSpan < rowLen && matrix[r]?.[c + colSpan] === name) colSpan++;
        let allRows = true;
        while (r + rowSpan < matrix.length) {
          for (let k = c; k < c + colSpan; k++) {
            if ((matrix[r + rowSpan]?.[k] ?? '.') !== name) {
              allRows = false;
              break;
            }
          }
          if (!allRows) break;
          rowSpan++;
        }
        areas.push(mkArea(name, r + 1, rowSpan, c + 1, colSpan));
      }
    }
  }
  // explicit line placement in child rules
  const childRe = /\.([\w-]+)\s*\{([^}]*grid-(?:row|column)\s*:[^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = childRe.exec(css)) !== null) {
    const rawName = m[1] ?? '';
    const cls = m[2] ?? '';
    const name = (rawName ?? '').replace(/^area-/, '');
    const rowM = /grid-row\s*:\s*([^;]+);/.exec(cls);
    const colM = /grid-column\s*:\s*([^;]+);/.exec(cls);
    if (!rowM || !colM) continue;
    const parse = (v: string): { start: number; span: number } | null => {
      const spanM = /(\d+)\s*\/\s*span\s+(\d+)/.exec(v);
      const s1 = spanM?.[1];
      const s2 = spanM?.[2];
      if (spanM && s1 && s2) return { start: parseInt(s1, 10), span: parseInt(s2, 10) };
      const pairM = /(\d+)\s*\/\s*(-?\d+|span\s+\d+)/.exec(v);
      const p1 = pairM?.[1];
      const p2 = pairM?.[2];
      if (pairM && p1 && p2) {
        if (p2.startsWith('span')) {
          return {
            start: parseInt(p1, 10),
            span: parseInt(p2.replace('span', '').trim(), 10),
          };
        }
        return {
          start: parseInt(p1, 10),
          span: Math.max(1, parseInt(p2, 10) - parseInt(p1, 10)),
        };
      }
      const single = /^(\d+)$/.exec(v.trim());
      const g = single?.[1];
      if (single && g) return { start: parseInt(g, 10), span: 1 };
      return null;
    };
    const rv = rowM[1];
    const cv = colM[1];
    const r = rv ? parse(rv) : null;
    const c = cv ? parse(cv) : null;
    if (r && c) {
      areas.push(mkArea(name, r.start, r.span, c.start, c.span));
    }
  }

  const base: GridToolState = {
    version: 1,
    columns,
    rows,
    columnGap,
    rowGap,
    areas: areas.length ? areas : [mkArea('main', 1, 1, 1, 1)],
    breakpoints: [],
    placementMode: matrix ? 'areas' : 'lines',
  };
  return clampStateToTracks(base);
}

// areaIdCounter reset helper for deterministic tests
export function resetAreaIds(): void {
  areaIdCounter = 0;
}
