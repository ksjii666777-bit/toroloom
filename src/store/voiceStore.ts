import { create } from 'zustand';

let SpeechModule: any = null;
try {
  SpeechModule = require('expo-speech');
} catch {
  // expo-speech not installed — voice is a no-op
}

export interface VoiceMessage {
  id: string;
  text: string;
  priority: 'high' | 'normal' | 'low';
  category: 'alert' | 'celebration' | 'info' | 'warning';
}

interface VoiceState {
  enabled: boolean;
  rate: number;       // 0.1 - 2.0
  pitch: number;      // 0.5 - 2.0
  queue: VoiceMessage[];
  isSpeaking: boolean;
  lastSpokenAt: Record<string, number>;  // message ID → timestamp (cooldown per message)

  toggleVoice: () => void;
  setRate: (rate: number) => void;
  setPitch: (pitch: number) => void;
  speak: (message: VoiceMessage) => void;
  _processQueue: () => void;
  stop: () => void;
  clearCooldown: (messageId: string) => void;
}

const VOICE_COOLDOWN_MS = 60000; // Don't repeat same message within 1 minute

export const useVoiceStore = create<VoiceState>((set, get) => ({
  enabled: true,
  rate: 0.85,
  pitch: 1.0,
  queue: [],
  isSpeaking: false,
  lastSpokenAt: {},

  toggleVoice: () => set(s => ({ enabled: !s.enabled })),

  setRate: (rate) => set({ rate: Math.max(0.1, Math.min(2.0, rate)) }),

  setPitch: (pitch) => set({ pitch: Math.max(0.5, Math.min(2.0, pitch)) }),

  speak: (message) => {
    const state = get();
    if (!state.enabled) return;

    // Check cooldown
    const lastSpoken = state.lastSpokenAt[message.id];
    if (lastSpoken && Date.now() - lastSpoken < VOICE_COOLDOWN_MS) return;

    // Add to queue
    const newQueue = [...state.queue, message].sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    set({ queue: newQueue });
    set({ lastSpokenAt: { ...state.lastSpokenAt, [message.id]: Date.now() } });

    // Process queue if not already speaking
    if (!state.isSpeaking) {
      get()._processQueue();
    }
  },

  _processQueue: () => {
    const state = get();
    if (state.queue.length === 0 || !state.enabled) {
      set({ isSpeaking: false });
      return;
    }

    const [next, ...rest] = state.queue;
    set({ queue: rest, isSpeaking: true });

    if (SpeechModule?.speak) {
      SpeechModule.speak(next.text, {
        language: 'en-IN',
        rate: state.rate,
        pitch: state.pitch,
        onDone: () => {
          // Process next in queue
          set({ isSpeaking: false });
          get()._processQueue();
        },
        onError: () => {
          // Skip to next on error
          set({ isSpeaking: false });
          get()._processQueue();
        },
      });
    } else {
      // No speech module — simulate brief delay then process next
      setTimeout(() => {
        set({ isSpeaking: false });
        get()._processQueue();
      }, 100);
    }
  },

  stop: () => {
    if (SpeechModule?.stop) {
      SpeechModule.stop();
    }
    set({ queue: [], isSpeaking: false });
  },

  clearCooldown: (messageId) => {
    set(s => {
      const next = { ...s.lastSpokenAt };
      delete next[messageId];
      return { lastSpokenAt: next };
    });
  },
}));

// Voice message definitions
export const VOICE_MESSAGES = {
  stopLossBreached: {
    id: 'stop_loss_breached',
    text: 'Stop-loss triggered. System hard-locked to prevent emotional over-trading. Step away from the terminal.',
    priority: 'high' as const,
    category: 'alert' as const,
  },
  profitTargetHit: {
    id: 'profit_target_hit',
    text: 'Target achieved! Profit captured and safely locked by Toroloom.',
    priority: 'high' as const,
    category: 'celebration' as const,
  },
  lockdownLifted: {
    id: 'lockdown_lifted',
    text: 'Trading limits restored. You may resume normal trading.',
    priority: 'high' as const,
    category: 'info' as const,
  },
  dailyLossWarning: {
    id: 'daily_loss_warning',
    text: 'Warning: Daily loss approaching limit. Consider reducing position size.',
    priority: 'normal' as const,
    category: 'warning' as const,
  },
  imminentBreach: {
    id: 'imminent_breach',
    text: 'Alert: Approaching stop-loss threshold. Prepare to square off positions.',
    priority: 'high' as const,
    category: 'warning' as const,
  },
  marketVolatility: {
    id: 'market_volatility',
    text: 'High volatility detected across markets. Exercise caution with new positions.',
    priority: 'normal' as const,
    category: 'warning' as const,
  },
  portfolioAlert: {
    id: 'portfolio_alert',
    text: 'Portfolio alert: Significant movement detected in your holdings.',
    priority: 'normal' as const,
    category: 'info' as const,
  },
  lockdownExpiring: {
    id: 'lockdown_expiring',
    text: 'Lockdown period ending soon. Trading limits will be restored shortly.',
    priority: 'normal' as const,
    category: 'info' as const,
  },
  goodMorning: {
    id: 'good_morning',
    text: 'Good morning! Markets are open. Stay disciplined and trade smart.',
    priority: 'low' as const,
    category: 'info' as const,
  },
  sessionEnd: {
    id: 'session_end',
    text: 'Market closed for the day. Review your trades and prepare for tomorrow.',
    priority: 'low' as const,
    category: 'info' as const,
  },
};
