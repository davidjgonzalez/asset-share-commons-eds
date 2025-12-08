/**
 * Attaches a delegated event listener to a root element, listening for events
 * that bubble up from descendants matching the given selector.
 * Works like jQuery's .on() method for event delegation.
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
        
        // Check event.target and its ancestors up to (and including) root
        while (el && el !== root.parentElement) {
            if (el.matches && el.matches(selector)) {
                // Set currentTarget to the matched element and call handler
                // Keep event.target as the original clicked element (like jQuery)
                const originalCurrentTarget = event.currentTarget;
                Object.defineProperty(event, 'currentTarget', { 
                    value: el, 
                    configurable: true,
                    writable: true 
                });
                
                handler.call(el, event, el);
                
                // Restore original currentTarget
                Object.defineProperty(event, 'currentTarget', { 
                    value: originalCurrentTarget, 
                    configurable: true,
                    writable: true 
                });
                break;
            }
            el = el.parentElement;
        }
    };

    root.addEventListener(eventType, listener, options);

    // Return a function to remove the event listener
    return function removeDelegatedEvent() {
        root.removeEventListener(eventType, listener, options);
    };
}
