import React, { useRef, useEffect } from 'react';
import { Renderer, Program, Mesh, Triangle, Color } from 'ogl';
import './SpecularButton.css';

const PAD = 20;

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

uniform vec2 uCenter;
uniform vec2 uHalfSize;
uniform float uRadius;
uniform float uAngle;
uniform float uPx;
uniform vec3 uLineColor;
uniform vec3 uBaseColor;
uniform float uIntensity;
uniform float uShineSize;
uniform float uShineFade;
uniform float uThickness;
uniform float uBaseWidth;

out vec4 fragColor;

float sdRoundedRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float shapeSDF(vec2 p) { return sdRoundedRect(p, uHalfSize, uRadius); }

float gaussianLine(float d, float sigma) {
  float x = d / (sigma + 1e-6);
  float k = mix(1.0, 1.6, smoothstep(0.0, 1.5, x));
  return exp(-k * x * x);
}

void main() {
  vec2 p = gl_FragCoord.xy - uCenter;
  float d = shapeSDF(p);
  vec2 L = vec2(cos(uAngle), sin(uAngle));

  // Dark base stroke hugging the edge for a sense of thickness
  float base = (1.0 - smoothstep(0.0, uBaseWidth, abs(d))) * 0.45;

  // Symmetric specular: the edges facing toward/away from the light both
  // catch a streak. The angular window (size + fade) is measured with an
  // elliptical normal so it varies continuously along straight edges.
  vec2 nEll = normalize(p / (uHalfSize * uHalfSize) + 1e-6);
  float phi = acos(clamp(abs(dot(nEll, L)), 0.0, 1.0));
  float rim = 1.0 - smoothstep(uShineSize - uShineFade, uShineSize + uShineFade + 1e-4, phi);
  float line = gaussianLine(d, uThickness);
  float edgeClamp = 1.0 - smoothstep(0.5 * uPx, 3.0 * uPx, abs(d));
  float hi = line * rim * edgeClamp * uIntensity;

  vec3 col = uBaseColor * base + uLineColor * hi;
  float a = clamp(base + hi, 0.0, 1.0);
  fragColor = vec4(col, a);
}
`;

export interface SpecularButtonProps {
  children?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  radius?: number;
  tint?: string;
  tintOpacity?: number;
  blur?: number;
  textColor?: string;
  lineColor?: string;
  baseColor?: string;
  intensity?: number;
  shineSize?: number;
  shineFade?: number;
  thickness?: number;
  speed?: number;
  followMouse?: boolean;
  proximity?: number;
  autoAnimate?: boolean;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  href?: string;
  download?: boolean | string;
  target?: string;
  rel?: string;
  style?: React.CSSProperties;
  title?: string;
  'aria-label'?: string;
}

export const SpecularButton: React.FC<SpecularButtonProps> = ({
  children = 'Get Started',
  size = 'lg',
  radius = 18,
  tint = '#ffffff',
  tintOpacity = 0,
  blur = 0,
  textColor = '#f5f5f5',
  lineColor = '#ffffff',
  baseColor = '#525252',
  intensity = 1,
  shineSize = 10,
  shineFade = 40,
  thickness = 1,
  speed = 0.35,
  followMouse = true,
  proximity = 140,
  autoAnimate = false,
  disabled = false,
  onClick,
  className = '',
  type = 'button',
  href,
  download,
  target,
  rel,
  style = {},
  title,
  'aria-label': ariaLabel,
}) => {
  const btnRef = useRef<HTMLElement | null>(null);
  const fxRef = useRef<HTMLSpanElement | null>(null);
  const propsRef = useRef({
    radius,
    lineColor,
    baseColor,
    intensity,
    shineSize,
    shineFade,
    thickness,
    speed,
    followMouse,
    proximity,
    autoAnimate,
  });

  propsRef.current = {
    radius,
    lineColor,
    baseColor,
    intensity,
    shineSize,
    shineFade,
    thickness,
    speed,
    followMouse,
    proximity,
    autoAnimate,
  };

  useEffect(() => {
    const btn = btnRef.current;
    const fx = fxRef.current;
    if (!btn || !fx) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let renderer: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let gl: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let program: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mesh: any = null;
    let raf = 0;
    let ro: ResizeObserver | null = null;

    try {
      const dpr = window.devicePixelRatio || 1;
      renderer = new Renderer({ alpha: true, premultipliedAlpha: true, antialias: true, dpr });
      gl = renderer.gl;
      gl.clearColor(0, 0, 0, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      const geometry = new Triangle(gl);
      if (geometry.attributes && (geometry.attributes as Record<string, unknown>).uv) {
        delete (geometry.attributes as Record<string, unknown>).uv;
      }

      program = new Program(gl, {
        vertex: VERT,
        fragment: FRAG,
        uniforms: {
          uCenter: { value: [0, 0] },
          uHalfSize: { value: [1, 1] },
          uRadius: { value: 0 },
          uAngle: { value: 2.4 },
          uPx: { value: dpr },
          uLineColor: { value: [1, 1, 1] },
          uBaseColor: { value: [0.32, 0.32, 0.32] },
          uIntensity: { value: 1 },
          uShineSize: { value: 0.17 },
          uShineFade: { value: 0.7 },
          uThickness: { value: 1 },
          uBaseWidth: { value: dpr },
        },
      });

      mesh = new Mesh(gl, { geometry, program });
      fx.appendChild(gl.canvas as HTMLCanvasElement);

      const sizeRef = { w: 1, h: 1 };
      const resize = () => {
        if (!btn || !renderer || !program) return;
        const rect = btn.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;
        sizeRef.w = w;
        sizeRef.h = h;
        renderer.setSize(w + PAD * 2, h + PAD * 2);
        program.uniforms.uCenter.value = [(PAD + w / 2) * dpr, (PAD + h / 2) * dpr];
        program.uniforms.uHalfSize.value = [(w / 2) * dpr, (h / 2) * dpr];
      };

      ro = new ResizeObserver(resize);
      ro.observe(btn);
      resize();

      // Light angle steers toward pointer and only illuminates on intentional proximity
      let pointerAngle: number | null = null;
      let proximityT = 0;

      const handlePointer = (clientX: number, clientY: number) => {
        if (!btn) return;
        const rect = btn.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = Math.max(rect.left - clientX, 0, clientX - rect.right);
        const dy = Math.max(rect.top - clientY, 0, clientY - rect.bottom);
        const dist = Math.hypot(dx, dy);

        if (dist === 0) {
          const nx = (clientX - cx) / (rect.width / 2);
          const ny = (cy - clientY) / (rect.height / 2);
          pointerAngle = Math.atan2(2 / rect.height, -2 / rect.width) + nx * 0.3 + ny * 0.15;
        } else {
          pointerAngle = Math.atan2(cy - clientY, clientX - cx);
        }
        const t = Math.max(0, 1 - dist / Math.max(propsRef.current.proximity, 1));
        proximityT = t * t * (3 - 2 * t);
      };

      const onPointerMove = (e: PointerEvent) => {
        handlePointer(e.clientX, e.clientY);
      };

      const onPointerDown = (e: PointerEvent) => {
        handlePointer(e.clientX, e.clientY);
      };

      const onPointerUp = () => {
        // Smoothly fade off after interaction
        setTimeout(() => {
          proximityT = 0;
        }, 150);
      };

      const onMouseLeaveDoc = () => {
        proximityT = 0;
        pointerAngle = null;
      };

      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('pointerdown', onPointerDown, { passive: true });
      window.addEventListener('pointerup', onPointerUp, { passive: true });
      document.addEventListener('mouseleave', onMouseLeaveDoc, { passive: true });

      let angle = 2.4;
      let idleAngle = 2.4;
      let bright = 0; // Starts at 0: completely quiet until approached
      let last = performance.now();

      const lineC = new Color();
      const baseC = new Color();

      const update = (now: number) => {
        raf = requestAnimationFrame(update);
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        const p = propsRef.current;

        idleAngle += p.speed * dt;
        const steer = p.followMouse && pointerAngle != null && (!p.autoAnimate || proximityT > 0);
        const targetAngle = (steer && pointerAngle != null) ? pointerAngle : idleAngle;
        const diff = ((targetAngle - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        angle += diff * (1 - Math.exp(-dt * 7));

        // Shine fades in ONLY with intentional pointer proximity unless autoAnimate is true
        const brightTarget = p.autoAnimate ? 1 : proximityT;
        bright += (brightTarget - bright) * (1 - Math.exp(-dt * 8));

        // Clear canvas and skip render when idle/invisible to conserve GPU & stop continuous shining
        if (bright < 0.003 && brightTarget === 0) {
          gl.clear(gl.COLOR_BUFFER_BIT);
          return;
        }

        lineC.set(p.lineColor);
        baseC.set(p.baseColor);

        program.uniforms.uAngle.value = angle;
        program.uniforms.uRadius.value = Math.min(p.radius, Math.min(sizeRef.w, sizeRef.h) / 2) * dpr;
        program.uniforms.uLineColor.value = [lineC.r, lineC.g, lineC.b];
        program.uniforms.uBaseColor.value = [baseC.r, baseC.g, baseC.b];
        program.uniforms.uIntensity.value = p.intensity * bright;
        program.uniforms.uShineSize.value = (p.shineSize * Math.PI) / 180;
        program.uniforms.uShineFade.value = (p.shineFade * Math.PI) / 180;
        program.uniforms.uThickness.value = p.thickness * dpr;

        renderer.render({ scene: mesh });
      };
      raf = requestAnimationFrame(update);

      return () => {
        if (raf) cancelAnimationFrame(raf);
        if (ro) ro.disconnect();
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerdown', onPointerDown);
        window.removeEventListener('pointerup', onPointerUp);
        document.removeEventListener('mouseleave', onMouseLeaveDoc);
        const canvasEl = gl?.canvas as HTMLElement | undefined;
        if (canvasEl && canvasEl.parentNode === fx) {
          fx.removeChild(canvasEl);
        }
        if (gl) {
          gl.getExtension('WEBGL_lose_context')?.loseContext();
        }
      };
    } catch (err) {
      console.warn('SpecularButton WebGL initialization failed:', err);
    }
  }, []);

  const inlineStyle: React.CSSProperties = {
    ['--sb-radius' as string]: `${radius}px`,
    ['--sb-tint' as string]: tint,
    ['--sb-tint-opacity' as string]: tintOpacity,
    ['--sb-blur' as string]: `${blur}px`,
    ['--sb-text-color' as string]: textColor,
    ...style,
  };

  const combinedClasses = `specular-button specular-button--${size}${className ? ` ${className}` : ''}`;

  if (href) {
    return (
      <a
        ref={btnRef as React.RefObject<HTMLAnchorElement>}
        href={href}
        download={download}
        target={download ? undefined : target}
        rel={target === '_blank' && !download ? (rel || 'noopener noreferrer') : rel}
        onClick={onClick}
        title={title}
        aria-label={ariaLabel}
        className={combinedClasses}
        style={inlineStyle}
      >
        <span ref={fxRef} className="specular-button__fx" aria-hidden="true" />
        <span className="specular-button__label">{children}</span>
      </a>
    );
  }

  return (
    <button
      ref={btnRef as React.RefObject<HTMLButtonElement>}
      type={type}
      disabled={disabled}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      className={combinedClasses}
      style={inlineStyle}
    >
      <span ref={fxRef} className="specular-button__fx" aria-hidden="true" />
      <span className="specular-button__label">{children}</span>
    </button>
  );
};

export default SpecularButton;
