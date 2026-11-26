import '@testing-library/jest-dom'

// Radix Select focuses and scrolls the highlighted option. jsdom has no layout
// or pointer capture, so provide the missing browser methods for interactions.
HTMLElement.prototype.scrollIntoView ??= () => {}
HTMLElement.prototype.hasPointerCapture ??= () => false
