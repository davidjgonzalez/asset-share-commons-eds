// Copyright 2025 David G.
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//     https://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * Attaches a delegated event listener to a root element, listening for events
 * that bubble up from descendants matching the given selector.
 *
 * @param {Element} root - The root element to attach the listener to.
 * @param {string} selector - The CSS selector to match descendant elements.
 * @param {string} eventType - The event type to listen for (e.g., 'click').
 * @param {Function} handler - The event handler function. Receives (event, matchedElement).
 * @param {Object} [options] - Optional event listener options.
 * @returns {Function} - A function to remove the event listener.
 */
export function delegateEvent(root, selector, eventType, handler, options) {
    if (!root || typeof root.addEventListener !== 'function') {
        throw new Error('Root element must be a valid DOM element');
    }
    if (typeof selector !== 'string') {
        throw new Error('Selector must be a string');
    }
    if (typeof eventType !== 'string') {
        throw new Error('Event type must be a string');
    }
    if (typeof handler !== 'function') {
        throw new Error('Handler must be a function');
    }

    const listener = function(event) {
        // Find the closest ancestor (or self) matching the selector, within root
        let el = event.target;
        while (el && el !== root) {
            if (el.matches && el.matches(selector)) {
                // Call handler with 'el' as both 'this' and event.target
                Object.defineProperty(event, 'target', { value: el, configurable: true });
                handler.call(el, event, el);
                break;
            }
            el = el.parentElement;
        }
        // If root itself matches the selector
        if (el === root && root.matches && root.matches(selector)) {
            Object.defineProperty(event, 'target', { value: root, configurable: true });
            handler.call(root, event, root);
        }
    };

    root.addEventListener(eventType, listener, options);

    // Return a function to remove the event listener
    return function removeDelegatedEvent() {
        root.removeEventListener(eventType, listener, options);
    };
}
