'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { ToolShell, useTool } from '@itsjust/core';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import {
  toolConfig,
  templateBaseVersion,
  ToolCanvas,
  ToolToolbar,
  ToolSidebar,
  gridTool,
  importGridCSS,
  generateSnippet,
} from '@/tool';
import type { GridToolState } from '@/tool';

export default function ToolClient() {
  const ToolShellCompat = ToolShell as unknown as ComponentType<Record<string, unknown>> & {
    Toolbar?: ComponentType<{ children?: ReactNode }>;
    Body?: ComponentType<{ children?: ReactNode }>;
    Sidebar?: ComponentType<{ children?: ReactNode }>;
    Canvas?: ComponentType<{ children?: ReactNode }>;
    StatusBar?: ComponentType<{ children?: ReactNode }>;
  };
  const canvasRef = useRef<HTMLDivElement>(null);
  const tool = useTool<GridToolState>(gridTool, canvasRef);
  const setToolData = tool.state.setData;
  const showToast = tool.toast;
  const [isSharing, setIsSharing] = useState(false);
  const hasLoadedSharedState = useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth > 768 && toolConfig.features.sidebar
  );
  const [copied, setCopied] = useState(false);

  const state = tool.state.data;

  useEffect(() => {
    document.title = toolConfig.name;
  }, []);

  // Load state from a shared URL once.
  useEffect(() => {
    if (hasLoadedSharedState.current) return;
    hasLoadedSharedState.current = true;
    const params = new URLSearchParams(window.location.search);
    const encodedState = params.get('state');
    if (!encodedState) return;
    try {
      const serialized = decompressFromEncodedURIComponent(encodedState);
      if (!serialized) throw new Error('Invalid shared URL');
      const parsed: unknown = JSON.parse(serialized);
      const deserialized = gridTool.deserialize(parsed);
      if (!deserialized.success) throw new Error(deserialized.error);
      setToolData(deserialized.data);
      showToast('Loaded state from shared URL', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load shared URL';
      showToast(message, 'error');
    }
  }, [setToolData, showToast]);

  const handleShare = useCallback(async () => {
    setIsSharing(true);
    try {
      const serialized = gridTool.serialize(tool.state.data);
      const encodedState = compressToEncodedURIComponent(serialized);
      if (!encodedState) throw new Error('Failed to encode state for URL');
      const url = new URL(window.location.href);
      url.searchParams.set('state', encodedState);
      url.searchParams.set('tool', toolConfig.id);
      window.history.replaceState(null, '', url.toString());

      const shareUrl = url.toString();
      if (navigator.share) {
        try {
          await navigator.share({ title: toolConfig.name, url: shareUrl });
          showToast('Shared URL ready', 'success');
          return;
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') return;
        }
      }
      await navigator.clipboard.writeText(shareUrl);
      showToast('Share URL copied to clipboard', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create share URL';
      showToast(message, 'error');
    } finally {
      setIsSharing(false);
    }
  }, [showToast, tool.state.data]);

  const handleCopy = useCallback(async () => {
    try {
      const snippet = generateSnippet(tool.state.data);
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      showToast('HTML+CSS snippet copied', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Copy failed';
      showToast(message, 'error');
    }
  }, [showToast, tool.state.data]);

  const handleImportCSS = useCallback(() => {
    const css = window.prompt('Paste .grid CSS to import:');
    if (!css) return;
    try {
      const imported = importGridCSS(css);
      setToolData(imported);
      showToast('Grid CSS imported', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed';
      showToast(message, 'error');
    }
  }, [setToolData, showToast]);

  const toolbarContent = (
    <>
      <ToolToolbar
        state={state}
        onStateChange={(next) => setToolData(next)}
        onCopy={handleCopy}
        onImportCSS={handleImportCSS}
      />
    </>
  );

  const sidebarContent = (
    <ToolSidebar
      state={state}
      onStateChange={(next) => setToolData(next)}
      onUndo={tool.toolbarActions.onUndo}
      onRedo={tool.toolbarActions.onRedo}
      canUndo={tool.toolbarActions.canUndo}
      canRedo={tool.toolbarActions.canRedo}
    />
  );

  const canvasContent = (
    <ToolCanvas
      canvasRef={canvasRef}
      state={state}
      onStateChange={(next) => setToolData(next)}
    />
  );

  const statusBarContent = (
    <>
      <span
        className={`status-slot status-slot-state ${tool.state.isDirty ? 'status-unsaved' : 'status-saved'}`}
      >
        {tool.state.isDirty ? (
          <>
            <span className="status-saving-dot" />
            Unsaved
          </>
        ) : tool.state.lastSaved ? (
          <>Saved {tool.state.lastSaved}</>
        ) : (
          'Ready'
        )}
      </span>
      <span className="status-slot status-slot-grid-size">
        {state.columns.length}×{state.rows.length}
      </span>
      <span className="status-slot status-slot-tool-version">Tool v{toolConfig.version}</span>
      <span className="status-slot status-slot-template-version">
        Template v{templateBaseVersion}
      </span>
    </>
  );

  const hasLegacySections = Boolean(
    ToolShellCompat.Toolbar &&
      ToolShellCompat.Body &&
      ToolShellCompat.Sidebar &&
      ToolShellCompat.Canvas &&
      ToolShellCompat.StatusBar
  );

  return (
    <ToolShellCompat
      config={toolConfig}
      actions={useMemo(() => tool.toolbarActions, [tool.toolbarActions])}
      sidebarOpen={sidebarOpen}
      onSidebarChange={setSidebarOpen}
      toolbar={toolbarContent}
      sidebar={sidebarContent}
      canvas={canvasContent}
      statusBar={statusBarContent}
    >
      {hasLegacySections
        ? (() => {
            const ToolbarSection = ToolShellCompat.Toolbar as ComponentType<{
              children?: ReactNode;
            }>;
            const BodySection = ToolShellCompat.Body as ComponentType<{ children?: ReactNode }>;
            const SidebarSection = ToolShellCompat.Sidebar as ComponentType<{
              children?: ReactNode;
            }>;
            const CanvasSection = ToolShellCompat.Canvas as ComponentType<{ children?: ReactNode }>;
            const StatusBarSection = ToolShellCompat.StatusBar as ComponentType<{
              children?: ReactNode;
            }>;
            return (
              <>
                <ToolbarSection>{toolbarContent}</ToolbarSection>
                <BodySection>
                  <SidebarSection>{sidebarContent}</SidebarSection>
                  <CanvasSection>{canvasContent}</CanvasSection>
                </BodySection>
                <StatusBarSection>{statusBarContent}</StatusBarSection>
              </>
            );
          })()
        : null}
    </ToolShellCompat>
  );
}
