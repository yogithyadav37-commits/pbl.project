import React, { useRef } from 'react';

interface TiltCard3DProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  glareTone?: 'cobalt' | 'coral' | 'emerald' | 'dark';
}

export const TiltCard3D: React.FC<TiltCard3DProps> = ({
  children,
  className = '',
  maxTilt = 4.5,
  glareTone = 'cobalt',
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const glareRef = useRef<HTMLDivElement | null>(null);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = cardRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;

    const rotY = (px - 0.5) * (maxTilt * 2);
    const rotX = (0.5 - py) * (maxTilt * 2);

    el.style.transform = `perspective(1000px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) translate3d(0, -3px, 0)`;

    if (glareRef.current) {
      const color =
        glareTone === 'coral'
          ? 'rgba(255, 77, 46, 0.14)'
          : glareTone === 'emerald'
          ? 'rgba(16, 185, 129, 0.14)'
          : glareTone === 'dark'
          ? 'rgba(96, 165, 250, 0.18)'
          : 'rgba(26, 75, 255, 0.11)';
      glareRef.current.style.opacity = '1';
      glareRef.current.style.background = `radial-gradient(420px circle at ${(px * 100).toFixed(1)}% ${(py * 100).toFixed(1)}%, ${color}, transparent 68%)`;
    }
  };

  const handlePointerLeave = () => {
    const el = cardRef.current;
    if (el) {
      el.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translate3d(0, 0, 0)';
    }
    if (glareRef.current) {
      glareRef.current.style.opacity = '0';
    }
  };

  return (
    <div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`relative overflow-hidden transition-[transform,box-shadow,border-color] duration-200 ease-out will-change-transform ${className}`}
    >
      <div
        ref={glareRef}
        aria-hidden="true"
        style={{ opacity: 0 }}
        className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-200"
      />
      {children}
    </div>
  );
};
