/**
 * MOCHEX Multi-Chart Split-Screen Workspace & Synchronization Engine (DEC-075).
 * Adapted from clean Mochex source 5642f5c to native MEXC USDT perpetual symbols/timeframes.
 * Supports 1x1, 2x1 (Vertical Split), 1x2 (Horizontal Split), and 2x2 (Quad Grid)
 * with independent Symbol, Interval, and Crosshair synchronization toggles.
 */

export type GridLayoutMode = "1x1" | "2x1" | "1x2" | "2x2";

export interface ChartPaneConfig {
  id: string;
  symbol: string;
  resolution: string;
}

export interface GridSyncConfig {
  syncSymbol: boolean;
  syncInterval: boolean;
  syncCrosshair: boolean;
}

export interface MultiChartWorkspaceState {
  layoutMode: GridLayoutMode;
  activePaneId: string;
  maximizedPaneId: string | null;
  sync: GridSyncConfig;
  panes: ChartPaneConfig[];
}

const resolutions = new Set(["1m", "5m", "15m", "1h", "4h", "1d"]);
function nativeSymbol(value: string): string {
  if (!/^[A-Z0-9]{1,24}_USDT$/.test(value)) throw Error("Use a native MEXC USDT perpetual symbol");
  return value;
}
function nativeResolution(value: string): string {
  if (!resolutions.has(value)) throw Error("Unsupported MEXC perpetual timeframe");
  return value;
}

export function createInitialMultiChartState(
  primarySymbol = "BTC_USDT",
  primaryResolution = "15m"
): MultiChartWorkspaceState {
  nativeSymbol(primarySymbol);nativeResolution(primaryResolution);
  return {
    layoutMode: "1x1",
    activePaneId: "pane-0",
    maximizedPaneId: null,
    sync: {
      syncSymbol: false,
      syncInterval: false,
      syncCrosshair: false,
    },
    panes: [
      { id: "pane-0", symbol: primarySymbol, resolution: primaryResolution },
      { id: "pane-1", symbol: "ETH_USDT", resolution: "1h" },
      { id: "pane-2", symbol: "SOL_USDT", resolution: "4h" },
      { id: "pane-3", symbol: primarySymbol, resolution: "1d" },
    ],
  };
}

export function getPaneCountForMode(mode: GridLayoutMode): number {
  switch (mode) {
    case "1x1":
      return 1;
    case "2x1":
    case "1x2":
      return 2;
    case "2x2":
      return 4;
  }
}

export function getVisiblePanes(state: MultiChartWorkspaceState): ChartPaneConfig[] {
  const count = getPaneCountForMode(state.layoutMode);
  return state.panes.slice(0, count);
}

export function getActivePane(state: MultiChartWorkspaceState): ChartPaneConfig {
  return (
    state.panes.find((p) => p.id === state.activePaneId) ||
    state.panes[0] || { id: "pane-0", symbol: "BTC_USDT", resolution: "15m" }
  );
}

export function setGridLayoutMode(
  state: MultiChartWorkspaceState,
  mode: GridLayoutMode
): MultiChartWorkspaceState {
  const count = getPaneCountForMode(mode);
  const visibleIds = new Set(state.panes.slice(0, count).map((p) => p.id));
  const nextActiveId = visibleIds.has(state.activePaneId) ? state.activePaneId : "pane-0";

  let nextPanes = [...state.panes];
  const activePane = getActivePane(state);

  if (state.sync.syncSymbol) {
    nextPanes = nextPanes.map((p) => ({ ...p, symbol: activePane.symbol }));
  }
  if (state.sync.syncInterval) {
    nextPanes = nextPanes.map((p) => ({ ...p, resolution: activePane.resolution }));
  }

  return {
    ...state,
    layoutMode: mode,
    activePaneId: nextActiveId,
    maximizedPaneId: null,
    panes: nextPanes,
  };
}

export function updateActivePaneSymbol(
  state: MultiChartWorkspaceState,
  newSymbol: string,
  targetPaneId?: string
): MultiChartWorkspaceState {
  nativeSymbol(newSymbol);
  const idToUpdate = targetPaneId || state.activePaneId;
  const nextPanes = state.panes.map((pane) => {
    if (state.sync.syncSymbol || pane.id === idToUpdate) {
      return { ...pane, symbol: newSymbol };
    }
    return pane;
  });

  return {
    ...state,
    panes: nextPanes,
  };
}

export function updateActivePaneResolution(
  state: MultiChartWorkspaceState,
  newResolution: string,
  targetPaneId?: string
): MultiChartWorkspaceState {
  nativeResolution(newResolution);
  const idToUpdate = targetPaneId || state.activePaneId;
  const nextPanes = state.panes.map((pane) => {
    if (state.sync.syncInterval || pane.id === idToUpdate) {
      return { ...pane, resolution: newResolution };
    }
    return pane;
  });

  return {
    ...state,
    panes: nextPanes,
  };
}

export function toggleGridSyncOption(
  state: MultiChartWorkspaceState,
  key: keyof GridSyncConfig
): MultiChartWorkspaceState {
  const nextVal = !state.sync[key];
  const nextSync: GridSyncConfig = {
    ...state.sync,
    [key]: nextVal,
  };

  const activePane = getActivePane(state);
  let nextPanes = [...state.panes];

  if (key === "syncSymbol" && nextVal) {
    nextPanes = nextPanes.map((p) => ({ ...p, symbol: activePane.symbol }));
  }
  if (key === "syncInterval" && nextVal) {
    nextPanes = nextPanes.map((p) => ({ ...p, resolution: activePane.resolution }));
  }

  return {
    ...state,
    sync: nextSync,
    panes: nextPanes,
  };
}

export function toggleMaximizePane(
  state: MultiChartWorkspaceState,
  paneId?: string
): MultiChartWorkspaceState {
  if (state.layoutMode === "1x1") {
    return { ...state, maximizedPaneId: null };
  }
  const target = paneId || state.activePaneId;
  return {
    ...state,
    activePaneId: target,
    maximizedPaneId: state.maximizedPaneId === target ? null : target,
  };
}
