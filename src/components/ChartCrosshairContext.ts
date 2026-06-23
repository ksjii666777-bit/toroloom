import React, { createContext, useContext } from 'react';

interface ChartCrosshairContextType {
  /** The data index the crosshair is on, or null if hidden */
  focusedIndex: number | null;
  /** Set the crosshair to a specific data index */
  setFocusedIndex: (index: number | null) => void;
}

export const ChartCrosshairContext = createContext<ChartCrosshairContextType>({
  focusedIndex: null,
  setFocusedIndex: () => {},
});

export const useChartCrosshair = () => useContext(ChartCrosshairContext);
