"use client";

import { useEffect, useRef } from "react";

// An overlay that covers the page is, to the person using it, somewhere they
// went. The browser disagrees: a panel opened from React state alone leaves no
// history entry, so Back does not close it, it leaves the page. On /prospect
// that costs a search that cannot be repeated for free, and the landing spot is
// often /login or /onboarding, which bounce back through a full document load
// and hand back an empty form.
//
// So opening pushes one entry, Back pops it and closes the overlay instead of
// leaving, and closing from the UI pops the entry we pushed so Back is never
// needed twice to get off the page.
export function useHistoryDismiss(open: boolean, onClose: () => void) {
  // onClose is usually an inline arrow. Kept in a ref so the popstate listener
  // does not have to be torn down and rebuilt on every render. Written after
  // the render rather than during it, which is when a ref may be touched.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Is the entry we pushed still on the stack?
  const pushed = useRef(false);
  // Set while we are the ones calling back(), so the popstate that follows is
  // not read as the user asking to close something already closing.
  const selfPop = useRef(false);
  // Cleanups run in declaration order, so the effect below flips this before
  // the push effect's cleanup reads it. That is the only way to tell "the panel
  // closed" from "the page is going away". On the way out we must not call
  // back(), or clicking a nav link with a panel open would yank the user back.
  const unmounting = useRef(false);

  useEffect(() => {
    unmounting.current = false;

    const onPop = () => {
      pushed.current = false;
      if (selfPop.current) {
        selfPop.current = false;
        return;
      }
      onCloseRef.current();
    };

    // Listening for the component's whole life, not just while open: the pop we
    // cause when closing arrives after open is already false, and something has
    // to be there to swallow it.
    window.addEventListener("popstate", onPop);
    return () => {
      unmounting.current = true;
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    // Carrying the router's own state forward matters: Next reloads the whole
    // document on a popstate whose state it does not recognise. Same URL, so
    // nothing in the address bar changes and no route work is triggered.
    window.history.pushState(window.history.state, "");
    pushed.current = true;

    return () => {
      // Already gone, because Back is what closed the panel.
      if (!pushed.current) return;
      pushed.current = false;
      if (unmounting.current) return;
      selfPop.current = true;
      window.history.back();
    };
  }, [open]);
}
