/**
 * Modals render into `#modal-portal`, an `absolute inset-0` layer over the
 * Layout's `#content-area`. That area is bounded to the viewport (the page
 * scrolls inside `#content-scroll`), so an `absolute inset-0` overlay there is
 * always the visible region below the top bar and a flex-centered modal is
 * centered on screen no matter how far the page is scrolled. On routes without
 * the Layout shell (setup, unlock) there is no portal target: fall back to the
 * body with `fixed` positioning, which is viewport-anchored as well.
 */
export function getModalPortalTarget(): Element {
  return document.getElementById('modal-portal') ?? document.body
}

export function getModalPositionClass(): 'absolute' | 'fixed' {
  return document.getElementById('modal-portal') ? 'absolute' : 'fixed'
}
