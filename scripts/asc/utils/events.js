/**
 * Delegates an event to a parent element, similar to jQuery's .on().
 * @param {Element|Document} parent - The parent element to attach the event listener to.
 * @param {string} type - The event type (e.g., 'click').
 * @param {string} selector - The selector to match descendants.
 * @param {Function} handler - The event handler function.
 * @returns {Function} - A function to remove the event listener.
 */
export function delegateEvent(parent, type, selector, handler) {
  // Use capture for focus/blur, otherwise bubble
  const useCapture = (type === 'focus' || type === 'blur');
  const listener = function(event) {
    // Traverse up from the event target to the parent, looking for a match
    let target = event.target;
    while (target && target !== parent) {
      if (target.matches && target.matches(selector)) {
        // Set delegateTarget for jQuery-like compatibility
        event.delegateTarget = target;
        handler.call(target, event);
        break;
      }
      target = target.parentElement;
    }
  };
  parent.addEventListener(type, listener, useCapture);

  // Return a function to remove the event listener
  return () => parent.removeEventListener(type, listener, useCapture);
}
