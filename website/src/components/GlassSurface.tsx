/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useId, useRef, useCallback } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import './GlassSurface.css';

interface GlassSurfaceProps {
  children?: ReactNode;
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  borderWidth?: number;
  brightness?: number;
  opacity?: number;
  blur?: number;
  displace?: number;
  backgroundOpacity?: number;
  saturation?: number;
  distortionScale?: number;
  redOffset?: number;
  greenOffset?: number;
  blueOffset?: number;
  xChannel?: 'R' | 'G' | 'B';
  yChannel?: 'R' | 'G' | 'B';
  mixBlendMode?: CSSProperties['mixBlendMode'];
  className?: string;
  style?: CSSProperties;
}

const GlassSurface = ({
  children,
  width = '100%',
  height = 'auto',
  borderRadius = 999,
  borderWidth = 0.08,
  brightness = 60,
  opacity = 0.95,
  blur = 12,
  displace = 0,
  backgroundOpacity = 0,
  saturation = 1.35,
  distortionScale = -160,
  redOffset = 0,
  greenOffset = 10,
  blueOffset = 20,
  xChannel = 'R',
  yChannel = 'G',
  mixBlendMode = 'difference',
  className = '',
  style = {}
}: GlassSurfaceProps) => {
  const uniqueId = useId().replace(/:/g, '-');
  const filterId = `glass-filter-${uniqueId}`;
  const redGradId = `red-grad-${uniqueId}`;
  const blueGradId = `blue-grad-${uniqueId}`;
  
  const containerRef = useRef<HTMLDivElement>(null);
  const feImageRef = useRef<SVGFEImageElement>(null);
  const redChannelRef = useRef<SVGFEDisplacementMapElement>(null);
  const greenChannelRef = useRef<SVGFEDisplacementMapElement>(null);
  const blueChannelRef = useRef<SVGFEDisplacementMapElement>(null);
  const gaussianBlurRef = useRef<SVGFEGaussianBlurElement>(null);

  // Generate SVG Displacement Map with valid SVG syntax (clean of CSS filter attributes that Blink restricts)
  const updateDisplacementMap = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const actualWidth = Math.max(Math.round(rect.width), 320);
    const actualHeight = Math.max(Math.round(rect.height), 48);
    const clampedRadius = Math.min(Number(borderRadius) || 24, Math.floor(actualHeight / 2));
    const edgeSize = Math.max(Math.min(actualWidth, actualHeight) * borderWidth * 0.5, 2);

    const svgContent = `<svg viewBox="0 0 ${actualWidth} ${actualHeight}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><linearGradient id="${redGradId}" x1="100%" y1="0%" x2="0%" y2="0%"><stop offset="0%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="red"/></linearGradient><linearGradient id="${blueGradId}" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="blue"/></linearGradient><filter id="innerBlur"><feGaussianBlur stdDeviation="${blur}" /></filter></defs><rect width="${actualWidth}" height="${actualHeight}" fill="black"/><rect width="${actualWidth}" height="${actualHeight}" rx="${clampedRadius}" fill="url(#${redGradId})"/><rect width="${actualWidth}" height="${actualHeight}" rx="${clampedRadius}" fill="url(#${blueGradId})" style="mix-blend-mode:${mixBlendMode}"/><rect x="${edgeSize}" y="${edgeSize}" width="${actualWidth - edgeSize * 2}" height="${actualHeight - edgeSize * 2}" rx="${Math.max(clampedRadius - edgeSize, 2)}" fill="hsl(0 0% ${brightness}% / ${opacity})" filter="url(#innerBlur)"/></svg>`;
    
    const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
    if (feImageRef.current) {
      feImageRef.current.setAttribute('href', dataUri);
      feImageRef.current.setAttributeNS('http://www.w3.org/1999/xlink', 'href', dataUri);
    }
  }, [borderRadius, borderWidth, brightness, opacity, blur, mixBlendMode, redGradId, blueGradId]);

  useEffect(() => {
    updateDisplacementMap();
    [[redChannelRef, redOffset], [greenChannelRef, greenOffset], [blueChannelRef, blueOffset]].forEach(([ref, offset]) => {
      const channel = ref as React.MutableRefObject<SVGFEDisplacementMapElement | null>;
      if (channel.current) {
        channel.current.setAttribute('scale', String(distortionScale + Number(offset)));
        channel.current.setAttribute('xChannelSelector', xChannel);
        channel.current.setAttribute('yChannelSelector', yChannel);
      }
    });
    gaussianBlurRef.current?.setAttribute('stdDeviation', String(displace));
  }, [width, height, borderRadius, borderWidth, brightness, opacity, blur, displace, distortionScale, redOffset, greenOffset, blueOffset, xChannel, yChannel, mixBlendMode, updateDisplacementMap]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(updateDisplacementMap);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [updateDisplacementMap]);

  // Pointer Refraction Physics: Dynamic caustic specular highlight tracking
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    el.style.setProperty('--pointer-x', `${x}px`);
    el.style.setProperty('--pointer-y', `${y}px`);
  };

  const handlePointerLeave = () => {
    const el = containerRef.current;
    if (!el) return;
    el.style.setProperty('--pointer-x', '50%');
    el.style.setProperty('--pointer-y', '50%');
  };

  const containerStyle = {
    ...style,
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
    '--glass-frost': backgroundOpacity,
    '--glass-saturation': saturation,
    '--filter-id': `url(#${filterId})`
  } as CSSProperties;

  return (
    <div
      ref={containerRef}
      className={`glass-surface ${className}`}
      style={containerStyle}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {/* SVG Displacement Filter for hardware environments supporting SVG backdrop-filter */}
      <svg className="glass-surface__filter" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <filter id={filterId} colorInterpolationFilters="sRGB" x="0%" y="0%" width="100%" height="100%">
            <feImage ref={feImageRef} width="100%" height="100%" preserveAspectRatio="none" result="map" />
            <feDisplacementMap ref={redChannelRef} in="SourceGraphic" in2="map" result="dispRed" />
            <feColorMatrix in="dispRed" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="red" />
            <feDisplacementMap ref={greenChannelRef} in="SourceGraphic" in2="map" result="dispGreen" />
            <feColorMatrix in="dispGreen" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="green" />
            <feDisplacementMap ref={blueChannelRef} in="SourceGraphic" in2="map" result="dispBlue" />
            <feColorMatrix in="dispBlue" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="blue" />
            <feBlend in="red" in2="green" mode="screen" result="rg" />
            <feBlend in="rg" in2="blue" mode="screen" result="output" />
            <feGaussianBlur ref={gaussianBlurRef} in="output" stdDeviation="0.7" />
          </filter>
        </defs>
      </svg>

      {/* Optical Refraction Caustics Layer */}
      <div className="glass-surface__refraction" aria-hidden="true" />

      {/* Chromatic Dispersion Layer */}
      <div className="glass-surface__chromatic" aria-hidden="true" />

      {/* Forefront Content */}
      <div className="glass-surface__content">{children}</div>
    </div>
  );
};

export default GlassSurface;
