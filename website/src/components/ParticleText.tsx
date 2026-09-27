import { useEffect, useRef } from 'react';
import './ParticleText.css';

interface ParticleTextProps {
  text: string;
  className?: string;
  color?: string;
  highlightColor?: string;
  fontSize?: string;
}

const ParticleText = ({
  text,
  className = '',
  color = '#f7efff',
  highlightColor = '#dab9ff',
  fontSize = 'clamp(2rem, 5vw, 3.5rem)'
}: ParticleTextProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!wrapper || !canvas || !context) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let particles: { x: number; y: number; targetX: number; targetY: number; delay: number; size: number; color: string }[] = [];
    let width = 0;
    let height = 0;
    const start = performance.now();

    const build = async () => {
      const rect = wrapper.getBoundingClientRect();
      width = Math.floor(rect.width);
      height = Math.floor(rect.height);
      if (!width || !height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const styles = getComputedStyle(wrapper);
      const probe = document.createElement('span');
      probe.style.cssText = `position:absolute;visibility:hidden;font:${styles.fontWeight} ${fontSize} ${styles.fontFamily}`;
      probe.textContent = 'M';
      wrapper.append(probe);
      const size = parseFloat(getComputedStyle(probe).fontSize) || 48;
      probe.remove();
      await document.fonts?.ready;
      const source = document.createElement('canvas');
      const sourceContext = source.getContext('2d', { willReadFrequently: true });
      if (!sourceContext) return;
      sourceContext.font = `800 ${size}px ${styles.fontFamily}`;
      const metrics = sourceContext.measureText(text);
      source.width = Math.ceil(metrics.width + size * .25);
      source.height = Math.ceil(size * 1.45);
      sourceContext.font = `800 ${size}px ${styles.fontFamily}`;
      sourceContext.fillStyle = '#fff';
      sourceContext.textBaseline = 'middle';
      sourceContext.fillText(text, size * .12, source.height / 2);
      const pixels = sourceContext.getImageData(0, 0, source.width, source.height).data;
      const step = Math.max(3, Math.ceil(size / 18));
      const targets: { x: number; y: number }[] = [];
      for (let y = 0; y < source.height; y += step) for (let x = 0; x < source.width; x += step) {
        if (pixels[(y * source.width + x) * 4 + 3] > 80) targets.push({ x, y });
      }
      const cap = 1800;
      const stride = Math.max(1, Math.ceil(targets.length / cap));
      particles = targets.filter((_, index) => index % stride === 0).map((target, index) => {
        const seed = ((index * 9301 + 49297) % 233280) / 233280;
        const targetX = width / 2 - source.width / 2 + target.x;
        const targetY = height / 2 - source.height / 2 + target.y;
        const spread = reducedMotion ? 0 : 80 + seed * 70;
        return {
          targetX, targetY,
          x: targetX + Math.cos(seed * Math.PI * 2) * spread,
          y: targetY + Math.sin(seed * Math.PI * 2) * spread,
          delay: seed * 360,
          size: 1.15 + seed * .9,
          color: seed > .58 ? highlightColor : color
        };
      });
    };

    const render = (now: number) => {
      context.clearRect(0, 0, width, height);
      for (const particle of particles) {
        const progress = reducedMotion ? 1 : Math.max(0, Math.min(1, (now - start - particle.delay) / 850));
        const eased = 1 - Math.pow(1 - progress, 3);
        const x = particle.x + (particle.targetX - particle.x) * eased;
        const y = particle.y + (particle.targetY - particle.y) * eased;
        context.globalAlpha = .25 + progress * .75;
        context.fillStyle = particle.color;
        context.fillRect(x - particle.size / 2, y - particle.size / 2, particle.size, particle.size);
      }
      context.globalAlpha = 1;
      frame = requestAnimationFrame(render);
    };

    const resizeObserver = new ResizeObserver(() => void build());
    resizeObserver.observe(wrapper);
    void build();
    frame = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(frame); resizeObserver.disconnect(); };
  }, [text, color, highlightColor, fontSize]);

  return <div ref={wrapperRef} className={`particle-text ${className}`} aria-label={text}>
    <canvas ref={canvasRef} aria-hidden="true" />
    <span className="sr-only">{text}</span>
  </div>;
};

export default ParticleText;
