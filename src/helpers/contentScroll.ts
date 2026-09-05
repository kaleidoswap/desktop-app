/**
 * The Layout shell is bounded to the viewport and the page scrolls inside
 * `#content-scroll` rather than the window. Multi-step flows that swap their
 * content without changing the route (channel wizards) must reset that scroll
 * themselves, otherwise the next step opens at whatever offset the previous,
 * longer step was scrolled to.
 */
export const CONTENT_SCROLL_ID = 'content-scroll'

export function scrollContentToTop(): void {
  const el = document.getElementById(CONTENT_SCROLL_ID)
  if (el) {
    el.scrollTo({ top: 0 })
  } else {
    window.scrollTo({ top: 0 })
  }
}
