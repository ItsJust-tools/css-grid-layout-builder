import { describe, it, expect, beforeEach } from 'vitest';
import {
  isValidTrack,
  buildAreaMatrix,
  gridTemplateAreas,
  generateGridCSS,
  generateSnippet,
  validateAreas,
  areaOverlaps,
  clampStateToTracks,
  presets,
  generateHTML,
} from '@/tool/grid-logic';
import {
  gridTool,
  setTracks,
  addTrack,
  removeTrack,
  setGap,
  upsertArea,
  removeArea,
  applyPresetToState,
  importGridCSS,
  GridToolDefinition,
} from '@/tool/tool-definition';
import type { GridToolState } from '@/tool/types';

function baseState(): GridToolState {
  return {
    version: 1,
    columns: ['1fr', '1fr', '1fr'],
    rows: ['100px', 'auto'],
    columnGap: 10,
    rowGap: 20,
    areas: [],
    breakpoints: [],
    placementMode: 'areas',
  };
}

describe('track transitions', () => {
  it('adding a column extends template columns', () => {
    const s = addTrack(baseState(), 'columns', 'minmax(100px, 1fr)');
    expect(s.columns).toHaveLength(4);
    expect(s.columns[3]).toBe('minmax(100px, 1fr)');
  });

  it('removing a column clamps areas out of range', () => {
    const s = baseState();
    const withArea = upsertArea(s, {
      id: 'a1',
      name: 'main',
      rowStart: 1,
      rowSpan: 1,
      colStart: 3,
      colSpan: 1,
    });
    const removed = removeTrack(withArea, 'columns', 2);
    expect(removed.columns).toHaveLength(2);
    const area = removed.areas.find((a) => a.id === 'a1');
    expect(area?.colStart).toBeLessThanOrEqual(2);
  });

  it('never removes the last track', () => {
    const s: GridToolState = { ...baseState(), columns: ['1fr'], rows: ['1fr'] };
    expect(removeTrack(s, 'columns', 0).columns).toEqual(['1fr']);
    expect(removeTrack(s, 'rows', 0).rows).toEqual(['1fr']);
  });

  it('setTracks validates and replaces rows and columns', () => {
    const s = setTracks(baseState(), 'rows', ['2fr', 'minmax(50px, auto)']);
    expect(s.rows).toEqual(['2fr', 'minmax(50px, auto)']);
  });

  it('row transitions keep template strings coherent', () => {
    let s = baseState();
    s = addTrack(s, 'rows', 'auto');
    s = addTrack(s, 'rows', '1fr');
    expect(s.rows).toEqual(['100px', 'auto', 'auto', '1fr']);
    s = removeTrack(s, 'rows', 0);
    expect(s.rows).toEqual(['auto', 'auto', '1fr']);
  });
});

describe('unit handling', () => {
  it('accepts fr, minmax, auto and px tracks', () => {
    expect(isValidTrack('1fr')).toBe(true);
    expect(isValidTrack('minmax(120px, 1fr)')).toBe(true);
    expect(isValidTrack('auto')).toBe(true);
    expect(isValidTrack('200px')).toBe(true);
    expect(isValidTrack('repeat(3, 1fr)')).toBe(true);
    expect(isValidTrack('not-a-track')).toBe(false);
    expect(isValidTrack('')).toBe(false);
    expect(isValidTrack('1fr 2fr')).toBe(false);
  });

  it('invalid tracks are dropped by clampStateToTracks', () => {
    const s: GridToolState = { ...baseState(), columns: ['1fr', 'bogus!!', '2fr'] };
    expect(clampStateToTracks(s).columns).toEqual(['1fr', '2fr']);
  });

  it('generated CSS is valid for mixed units', () => {
    const css = generateGridCSS(baseState());
    expect(css).toContain('grid-template-columns: 1fr 1fr 1fr;');
    expect(css).toContain('gap: 20px 10px;');
  });

  it('gaps are clamped to 0..64', () => {
    const s = setGap(baseState(), 'column', 500);
    expect(s.columnGap).toBe(64);
    expect(setGap(s, 'row', -5).rowGap).toBe(0);
  });
});

describe('areas', () => {
  it('builds rectangular area matrix', () => {
    const s = baseState();
    const withAreas = upsertArea(
      upsertArea(s, { id: 'a', name: 'header', rowStart: 1, rowSpan: 1, colStart: 1, colSpan: 3 }),
      { id: 'b', name: 'main', rowStart: 2, rowSpan: 1, colStart: 1, colSpan: 2 }
    );
    const matrix = buildAreaMatrix(withAreas);
    expect((matrix[0] ?? []).join(' ')).toBe('header header header');
    expect((matrix[1] ?? []).join(' ')).toBe('main main .');
  });

  it('detects overlaps', () => {
    const s = upsertArea(
      upsertArea(baseState(), { id: 'a', name: 'x', rowStart: 1, rowSpan: 1, colStart: 1, colSpan: 2 }),
      { id: 'b', name: 'y', rowStart: 1, rowSpan: 1, colStart: 2, colSpan: 1 }
    );
    expect(areaOverlaps(s.areas)).toBe(true);
    expect(validateAreas(s)).toContain('Areas overlap on one or more cells');
  });

  it('template areas string quotes rows', () => {
    const s = upsertArea(baseState(), {
      id: 'a',
      name: 'sol o!',
      rowStart: 1,
      rowSpan: 1,
      colStart: 1,
      colSpan: 1,
    });
    expect(gridTemplateAreas(s).split('"')[1]).toContain('sol-o');
  });

  it('removeArea drops by id', () => {
    const s = upsertArea(baseState(), {
      id: 'z',
      name: 'z',
      rowStart: 1,
      rowSpan: 1,
      colStart: 1,
      colSpan: 1,
    });
    expect(removeArea(s, 'z').areas).toHaveLength(0);
  });
});

describe('serialization round-trip', () => {
  const def = new GridToolDefinition();

  it('serialize then deserialize preserves state losslessly', () => {
    let s = applyPresetToState(baseState(), 'dashboard');
    s = upsertArea(s, { id: 'extra', name: 'extra', rowStart: 1, rowSpan: 1, colStart: 4, colSpan: 1 });
    const serialized = def.serialize(s);
    const parsed = JSON.parse(serialized) as unknown;
    const result = gridTool.deserialize(parsed);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error('deserialize failed');
    expect(result.data).toEqual(s);
  });

  it('rejects invalid payloads', () => {
    expect(gridTool.deserialize({ nope: 1 }).success).toBe(false);
    expect(gridTool.deserialize(null).success).toBe(false);
    expect(def.deserialize('not json').success).toBe(false);
  });

  it('deserializing clamps areas to track bounds', () => {
    const s: GridToolState = {
      ...baseState(),
      areas: [{ id: 'x', name: 'x', rowStart: 9, rowSpan: 3, colStart: 9, colSpan: 3 }],
    };
    const result = gridTool.deserialize(JSON.parse(JSON.stringify(s)));
    expect(result.success).toBe(true);
    if (result.success) {
      const first = result.data.areas[0];
      expect(first?.rowStart).toBe(2);
      expect(first?.colStart).toBe(3);
    }
  });
});

describe('presets', () => {
  it('applyPresetToState replaces layout and each preset is valid', () => {
    for (const id of Object.keys(presets)) {
      const s = applyPresetToState(baseState(), id);
      expect(s).not.toEqual(baseState());
      expect(validateAreas(s)).toEqual([]);
      expect(generateGridCSS(s)).toContain('display: grid;');
    }
  });

  it('unknown preset id is a no-op', () => {
    const s = applyPresetToState(baseState(), 'nope');
    expect(s).toEqual(baseState());
  });

  it('holy grail preset has header/nav/main/aside/footer areas', () => {
    const s = applyPresetToState(baseState(), 'holy-grail');
    const names = s.areas.map((a) => a.name).sort();
    expect(names).toEqual(['aside', 'footer', 'header', 'main', 'nav']);
  });
});

describe('code generation', () => {
  it('areas mode emits grid-template-areas with matching count', () => {
    const s = applyPresetToState(baseState(), 'holy-grail');
    const css = generateGridCSS(s);
    const baseBlock = css.slice(0, css.indexOf('@media'));
    const rowQuotes = (baseBlock.match(/"/g) ?? []).length / 2;
    expect(rowQuotes).toBe(s.rows.length);
    for (const a of s.areas) {
      expect(css).toContain(`grid-area: ${a.name};`);
    }
  });

  it('lines mode emits line-based placement', () => {
    const s = { ...applyPresetToState(baseState(), 'sidebar'), placementMode: 'lines' as const, areas: [] };
    const css = generateGridCSS(s);
    expect(css).not.toContain('grid-template-areas');
  });

  it('media queries only appear for differing breakpoints', () => {
    const s = applyPresetToState(baseState(), 'holy-grail');
    const css = generateGridCSS(s);
    expect(css).toContain('@media all {');
    // identical breakpoint produces no media query
    const same: GridToolState = {
      ...s,
      breakpoints: [
        { id: 'x', label: 'x', minWidth: 768, columns: s.columns, rows: s.rows },
      ],
    };
    expect(generateGridCSS(same)).not.toContain('@media (min-width: 768px)');
  });

  it('snippet contains HTML and CSS', () => {
    const s = applyPresetToState(baseState(), 'sidebar');
    const snippet = generateSnippet(s);
    expect(snippet).toContain('<div class="grid">');
    expect(snippet).toContain('<style>');
    expect(snippet).toContain('.area-content');
  });

  it('empty areas yield HTML with no children', () => {
    const html = generateSnippet({ ...baseState(), areas: [] });
    expect(html).toContain('<div class="grid">\n\n</div>');
  });
});

describe('import grid CSS', () => {
  it('reverse-engineers tracks, gaps and areas from template-areas CSS', () => {
    const css = `
.grid {
  display: grid;
  grid-template-columns: 240px 1fr;
  grid-template-rows: auto 1fr;
  gap: 8px 24px;
  grid-template-areas:
    "head head"
    "side main";
}
.area-head { grid-area: head; }
.area-side { grid-area: side; }
.area-main { grid-area: main; }
`;
    const s = importGridCSS(css);
    expect(s.columns).toEqual(['240px', '1fr']);
    expect(s.rows).toEqual(['auto', '1fr']);
    expect(s.columnGap).toBe(24);
    expect(s.rowGap).toBe(8);
    expect(s.areas.map((a) => a.name).sort()).toEqual(['head', 'main', 'side']);
    expect(s.areas.find((a) => a.name === 'head')).toMatchObject({
      rowStart: 1,
      rowSpan: 1,
      colStart: 1,
      colSpan: 2,
    });
    expect(s.placementMode).toBe('areas');
  });

  it('imports line-based placement', () => {
    const css = `
.grid { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 16px; }
.a { grid-row: 1 / span 2; grid-column: 1 / 2; }
.b { grid-row: 1 / 2; grid-column: 2 / 3; }
`;
    const s = importGridCSS(css);
    expect(s.placementMode).toBe('lines');
    const a = s.areas.find((x) => x.name === 'a');
    const b = s.areas.find((x) => x.name === 'b');
    expect(a).toMatchObject({ rowStart: 1, rowSpan: 2, colStart: 1, colSpan: 1 });
    expect(b).toMatchObject({ rowStart: 1, rowSpan: 1, colStart: 2, colSpan: 1 });
  });
});

describe('gridTool contract', () => {
  it('initialState is a fully valid state', () => {
    expect(gridTool.initialState.version).toBe(1);
    expect(gridTool.deserialize(JSON.parse(JSON.stringify(gridTool.initialState))).success).toBe(true);
  });
});

describe('gap helpers', () => {
  it('setGap updates row and column independently', () => {
    const s = setGap(setGap(baseState(), 'row', 5), 'column', 7);
    expect(s.rowGap).toBe(5);
    expect(s.columnGap).toBe(7);
  });
});

describe('beforeEach placeholder', () => {
  beforeEach(() => {
    // parity with other suites
  });
  it('runs', () => {
    expect(true).toBe(true);
  });
});
