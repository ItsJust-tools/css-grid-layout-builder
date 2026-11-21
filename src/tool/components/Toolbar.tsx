'use client';

import React from 'react';
import type { GridToolState, GridPlacementMode } from '../types';

interface ToolbarProps {
  state: GridToolState;
  onStateChange: (state: GridToolState) => void;
  onCopy: () => void;
  onImportCSS?: () => void;
}

/** Toolbar: placement mode, copy snippet, import CSS. */
export const Toolbar: React.FC<ToolbarProps> = ({ state, onStateChange, onCopy, onImportCSS }) => {
  const setMode = (mode: GridPlacementMode) => onStateChange({ ...state, placementMode: mode });

  return (
    <div
      className="grid-toolbar flex flex-wrap items-center gap-2 p-2"
      role="toolbar"
      aria-label="Grid builder toolbar"
    >
      <button
        data-testid="mode-areas"
        className={state.placementMode === 'areas' ? 'tool-btn active' : 'tool-btn'}
        onClick={() => setMode('areas')}
        aria-pressed={state.placementMode === 'areas'}
      >
        Areas
      </button>
      <button
        data-testid="mode-lines"
        className={state.placementMode === 'lines' ? 'tool-btn active' : 'tool-btn'}
        onClick={() => setMode('lines')}
        aria-pressed={state.placementMode === 'lines'}
      >
        Line-based
      </button>
      <div className="flex-1" />
      {onImportCSS && (
        <button data-testid="import-css" className="tool-btn" onClick={onImportCSS}>
          Import CSS
        </button>
      )}
      <button data-testid="copy-snippet" className="tool-btn primary" onClick={onCopy}>
        Copy HTML+CSS
      </button>
    </div>
  );
};

export const ToolToolbar = Toolbar;
export default Toolbar;
