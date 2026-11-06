export type AnimatedDirection = 'vertical' | 'horizontal';
export type AnimatedWipe = 'none' | 'up' | 'down' | 'left' | 'right' | 'center';
export type AnimatedStaggerFrom = 'start' | 'end' | 'center' | 'edges' | 'random';
export type AnimatedTriggerMode = 'scroll' | 'mount';

export const WIPES: Record<Exclude<AnimatedWipe, 'none'>, string> = {
  up: 'linear-gradient(to top, #000 calc(var(--ac-wipe) * 140% - 40%), transparent calc(var(--ac-wipe) * 140%))',
  down: 'linear-gradient(to bottom, #000 calc(var(--ac-wipe) * 140% - 40%), transparent calc(var(--ac-wipe) * 140%))',
  left: 'linear-gradient(to left, #000 calc(var(--ac-wipe) * 140% - 40%), transparent calc(var(--ac-wipe) * 140%))',
  right: 'linear-gradient(to right, #000 calc(var(--ac-wipe) * 140% - 40%), transparent calc(var(--ac-wipe) * 140%))',
  center:
    'radial-gradient(farthest-corner at 50% 50%, #000 calc(var(--ac-wipe) * 140% - 40%), transparent calc(var(--ac-wipe) * 140%))',
};

export interface AnimatedConfigInput {
  distance?: number;
  direction?: AnimatedDirection;
  reverse?: boolean;
  duration?: number;
  ease?: string;
  initialOpacity?: number;
  animateOpacity?: boolean;
  scale?: number;
  blur?: number;
  rotate?: number;
  tilt?: number;
  wipe?: AnimatedWipe;
  threshold?: number;
  stagger?: number;
  staggerFrom?: AnimatedStaggerFrom;
}

export interface AnimatedStatesResult {
  axis: 'x' | 'y';
  sign: 1 | -1;
  mask: string | undefined;
  from: Record<string, unknown>;
  to: Record<string, unknown>;
}

export function buildAnimatedContentStates({
  distance = 100,
  direction = 'vertical',
  reverse = false,
  duration = 0.8,
  ease = 'power3.out',
  initialOpacity = 0,
  animateOpacity = true,
  scale = 1,
  blur = 0,
  rotate = 0,
  tilt = 0,
  wipe = 'none',
  stagger = 0,
  staggerFrom = 'start',
}: AnimatedConfigInput): AnimatedStatesResult {
  const horizontal = direction === 'horizontal';
  const axis: 'x' | 'y' = horizontal ? 'x' : 'y';
  const sign: 1 | -1 = reverse ? -1 : 1;
  const mask = wipe !== 'none' ? WIPES[wipe] : undefined;

  const from: Record<string, unknown> = {
    [axis]: distance * sign,
    scale,
    opacity: animateOpacity ? initialOpacity : 1,
  };

  const to: Record<string, unknown> = {
    [axis]: 0,
    scale: 1,
    opacity: 1,
    duration,
    ease,
  };

  if (blur > 0) {
    from.filter = `blur(${blur}px)`;
    to.filter = 'blur(0px)';
  }

  if (rotate) {
    from.rotation = rotate * sign;
    to.rotation = 0;
  }

  if (tilt) {
    const tiltAxis = horizontal ? 'rotationY' : 'rotationX';
    from[tiltAxis] = horizontal ? -tilt * sign : tilt * sign;
    to[tiltAxis] = 0;
    from.transformPerspective = 900;
    to.transformPerspective = 900;
  }

  if (mask) {
    from['--ac-wipe'] = 0;
    to['--ac-wipe'] = 1;
  }

  if (stagger > 0) {
    to.stagger = { each: stagger, from: staggerFrom };
  }

  return { axis, sign, mask, from, to };
}

export function buildScrollTriggerBounds(threshold = 0.1): { start: string; end: string } {
  const clampedThreshold = Math.min(Math.max(threshold, 0), 1);
  const startPct = Math.round((1 - clampedThreshold) * 10000) / 100;
  const endPct = Math.max(startPct - 45, 5);
  return {
    start: `top ${startPct}%`,
    end: `top ${endPct}%`,
  };
}
