import type { FeatureFlags } from '@itsjust/core';
import type { GridPlacementMode } from './types';

export const toolConfig = {
  id: 'css-grid-layout-builder',
  name: 'CSS Grid Layout Builder',
  category: 'Design',
  description: 'Visually design CSS grid layouts and export the HTML/CSS code.',
  version: '1.0.0',
  exportFormats: ['png', 'jpeg', 'webp', 'pdf'] as (
    | 'png'
    | 'jpeg'
    | 'webp'
    | 'pdf'
  )[],
  features: {
    export: true,
    autoSave: true,
    undoRedo: true,
    sidebar: true,
    statusBar: true,
    darkMode: true,
  } as FeatureFlags,
  theme: {
    accent: '#6366f1',
    accentHover: '#4f46e5',
    accentSubtle: 'rgba(99, 102, 241, 0.12)',
    brand: 'CSS Grid Layout Builder',
    icon: '▦',
  },
  placementModes: ['areas', 'lines'] as GridPlacementMode[],
};

export const templateBaseVersion = '1.0.0';
