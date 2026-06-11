import { ref } from 'vue';
import bridge, {
  JSBridgeError,
  type JSBridgeCallOptions,
  type JSBridgeInvokeOptions,
} from './JSBridge';
import { logger } from '@/utils/logger';

// 特殊错误码处理
const SILENT_ERROR_CODES = new Set([
  10020, // ERR_APP_DISABLED - 租户已被禁用
]);

function showErrorToast(message: string): void {
  // 简单的 console 警告，避免依赖 UI 框架
  logger.warn('JSBridge', message);
}

export function useJSBridge() {
  const loading = ref(false);

  /**
   * 执行一个 RPC 调用，等待 Native 的直接回调。
   * 适用于请求-响应模式的快速操作。
   */
  const call = async <T = unknown>(
    method: string,
    params?: unknown,
    callOptions?: JSBridgeCallOptions
  ): Promise<T> => {
    try {
      loading.value = true;

      const finalOptions: JSBridgeCallOptions = {
        ...callOptions,
        timeout: callOptions?.timeout,
      };

      const result = await bridge.call<T>(method, params, finalOptions);
      logger.debug('JSBridge', `Call success: ${method}`, result);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      logger.error('JSBridge', `Call error: ${method}`, err);

      const isSilent = err instanceof JSBridgeError && SILENT_ERROR_CODES.has(err.code);
      if (!isSilent) {
        showErrorToast(err.message);
      }

      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * 触发一个 Native 操作，并等待一个全局事件来确认完成。
   * 适用于持续时间不确定或需要用户交互的操作。
   */
  const invoke = async <T = unknown>(
    method: string,
    params?: unknown,
    invokeOptions?: JSBridgeInvokeOptions
  ): Promise<T> => {
    try {
      loading.value = true;

      const finalOptions: JSBridgeInvokeOptions = {
        ...invokeOptions,
        timeout: invokeOptions?.timeout,
      };

      const result = await bridge.invoke<T>(method, params, finalOptions);
      logger.debug('JSBridge', `Invoke success: ${method}`, result);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      logger.error('JSBridge', `Invoke error: ${method}`, err);
      showErrorToast(err.message);

      throw err;
    } finally {
      loading.value = false;
    }
  };

  return {
    call,
    invoke,
    loading,
  };
}
