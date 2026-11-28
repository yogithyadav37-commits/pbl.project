import React, { useEffect, useRef, useState } from 'react';

const INTERACTIVE_SELECTOR =
  'button, a, input, select, textarea, [role="button"], [role="tab"], [data-cursor="interactive"]';

export const SmoothCursor: React.FC = () => {
  const dotRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!finePointer || reducedMotion) return;

    setEnabled(true);

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let ringX = targetX;
    let ringY = targetY;
    let dotX = targetX;
    let dotY = targetY;

    let visible = false;
    let hoveringInteractive = false;
    let hoveringCanvas = false;
    let pressing = false;
    let rafId = 0;

    const onPointerMove = (e: PointerEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!visible) {
        visible = true;
        dotX = targetX;
        dotY = targetY;
        ringX = targetX;
        ringY = targetY;
      }

      const el = e.target as HTMLElement | null;
      hoveringCanvas = Boolean(el && el.tagName === 'CANVAS');
      hoveringInteractive = Boolean(el && !hoveringCanvas && el.closest(INTERACTIVE_SELECTOR));
    };

    const onPointerDown = () => {
      pressing = true;
    };

    const onPointerUp = () => {
      pressing = false;
    };

    const onPointerLeave = () => {
      visible = false;
    };

    const animate = () => {
      // Smooth exponential interpolation (zero React re-renders per frame)
      dotX += (targetX - dotX) * 0.42;
      dotY += (targetY - dotY) * 0.42;
      ringX += (targetX - ringX) * 0.16;
      ringY += (targetY - ringY) * 0.16;

      const dotEl = dotRef.current;
      const ringEl = ringRef.current;

      if (dotEl && ringEl) {
        const shouldShow = visible && !hoveringCanvas;
        const dotScale = pressing ? 0.72 : hoveringInteractive ? 1.35 : 1;
        const ringScale = pressing ? 0.8 : hoveringInteractive ? 1.55 : 1;

        dotEl.style.opacity = shouldShow ? '1' : '0';
        dotEl.style.transform = `translate3d(${dotX - 4}px, ${dotY - 4}px, 0) scale(${dotScale})`;
        dotEl.style.backgroundColor = hoveringInteractive ? '#FF4D2E' : '#1A4BFF';

        ringEl.style.opacity = shouldShow ? (hoveringInteractive ? '0.92' : '0.68') : '0';
        ringEl.style.transform = `translate3d(${ringX - 18}px, ${ringY - 18}px, 0) scale(${ringScale})`;
        ringEl.style.borderColor = hoveringInteractive ? '#FF4D2E' : '#1A4BFF';
        ringEl.style.backgroundColor = hoveringInteractive
          ? 'rgba(255, 77, 46, 0.10)'
          : 'rgba(26, 75, 255, 0.06)';
      }

      rafId = requestAnimationFrame(animate);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    document.addEventListener('mouseleave', onPointerLeave, { passive: true });
    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('mouseleave', onPointerLeave);
    };
  }, []);

  if (!enabled) return null;

  return (
    <div
      aria-hidden="true"
      data-testid="smooth-cursor"
      className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden"
    >
      <div
        ref={ringRef}
        style={{ opacity: 0 }}
        className="fixed left-0 top-0 h-9 w-9 rounded-full border-[1.5px] will-change-transform transition-[opacity,border-color,background-color] duration-150"
      />
      <div
        ref={dotRef}
        style={{ opacity: 0 }}
        className="fixed left-0 top-0 h-2 w-2 rounded-full will-change-transform transition-[opacity,background-color] duration-150"
      />
    </div>
  );
};
