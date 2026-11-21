// CSS Grid Layout Builder state types.

export interface GridArea {
  id: string;
  name: string;
  /** 1-based row start line */
  rowStart: number;
  rowSpan: number;
  /** 1-based column start line */
  colStart: number;
  colSpan: number;
}

export interface GridBreakpoint {
  id: string;
  label: string;
  /** min-width in px for the media query */
  minWidth: number;
  /** track overrides; undefined keeps base tracks */
  rows?: string[];
  columns?: string[];
  rowGap?: number;
  columnGap?: number;
  /** named-area overrides for this breakpoint */
  areas?: GridArea[];
}

export type GridPlacementMode = 'areas' | 'lines';

export interface GridToolState {
  version: 1;
  /** column track values, e.g. ['160px', '1fr'] */
  columns: string[];
  /** row track values, e.g. ['auto', '1fr', 'auto'] */
  rows: string[];
  columnGap: number;
  rowGap: number;
  /** named areas with span-based placement */
  areas: GridArea[];
  /** responsive breakpoint overrides (base state = widest layout) */
  breakpoints: GridBreakpoint[];
  /** output style for children: named-template-areas or line-based placement */
  placementMode: GridPlacementMode;
}
