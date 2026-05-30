import { logger } from '@/utils/logger';
import {
  JSBRIDGE_INIT_TIMEOUT,
  JSBRIDGE_DEFAULT_CALL_TIMEOUT,
} from '@/config/constants';

export interface JSBridgeOptions {
  /**
   * The name of the bridge object injected into the window by the native side.
   * @default 'JSBridge'
   */
  bridgeName?: string;
  /**
   * The default timeout in milliseconds for `call` operations.
   * @default 5000
   */
  defaultTimeout?: number;
}

export interface JSBridgeCallOptions {
  /** Overrides the default timeout for this specific call. */
  timeout?: number;
}

export interface JSBridgeInvokeOptions {
  /**
   * A timeout in milliseconds for waiting for the completion event.
   * A value of 0 means no timeout.
   * @default 0
   */
  timeout?: number;
}

/**
 * Protocol constants - MUST match WebViewBridge.java
 */
const BridgeProtocol = {
  DEFAULT_BRIDGE_NAME: 'JSBridge',
  CALLBACK_NAMESPACE_SUFFIX: 'Callbacks',
  CALLBACK_ID_PREFIX: 'cb_',
  INVOKE_CALLBACK_ID_PREFIX: 'invoke_',
} as const;

/**
 * Event constants - MUST match WebViewBridge.java Event
 */
export const NativeEvent = {
  BRIDGE_READY: 'bridge:ready',
  APP_RESUME: 'app:resume',
  APP_PAUSE: 'app:pause',
  SYSTEM_BACK_PRESSED: 'system:backPressed',
  SYSTEM_NETWORK_CHANGE: 'system:networkChange',
  SYSTEM_APPEARANCE_CHANGE: 'system:appearanceChange',
} as const;

export type NativeEvent = typeof NativeEvent[keyof typeof NativeEvent];

/**
 * Custom error class for failures in JSBridge communication.
 * It includes a `code` property for more specific error handling.
 */
export class JSBridgeError extends Error {
  public code: number;
  constructor(message: string, code: number) {
    super(message);
    this.name = 'JSBridgeError';
    this.code = code;
  }
}

interface NativeResponse<T = any> {
  code: number;
  msg?: string;
  data?: T;
}

interface IOSBridge {
  postMessage: (message: { method: string; params: string; callbackId: string }) => void;
}

interface AndroidBridge {
  call: (method: string, params: string, callbackId: string) => void;
}

interface PendingCall {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timer: number;
}

export class JSBridge {
  private static readonly INIT_TIMEOUT = JSBRIDGE_INIT_TIMEOUT;
  private static readonly DEFAULT_CALL_TIMEOUT = JSBRIDGE_DEFAULT_CALL_TIMEOUT;

  private callbackIndex = 0;
  private jsCallbacks: Record<string, PendingCall> = {};
  private bridge: IOSBridge | AndroidBridge | null = null;
  private bridgeType: 'ios' | 'android' | null = null;

  private readonly readyPromise: Promise<void>;
  private readonly boundHandleNativeCallback: (callbackId: string, response: NativeResponse) => void;

  private eventHandlers: Map<string, Set<Function>> = new Map();
  private windowHandlers: Map<string, (e: Event) => void> = new Map();

  private readonly bridgeName: string;
  private readonly callbackNamespace: string;
  private readonly defaultTimeout: number;

  constructor(options: JSBridgeOptions = {}) {
    this.bridgeName = options.bridgeName ?? BridgeProtocol.DEFAULT_BRIDGE_NAME;
    this.callbackNamespace = this.bridgeName + BridgeProtocol.CALLBACK_NAMESPACE_SUFFIX;
    this.defaultTimeout = options.defaultTimeout ?? JSBridge.DEFAULT_CALL_TIMEOUT;
    this.boundHandleNativeCallback = this.handleNativeCallback.bind(this);

    this.readyPromise = this.init();
  }

  private init(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        return reject(new Error('JSBridge can only be used in a browser environment.'));
      }

      if ((window as any)[this.callbackNamespace]) {
        return reject(new Error(`JSBridge callback namespace '${this.callbackNamespace}' already exists on window.`));
      }
      (window as any)[this.callbackNamespace] = this.boundHandleNativeCallback;

      if (this.findBridge()) {
        return resolve();
      }

      let timeoutId: number | null = null;

      const readyHandler = () => {
        if (timeoutId !== null) clearTimeout(timeoutId);
        if (this.findBridge()) {
          resolve();
        } else {
          reject(new Error(`bridge (${this.bridgeName}) not found.`));
        }
      };

      this.once(NativeEvent.BRIDGE_READY, readyHandler);

      timeoutId = window.setTimeout(() => {
        this.off(NativeEvent.BRIDGE_READY, readyHandler);
        reject(new Error(`JSBridge (${this.bridgeName}) initialization timed out.`));
      }, JSBridge.INIT_TIMEOUT);
    });
  }

  private findBridge(): boolean {
    const win = window as any;
    const iosBridge = win.webkit?.messageHandlers?.[this.bridgeName];
    if (iosBridge?.postMessage) {
      this.bridge = iosBridge;
      this.bridgeType = 'ios';
      return true;
    }
    const androidBridge = win[this.bridgeName];
    if (androidBridge?.call) {
      this.bridge = androidBridge;
      this.bridgeType = 'android';
      return true;
    }
    return false;
  }

  private handleNativeCallback(callbackId: string, response: NativeResponse): void {
    const pendingCall = this.jsCallbacks[callbackId];
    if (!pendingCall) return;

    clearTimeout(pendingCall.timer);

    try {
      if (!response) {
        pendingCall.reject(new JSBridgeError('Invalid response from native.', -1));
      } else if (response.code === 0) {
        pendingCall.resolve(response.data);
      } else {
        const error = new JSBridgeError(
          response.msg || `Native call failed with code: ${response.code}`,
          response.code
        );
        pendingCall.reject(error);
      }
    } catch (e) {
      pendingCall.reject(e);
    } finally {
      delete this.jsCallbacks[callbackId];
    }
  }

  private postNativeMessage(method: string, params: any, callbackId: string): void {
    try {
      const paramsString = JSON.stringify(params);
      logger.debug('JSBridge', `Posting message for method '${method}': ${paramsString} (${callbackId})`);
      if (this.bridgeType === 'ios') {
        (this.bridge as IOSBridge).postMessage({ method, params: paramsString, callbackId });
      } else if (this.bridgeType === 'android') {
        (this.bridge as AndroidBridge).call(method, paramsString, callbackId);
      }
    } catch (error) {
      if (this.jsCallbacks[callbackId]) {
        const message = error instanceof Error ? error.message : String(error);
        this.handleNativeCallback(callbackId, {
          code: -1,
          msg: `JSBridge internal error: ${message}`
        });
      } else {
        logger.error('JSBridge', `Failed to post message for method '${method}':`, error);
      }
    }
  }

  private generateUniqueId(): string {
    return `${this.callbackIndex++}_${Date.now().toString(36)}`;
  }

  /**
   * Performs a classic RPC call to the native side, expecting a direct response via a callback.
   * @param method The name of the native method to call.
   * @param params The parameters to pass to the native method.
   * @param options Call-specific options, like overriding the default timeout.
   * @returns A promise that resolves with the data from the native side.
   */
  public async call<T = any>(method: string, params: any = {}, options: JSBridgeCallOptions = {}): Promise<T> {
    await this.readyPromise;

    return new Promise<T>((resolve, reject) => {
      const callbackId = `${BridgeProtocol.CALLBACK_ID_PREFIX}${this.generateUniqueId()}`;
      const timeout = options.timeout ?? this.defaultTimeout;

      if (timeout <= 0) {
        return reject(new Error('A timeout > 0 is required for `call`. For non-timeout operations, use `invoke`.'));
      }

      const timer = window.setTimeout(() => {
        this.handleNativeCallback(callbackId, {
          code: -1,
          msg: `Call to '${method}' timed out after ${timeout}ms.`,
        });
      }, timeout);

      this.jsCallbacks[callbackId] = { resolve, reject, timer };
      this.postNativeMessage(method, params, callbackId);
    });
  }

  /**
   * Invokes a native command and waits for a global event to signal completion.
   * Ideal for native operations with uncertain duration, such as user interactions (e.g., file picking).
   * @param method The name of the native method to invoke.
   * @param params The parameters to pass to the native method.
   * @param options Options to override default behavior, e.g., specifying a `timeout`.
   * @returns A promise that resolves with the data from the dispatched event.
   */
  public async invoke<T = any>(method: string, params: any = {}, options: JSBridgeInvokeOptions = {}): Promise<T> {
    await this.readyPromise;

    return new Promise<T>((resolve, reject) => {
      const { timeout = 0 } = options;
      const uniqueId = this.generateUniqueId();
      const callbackId = `${BridgeProtocol.INVOKE_CALLBACK_ID_PREFIX}${uniqueId}`;
      const eventName = `${method}_${uniqueId}`;

      if (!eventName) {
        return reject(new Error('Could not determine event name for invoke. Please provide a method name or an explicit eventName option.'));
      }

      let timer: number | null = null;

      const handler = (detail: any) => {
        if (timer) clearTimeout(timer);

        if (detail) {
          resolve(detail as T);
        } else {
          reject(new Error(`Invoke of '${method}' failed without detail`));
        }
      };

      this.once(eventName, handler);

      if (timeout > 0) {
        timer = window.setTimeout(() => {
          this.off(eventName, handler);
          reject(new Error(`Waiting for event '${eventName}' from invoke('${method}') timed out after ${timeout}ms.`));
        }, timeout);
      }

      const paramsWithEvent = { ...params, __eventName: eventName };
      this.postNativeMessage(method, paramsWithEvent, callbackId);
    });
  }

  /**
   * Listens for an event dispatched from the native side.
   * @param event The event name to listen for.
   * @param handler The function to execute when the event is triggered.
   */
  public on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());

      const windowHandler = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
          [...handlers].forEach(h => h(detail));
        }
      };

      this.windowHandlers.set(event, windowHandler);
      window.addEventListener(event, windowHandler);
    }

    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Removes an event listener.
   * @param event The event name.
   * @param handler The specific handler to remove. If omitted, all handlers for the event will be removed.
   */
  public off(event: string, handler?: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (!handlers) return;

    if (handler) {
      handlers.delete(handler);
    } else {
      handlers.clear();
    }

    if (handlers.size === 0) {
      const windowHandler = this.windowHandlers.get(event);
      if (windowHandler) {
        window.removeEventListener(event, windowHandler);
        this.windowHandlers.delete(event);
      }
      this.eventHandlers.delete(event);
    }
  }

  /**
   * Listens for an event, but triggers the handler only once.
   * @param event The event name to listen for.
   * @param handler The function to execute.
   */
  public once(event: string, handler: Function): void {
    const onceHandler = (detail: any) => {
      handler(detail);
      this.off(event, onceHandler);
    };
    this.on(event, onceHandler);
  }

  /**
   * Cleans up all resources used by the JSBridge instance and rejects all pending calls.
   * This should be called when the webview is about to be destroyed to prevent memory leaks.
   */
  public destroy(): void {
    this.windowHandlers.forEach((handler, event) => {
      window.removeEventListener(event, handler);
    });
    this.windowHandlers.clear();
    this.eventHandlers.clear();

    const cancellationError = new Error('JSBridge instance was destroyed.');
    Object.values(this.jsCallbacks).forEach(pendingCall => {
      clearTimeout(pendingCall.timer);
      pendingCall.reject(cancellationError);
    });
    this.jsCallbacks = {};

    if ((window as any)[this.callbackNamespace] === this.boundHandleNativeCallback) {
      try {
        delete (window as any)[this.callbackNamespace];
      } catch (e) {
        (window as any)[this.callbackNamespace] = undefined;
      }
    }

    this.bridge = null;
    this.bridgeType = null;
  }
}

export const bridge = new JSBridge();
export default bridge;
