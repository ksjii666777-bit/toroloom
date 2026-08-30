/**
 * ============================================================================
 * Toroloom — Drawing Templates Store
 * ============================================================================
 *
 * Pre-built drawing templates for quick chart analysis:
 *   - Support/Resistance levels
 *   - Fibonacci retracement
 *   - Trend channels
 *   - Custom user templates
 *
 * ============================================================================
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DrawingAnnotation, DrawingPoint } from '../components/chart/DrawingTools';

// ── Types ──────────────────────────────────────────────────────────────────

export interface DrawingTemplate {
  id: string;
  name: string;
  description: string;
  category: 'preset' | 'custom';
  icon: string;
  drawings: Omit<DrawingAnnotation, 'id' | 'createdAt'>[];
  createdAt: number;
}

export interface DrawingTemplatesState {
  /** All available templates */
  templates: DrawingTemplate[];
  /** Whether data has been loaded */
  initialized: boolean;

  // ── Actions ──
  /** Apply a template to current chart (generates drawings with proper IDs) */
  applyTemplate: (templateId: string, spotPrice: number) => DrawingAnnotation[];
  /** Save current drawings as a custom template */
  saveAsTemplate: (
    name: string,
    description: string,
    drawings: DrawingAnnotation[],
  ) => void;
  /** Delete a custom template */
  deleteTemplate: (templateId: string) => void;
  /** Get templates by category */
  getTemplatesByCategory: (category: 'preset' | 'custom') => DrawingTemplate[];
  /** Load from AsyncStorage */
  loadFromStorage: () => Promise<void>;
  /** Persist to AsyncStorage */
  saveToStorage: () => Promise<void>;
}

// ── Storage Key ────────────────────────────────────────────────────────────

const STORAGE_KEY = '@toroloom_drawing_templates';

// ── Helpers ────────────────────────────────────────────────────────────────

function generateId(): string {
  return `tmpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function makePoint(price: number, offsetIndex: number = 0): DrawingPoint {
  return {
    dataIndex: offsetIndex,
    x: 0,
    y: 0,
    price: Math.round(price * 100) / 100,
  };
}

// ── Pre-built Templates ────────────────────────────────────────────────────

const PRESET_TEMPLATES: DrawingTemplate[] = [
  {
    id: 'preset_support_resistance',
    name: 'Support & Resistance',
    description: 'Three horizontal lines for key S/R levels based on spot price',
    category: 'preset',
    icon: '━',
    drawings: [
      {
        type: 'horizontal_line',
        points: [makePoint(0)], // Will be calculated at apply time
        color: '#00E676',
        label: 'Support',
      },
      {
        type: 'horizontal_line',
        points: [makePoint(0)],
        color: '#FF5252',
        label: 'Resistance',
      },
    ],
    createdAt: 0,
  },
  {
    id: 'preset_fibonacci_retracement',
    name: 'Fibonacci Retracement',
    description: 'Fibonacci levels from recent swing high to low',
    category: 'preset',
    icon: 'φ',
    drawings: [
      {
        type: 'fibonacci',
        points: [makePoint(0), makePoint(0)],
        color: '#8B5CF6',
        fibLevels: [
          { level: 0, price: 0 },
          { level: 0.236, price: 0 },
          { level: 0.382, price: 0 },
          { level: 0.5, price: 0 },
          { level: 0.618, price: 0 },
          { level: 0.786, price: 0 },
          { level: 1, price: 0 },
        ],
      },
    ],
    createdAt: 0,
  },
  {
    id: 'preset_trend_channel',
    name: 'Trend Channel',
    description: 'Parallel trendlines forming a channel',
    category: 'preset',
    icon: '╱',
    drawings: [
      {
        type: 'trendline',
        points: [makePoint(0), makePoint(0)],
        color: '#3B82F6',
        label: 'Upper Trend',
      },
      {
        type: 'trendline',
        points: [makePoint(0), makePoint(0)],
        color: '#3B82F6',
        label: 'Lower Trend',
      },
    ],
    createdAt: 0,
  },
  {
    id: 'preset_pivot_points',
    name: 'Pivot Points',
    description: 'Classic pivot points (R2, R1, Pivot, S1, S2)',
    category: 'preset',
    icon: '⊕',
    drawings: [
      {
        type: 'horizontal_line',
        points: [makePoint(0)],
        color: '#FF5252',
        label: 'R2',
      },
      {
        type: 'horizontal_line',
        points: [makePoint(0)],
        color: '#FF8A65',
        label: 'R1',
      },
      {
        type: 'horizontal_line',
        points: [makePoint(0)],
        color: '#FFD54F',
        label: 'Pivot',
      },
      {
        type: 'horizontal_line',
        points: [makePoint(0)],
        color: '#81C784',
        label: 'S1',
      },
      {
        type: 'horizontal_line',
        points: [makePoint(0)],
        color: '#00E676',
        label: 'S2',
      },
    ],
    createdAt: 0,
  },
  {
    id: 'preset_vwap_bands',
    name: 'VWAP + Bands',
    description: 'VWAP with upper and lower bands (±1σ)',
    category: 'preset',
    icon: '≋',
    drawings: [
      {
        type: 'horizontal_line',
        points: [makePoint(0)],
        color: '#FFD54F',
        label: 'VWAP',
      },
      {
        type: 'horizontal_line',
        points: [makePoint(0)],
        color: '#FF8A65',
        label: '+1σ',
      },
      {
        type: 'horizontal_line',
        points: [makePoint(0)],
        color: '#81C784',
        label: '-1σ',
      },
    ],
    createdAt: 0,
  },
  {
    id: 'preset_gap_levels',
    name: 'Gap Fill Levels',
    description: 'Mark gap up/down fill levels',
    category: 'preset',
    icon: '⇅',
    drawings: [
      {
        type: 'horizontal_line',
        points: [makePoint(0)],
        color: '#00E676',
        label: 'Gap Bottom',
      },
      {
        type: 'horizontal_line',
        points: [makePoint(0)],
        color: '#FF5252',
        label: 'Gap Top',
      },
    ],
    createdAt: 0,
  },
];

// ── Template Application Logic ─────────────────────────────────────────────

function applyTemplateToSpotPrice(
  template: DrawingTemplate,
  spotPrice: number,
): DrawingAnnotation[] {
  const now = Date.now();
  let idCounter = 0;

  return template.drawings.map((drawing) => {
    const id = `tmpl_${now}_${idCounter++}`;

    switch (drawing.type) {
      case 'horizontal_line': {
        // For support/resistance, place at spot price ± percentage
        let price = spotPrice;
        const label = drawing.label?.toLowerCase() || '';

        if (label.includes('support')) {
          price = spotPrice * 0.97; // 3% below
        } else if (label.includes('resistance')) {
          price = spotPrice * 1.03; // 3% above
        } else if (label === 'r2') {
          price = spotPrice * 1.04;
        } else if (label === 'r1') {
          price = spotPrice * 1.02;
        } else if (label === 'pivot') {
          price = spotPrice;
        } else if (label === 's1') {
          price = spotPrice * 0.98;
        } else if (label === 's2') {
          price = spotPrice * 0.96;
        } else if (label === 'vwap') {
          price = spotPrice;
        } else if (label === '+1σ') {
          price = spotPrice * 1.015;
        } else if (label === '-1σ') {
          price = spotPrice * 0.985;
        } else if (label === 'gap bottom') {
          price = spotPrice * 0.95;
        } else if (label === 'gap top') {
          price = spotPrice * 1.05;
        }

        return {
          id,
          type: 'horizontal_line' as const,
          points: [makePoint(price)],
          color: drawing.color,
          label: drawing.label,
          createdAt: now,
        };
      }

      case 'fibonacci': {
        // For fibonacci, use spot price as the range
        const high = spotPrice * 1.05;
        const low = spotPrice * 0.95;
        const fibLevels = [
          { level: 0, price: high },
          { level: 0.236, price: high - (high - low) * 0.236 },
          { level: 0.382, price: high - (high - low) * 0.382 },
          { level: 0.5, price: high - (high - low) * 0.5 },
          { level: 0.618, price: high - (high - low) * 0.618 },
          { level: 0.786, price: high - (high - low) * 0.786 },
          { level: 1, price: low },
        ];

        return {
          id,
          type: 'fibonacci' as const,
          points: [
            makePoint(high, 0),
            makePoint(low, 10),
          ],
          color: drawing.color,
          fibLevels,
          createdAt: now,
        };
      }

      case 'trendline': {
        // For trend channel, create parallel lines
        const label = drawing.label?.toLowerCase() || '';
        const isUpper = label.includes('upper');

        return {
          id,
          type: 'trendline' as const,
          points: [
            makePoint(spotPrice * (isUpper ? 1.02 : 0.98), 0),
            makePoint(spotPrice * (isUpper ? 1.04 : 0.96), 10),
          ],
          color: drawing.color,
          label: drawing.label,
          createdAt: now,
        };
      }

      default:
        return {
          id,
          ...drawing,
          points: drawing.points.map(p => makePoint(p.price || spotPrice, p.dataIndex)),
          createdAt: now,
        } as DrawingAnnotation;
    }
  });
}

// ── Store ──────────────────────────────────────────────────────────────────

export const useDrawingTemplatesStore = create<DrawingTemplatesState>((set, get) => ({
  templates: [...PRESET_TEMPLATES],
  initialized: false,

  applyTemplate: (templateId, spotPrice) => {
    const template = get().templates.find(t => t.id === templateId);
    if (!template) return [];
    return applyTemplateToSpotPrice(template, spotPrice);
  },

  saveAsTemplate: (name, description, drawings) => {
    const template: DrawingTemplate = {
      id: generateId(),
      name,
      description,
      category: 'custom',
      icon: '📐',
      drawings: drawings.map(d => ({
        type: d.type,
        points: d.points,
        color: d.color,
        label: d.label,
        fibLevels: d.fibLevels,
      })),
      createdAt: Date.now(),
    };

    set(state => ({
      templates: [...state.templates, template],
    }));

    get().saveToStorage().catch(() => {});
  },

  deleteTemplate: (templateId) => {
    // Don't allow deleting presets
    const template = get().templates.find(t => t.id === templateId);
    if (!template || template.category === 'preset') return;

    set(state => ({
      templates: state.templates.filter(t => t.id !== templateId),
    }));

    get().saveToStorage().catch(() => {});
  },

  getTemplatesByCategory: (category) => {
    return get().templates.filter(t => t.category === category);
  },

  loadFromStorage: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const customTemplates = JSON.parse(stored) as DrawingTemplate[];
        set({
          templates: [...PRESET_TEMPLATES, ...customTemplates],
          initialized: true,
        });
      } else {
        set({ initialized: true });
      }
    } catch {
      set({ initialized: true });
    }
  },

  saveToStorage: async () => {
    try {
      const customTemplates = get().templates.filter(t => t.category === 'custom');
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(customTemplates));
    } catch {
      // Storage full or unavailable
    }
  },
}));

// Auto-load on import
useDrawingTemplatesStore.getState().loadFromStorage();
