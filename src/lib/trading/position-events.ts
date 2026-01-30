/**
 * Position Events Dispatcher
 *
 * Simple event emitter for broadcasting position changes to connected SSE clients
 * Events: open, close, liquidate
 */

export type PositionEventType = 'position.opened' | 'position.closed' | 'position.liquidated';

export interface PositionEvent {
  type: PositionEventType;
  data: {
    positionId: number;
    traderId: number;
    tradingPairId: number;
    tradingPairSymbol?: string;
    timestamp: string;
  };
  timestamp: string;
}

type PositionEventListener = (event: PositionEvent) => void;

class PositionEventDispatcher {
  private listeners: Set<PositionEventListener> = new Set();

  /**
   * Add event listener
   */
  addListener(listener: PositionEventListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove event listener
   */
  removeListener(listener: PositionEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Emit position opened event
   */
  emitPositionOpened(data: {
    positionId: number;
    traderId: number;
    tradingPairId: number;
    tradingPairSymbol?: string;
  }): void {
    this.emit({
      type: 'position.opened',
      data: {
        ...data,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit position closed event
   */
  emitPositionClosed(data: {
    positionId: number;
    traderId: number;
    tradingPairId: number;
    tradingPairSymbol?: string;
  }): void {
    this.emit({
      type: 'position.closed',
      data: {
        ...data,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit position liquidated event
   */
  emitPositionLiquidated(data: {
    positionId: number;
    traderId: number;
    tradingPairId: number;
    tradingPairSymbol?: string;
  }): void {
    this.emit({
      type: 'position.liquidated',
      data: {
        ...data,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: PositionEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[PositionEventDispatcher] Error in listener:', error);
      }
    }
  }
}

/**
 * Global dispatcher instance
 */
let globalDispatcher: PositionEventDispatcher | null = null;

/**
 * Get or create the global dispatcher instance
 */
export function getPositionEventDispatcher(): PositionEventDispatcher {
  if (!globalDispatcher) {
    globalDispatcher = new PositionEventDispatcher();
  }
  return globalDispatcher;
}
