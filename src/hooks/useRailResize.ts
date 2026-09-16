import { useCallback, useRef, useState } from 'react';

export const RAIL_LIMITS = { min: 220, max: 520 };

/** Pointer-driven rail resize. Returns handle props plus the live dragging flag. */
export function useRailResize(side: 'left' | 'right', width: number, onChange: (next: number) => void) {
  const [dragging, setDragging] = useState(false);
  const start = useRef({ pointer: 0, width: 0 });

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      start.current = { pointer: event.clientX, width };
      setDragging(true);
    },
    [width],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) return;

      const delta = event.clientX - start.current.pointer;
      const raw = side === 'left' ? start.current.width + delta : start.current.width - delta;

      onChange(Math.round(Math.min(RAIL_LIMITS.max, Math.max(RAIL_LIMITS.min, raw))));
    },
    [dragging, onChange, side],
  );

  const stop = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setDragging(false);
  }, []);

  return {
    dragging,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: stop,
      onPointerCancel: stop,
      'data-dragging': dragging,
      role: 'separator' as const,
      'aria-orientation': 'vertical' as const,
    },
  };
}
