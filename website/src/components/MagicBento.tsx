import { useRef } from 'react';
import type { PropsWithChildren } from 'react';
import './MagicBento.css';

const MagicBento = ({ children }: PropsWithChildren) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(hover: none)').matches) return;
    containerRef.current?.querySelectorAll<HTMLElement>('.magic-bento-card').forEach(card => {
      const rect = card.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      const distance = Math.hypot(event.clientX - (rect.left + rect.width / 2), event.clientY - (rect.top + rect.height / 2));
      const intensity = Math.max(0, 1 - distance / 330);
      card.style.setProperty('--magic-x', `${x}%`);
      card.style.setProperty('--magic-y', `${y}%`);
      card.style.setProperty('--magic-opacity', String(intensity));
      card.style.setProperty('--magic-rx', `${((y - 50) / 50) * -1.2}deg`);
      card.style.setProperty('--magic-ry', `${((x - 50) / 50) * 1.2}deg`);
    });
  };
  const reset = () => containerRef.current?.querySelectorAll<HTMLElement>('.magic-bento-card').forEach(card => {
    card.style.setProperty('--magic-opacity', '0');
    card.style.setProperty('--magic-rx', '0deg');
    card.style.setProperty('--magic-ry', '0deg');
  });
  return <div ref={containerRef} className="magic-bento" onPointerMove={handlePointerMove} onPointerLeave={reset}>{children}</div>;
};

export default MagicBento;
