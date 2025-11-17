#!/usr/bin/env node
/**
 * Robust Event Helpers for BDD Tests
 * Handles timeouts, race conditions, and pending states
 */

const TEST_CONFIG = require('./test-config');

/**
 * Wait for event with proper timeout and race condition handling
 *
 * @param {Socket} socket - Socket.IO client
 * @param {string} eventName - Event to wait for
 * @param {number} timeoutMs - Custom timeout (uses config default if not provided)
 * @param {Function} filter - Optional filter function (data) => boolean
 * @returns {Promise<any>} Event data
 * @throws {Error} On timeout or connection error
 */
function waitForEvent(socket, eventName, timeoutMs = null, filter = null) {
  const timeout = timeoutMs || TEST_CONFIG.events.default;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, handler);
      socket.off('error', errorHandler);
      socket.off('disconnect', disconnectHandler);

      reject(
        new Error(
          `Timeout waiting for event '${eventName}' after ${timeout}ms (pending state)`,
        ),
      );
    }, timeout);

    const handler = data => {
      // Apply filter if provided
      if (filter && !filter(data)) {
        return; // Keep waiting for matching event
      }

      clearTimeout(timer);
      socket.off(eventName, handler);
      socket.off('error', errorHandler);
      socket.off('disconnect', disconnectHandler);
      resolve(data);
    };

    const errorHandler = error => {
      clearTimeout(timer);
      socket.off(eventName, handler);
      socket.off('disconnect', disconnectHandler);
      reject(
        new Error(
          `Socket error while waiting for '${eventName}': ${error.message}`,
        ),
      );
    };

    const disconnectHandler = reason => {
      clearTimeout(timer);
      socket.off(eventName, handler);
      socket.off('error', errorHandler);
      reject(
        new Error(
          `Socket disconnected while waiting for '${eventName}': ${reason}`,
        ),
      );
    };

    // Register listeners BEFORE any operation that triggers the event
    socket.on(eventName, handler);
    socket.on('error', errorHandler);
    socket.on('disconnect', disconnectHandler);
  });
}

/**
 * Wait for event with retry logic
 *
 * @param {Socket} socket - Socket.IO client
 * @param {string} eventName - Event to wait for
 * @param {Function} triggerFn - Function to trigger the event (called on retry)
 * @param {number} maxAttempts - Max retry attempts
 * @returns {Promise<any>} Event data
 */
async function waitForEventWithRetry(
  socket,
  eventName,
  triggerFn,
  maxAttempts = TEST_CONFIG.retry.maxAttempts,
) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (TEST_CONFIG.debug) {
        console.log(
          `[RETRY] Attempt ${attempt}/${maxAttempts} for event '${eventName}'`,
        );
      }

      // Register listener BEFORE trigger
      const promise = waitForEvent(socket, eventName);

      // Trigger event emission
      if (triggerFn) {
        await triggerFn();
      }

      // Wait for event
      const result = await promise;
      return result;
    } catch (error) {
      lastError = error;

      if (attempt < maxAttempts) {
        const backoffMs = TEST_CONFIG.retry.exponential
          ? TEST_CONFIG.retry.backoffMs * Math.pow(2, attempt - 1)
          : TEST_CONFIG.retry.backoffMs;

        if (TEST_CONFIG.debug) {
          console.log(`[RETRY] Failed, waiting ${backoffMs}ms before retry...`);
        }

        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw new Error(`Failed after ${maxAttempts} attempts: ${lastError.message}`);
}

/**
 * Wait for multiple events (Promise.all equivalent for events)
 *
 * @param {Array<{socket, eventName, timeoutMs}>} events - Array of event configs
 * @returns {Promise<Array<any>>} Array of event data
 */
function waitForMultipleEvents(events) {
  return Promise.all(
    events.map(({ socket, eventName, timeoutMs, filter }) =>
      waitForEvent(socket, eventName, timeoutMs, filter),
    ),
  );
}

/**
 * Wait for event with timeout that rejects with "pending" status
 * (Explicitly handles pending state for test clarity)
 *
 * @param {Socket} socket - Socket.IO client
 * @param {string} eventName - Event to wait for
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<{status: 'fulfilled'|'pending', data?: any, reason?: string}>}
 */
async function waitForEventOrPending(
  socket,
  eventName,
  timeoutMs = TEST_CONFIG.events.default,
) {
  try {
    const data = await waitForEvent(socket, eventName, timeoutMs);
    return { status: 'fulfilled', data };
  } catch (error) {
    if (error.message.includes('Timeout')) {
      return { status: 'pending', reason: error.message };
    }
    throw error; // Re-throw non-timeout errors
  }
}

/**
 * Emit and wait for response in single operation
 * (Registers listener BEFORE emit to avoid race condition)
 *
 * @param {Socket} socket - Socket.IO client
 * @param {string} emitEvent - Event to emit
 * @param {any} emitData - Data to emit
 * @param {string} responseEvent - Event to wait for
 * @param {number} timeoutMs - Timeout
 * @returns {Promise<any>} Response data
 */
function emitAndWait(
  socket,
  emitEvent,
  emitData,
  responseEvent,
  timeoutMs = null,
) {
  // Register listener FIRST
  const promise = waitForEvent(socket, responseEvent, timeoutMs);

  // Then emit (avoids race condition)
  socket.emit(emitEvent, emitData);

  return promise;
}

/**
 * Wait for condition with polling
 * (Useful for checking socket.connected, room membership, etc.)
 *
 * @param {Function} conditionFn - Function returning boolean
 * @param {number} timeoutMs - Max wait time
 * @param {number} pollIntervalMs - Poll interval
 * @returns {Promise<void>}
 */
function waitForCondition(
  conditionFn,
  timeoutMs = TEST_CONFIG.events.default,
  pollIntervalMs = 100,
) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkCondition = () => {
      if (conditionFn()) {
        resolve();
        return;
      }

      if (Date.now() - startTime > timeoutMs) {
        reject(new Error(`Condition not met after ${timeoutMs}ms`));
        return;
      }

      setTimeout(checkCondition, pollIntervalMs);
    };

    checkCondition();
  });
}

module.exports = {
  waitForEvent,
  waitForEventWithRetry,
  waitForMultipleEvents,
  waitForEventOrPending,
  emitAndWait,
  waitForCondition,
};
