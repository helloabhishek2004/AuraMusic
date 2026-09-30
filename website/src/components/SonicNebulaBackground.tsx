import React, { useEffect, useRef } from 'react';
import SideRays from './SideRays';

export const SonicNebulaBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // Check prefers-reduced-motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Microscopic light dust particles (very sparse, not stars)
    const particleCount = Math.min(24, Math.floor(width / 60));
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.35 + 0.1,
      speedX: (Math.random() - 0.5) * 0.15,
      speedY: -Math.random() * 0.25 - 0.05,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw subtle luminous dust motes
      for (const p of particles) {
        p.x += p.speedX;
        p.y += p.speedY;

        if (p.y < 0) {
          p.y = height;
          p.x = Math.random() * width;
        }
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(218, 185, 255, ${p.alpha})`;
        ctx.shadowColor = 'rgba(191, 90, 242, 0.5)';
        ctx.shadowBlur = 4;
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
      {/* Layer 1: Void Base */}
      <div className="absolute inset-0 bg-[#07070C]" />

      {/* Layer 1.5: React Bits SideRays Volumetric Light Field */}
      <div className="absolute inset-0 w-full h-full pointer-events-none opacity-90 sm:opacity-100 mix-blend-screen overflow-hidden">
        <SideRays
          origin="top-right"
          speed={1.8}
          rayColor1="#BF5AF2"
          rayColor2="#46F5E0"
          intensity={3.6}
          spread={2.4}
          tilt={-6}
          saturation={1.6}
          blend={0.6}
          falloff={1.25}
          opacity={1.0}
        />
      </div>

      {/* Layer 2 & 3: Atmospheric Gradients & Asymmetric Nebula Light */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-[25%] -left-[10%] w-[85vw] h-[85vw] sm:w-[65vw] sm:h-[65vw] max-w-[950px] max-h-[950px] rounded-full opacity-[0.24] blur-[60px] sm:blur-[120px] mix-blend-screen transition-transform duration-[12000ms] ease-out animate-pulse"
          style={{
            background: 'radial-gradient(circle, #BF5AF2 0%, #6F2BBE 45%, transparent 70%)',
            animationDuration: '14s',
          }}
        />

        <div
          className="absolute top-[20%] -right-[15%] w-[80vw] h-[80vw] sm:w-[55vw] sm:h-[55vw] max-w-[850px] max-h-[850px] rounded-full opacity-[0.16] blur-[60px] sm:blur-[130px] mix-blend-screen"
          style={{
            background: 'radial-gradient(circle, #46F5E0 0%, #2F8CFF 50%, transparent 75%)',
          }}
        />

        <div
          className="absolute top-[60%] left-[15%] w-[75vw] h-[75vw] sm:w-[50vw] sm:h-[50vw] max-w-[750px] max-h-[750px] rounded-full opacity-[0.18] blur-[60px] sm:blur-[140px] mix-blend-screen"
          style={{
            background: 'radial-gradient(circle, #DAB9FF 0%, #9B38DA 40%, transparent 70%)',
          }}
        />

        <div
          className="absolute bottom-[-15%] right-[20%] w-[85vw] h-[85vw] sm:w-[60vw] sm:h-[60vw] max-w-[900px] max-h-[900px] rounded-full opacity-[0.20] blur-[60px] sm:blur-[140px] mix-blend-screen"
          style={{
            background: 'radial-gradient(circle, #BF5AF2 0%, #1B143B 60%, transparent 80%)',
          }}
        />
      </div>

      {/* Layer 4: Monochromatic Film Grain */}
      <div className="absolute inset-0 grain-overlay opacity-40 mix-blend-overlay" />

      {/* Layer 5: Vignette Edge Darkening */}
      <div className="absolute inset-0 vignette-overlay opacity-80" />

      {/* Layer 6: Sparse Microscopic Particles Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-60" />
    </div>
  );
};
