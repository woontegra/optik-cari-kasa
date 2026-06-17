export const DEMO_LICENSE_KEY = 'WO-OPTIK-DEMO-2026';

export interface IpcResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export function success<T>(data: T): IpcResult<T> {
  return { success: true, data };
}

export function failure(error: string): IpcResult {
  return { success: false, error };
}
