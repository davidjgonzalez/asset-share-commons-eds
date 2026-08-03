// ASC Core — do not edit. Customize via scripts/asc/configurations.js
// WeakMap to track registered listeners per element
const registeredListeners = new WeakMap();

/**
 * Attaches a delegated event listener to a root element, listening for events
 * that bubble up from descendants matching the given selector.
 * Works like jQuery's .on() method for event delegation.
 *
 * @param {Element} root - The root element to attach the listener to.
 * @param {string} selector - The CSS selector to match descendant elements.
 * @param {string} eventType - The event type to listen for (e.g., 'click').
 * @param {Function} handler - The event handler function. Receives (event, matchedElement).
 * @param {Object} [options] - Optional configuration options.
 * @param {boolean} [options.stopPropagation=true] - Whether to stop event propagation after handling.
 * @param {boolean} [options.capture] - Whether to use event capturing phase.
 * @param {boolean} [options.once] - Whether the listener should be invoked at most once.
 * @param {boolean} [options.passive] - Whether the listener will never call preventDefault().
 * @param {boolean} [options.allowDuplicates=false] - Whether to allow duplicate listeners.
 * @returns {Function} - A function to remove the event listener.
 */
export function delegateEvent(root, selector, eventType, handler, options = {}) {
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

    // Extract custom options and event listener options
    const { stopPropagation = true, allowDuplicates = false, ...listenerOptions } = options;

    
    // Check for duplicate listeners unless allowDuplicates is true
    if (!allowDuplicates) {
        // Initialize listener tracking for this root element if needed
        if (!registeredListeners.has(root)) {
            registeredListeners.set(root, new Map());
        }
        
        const elementListeners = registeredListeners.get(root);
        const listenerKey = `${eventType}::${selector}::${handler.toString()}`;
        
        // If this exact listener already exists, return the existing cleanup function
        if (elementListeners.has(listenerKey)) {
            //console.debug('Duplicate delegated event listener prevented:', { root, selector, eventType });
            return elementListeners.get(listenerKey).cleanup;
        }
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
                
                // Stop propagation if enabled (default behavior)
                if (stopPropagation) {
                    event.stopPropagation();
                }
                
                break;
            }
            el = el.parentElement;
        }
    };

    root.addEventListener(eventType, listener, listenerOptions);

    // Return a function to remove the event listener
    const cleanup = function removeDelegatedEvent() {
        root.removeEventListener(eventType, listener, listenerOptions);
        
        // Remove from tracking map
        if (!allowDuplicates && registeredListeners.has(root)) {
            const elementListeners = registeredListeners.get(root);
            const listenerKey = `${eventType}::${selector}::${handler.toString()}`;
            elementListeners.delete(listenerKey);
            
            // Clean up the WeakMap entry if no more listeners exist
            if (elementListeners.size === 0) {
                registeredListeners.delete(root);
            }
        }
    };

    // Store the listener info for duplicate detection
    if (!allowDuplicates) {
        const elementListeners = registeredListeners.get(root);
        const listenerKey = `${eventType}::${selector}::${handler.toString()}`;
        elementListeners.set(listenerKey, { handler, listener, cleanup });
    }

    return cleanup;
}
