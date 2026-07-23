/**
 * Mock for react-native-web/Libraries/vendor/emitter/EventEmitter.
 * @react-native-firebase/app imports this internally.
 */

type Listener = (...args: any[]) => void;

class EmitterSubscription {
  listener: Listener;
  remove: () => void;

  constructor(listener: Listener, remove: () => void) {
    this.listener = listener;
    this.remove = remove;
  }
}

export default class EventEmitter {
  private listeners: Map<string, Set<Listener>> = new Map();

  addListener(eventType: string, listener: Listener): EmitterSubscription {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);
    return new EmitterSubscription(listener, () => {
      this.listeners.get(eventType)?.delete(listener);
    });
  }

  removeAllListeners(eventType?: string): void {
    if (eventType) {
      this.listeners.delete(eventType);
    } else {
      this.listeners.clear();
    }
  }

  emit(eventType: string, ...args: any[]): void {
    this.listeners.get(eventType)?.forEach((listener) => {
      listener(...args);
    });
  }

  listenerCount(eventType: string): number {
    return this.listeners.get(eventType)?.size ?? 0;
  }
}
