/**
 * AsyncLocalStorage-контекст запроса.
 * Позволяет сервисам читать IP/UA без передачи через параметры.
 */

import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext {
  return requestContextStorage.getStore() ?? {};
}
