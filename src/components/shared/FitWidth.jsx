import { useRef, useState, useLayoutEffect } from 'react';

/**
 * Shows its children with the full "desktop" layout (e.g. the two-column balance sheet)
 * even on a phone: the layout is drawn `design` px wide and then scaled down to fit the
 * screen. If the screen is still too narrow for a readable size, it scrolls sideways.
 * On wide screens it does nothing. Printing ignores the scaling (see utils/print.js).
 */
export default function FitWidth({ design = 640, minScale = 0.6, children }) {
  const outer = useRef(null);
  const inner = useRef(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(null);

  useLayoutEffect(() => {
    const measure = () => {
      const w = outer.current ? outer.current.clientWidth : design;
      const s = Math.max(minScale, Math.min(1, w / design));
      setScale(s);
      setHeight(inner.current ? inner.current.offsetHeight * s : null);
    };
    measure();
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      if (outer.current) ro.observe(outer.current);
      if (inner.current) ro.observe(inner.current);
    }
    window.addEventListener('resize', measure);
    return () => { if (ro) ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [design, minScale]);

  const shrunk = scale < 1;
  return (
    <div ref={outer} data-fit style={{ overflowX: shrunk ? 'auto' : 'visible', WebkitOverflowScrolling: 'touch' }}>
      <div data-fit-sizer style={shrunk ? { width: design * scale, height: height ?? undefined } : undefined}>
        <div ref={inner} data-fit-inner
          style={shrunk ? { width: design, transform: `scale(${scale})`, transformOrigin: 'top left' } : undefined}>
          {children}
        </div>
      </div>
    </div>
  );
}
