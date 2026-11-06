'use client';

import React, { useEffect, useLayoutEffect, useRef } from 'react';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  buildAnimatedContentStates,
  buildScrollTriggerBounds,
  type AnimatedDirection,
  type AnimatedStaggerFrom,
  type AnimatedTriggerMode,
  type AnimatedWipe,
} from '../lib/animated-content-utils';

gsap.registerPlugin(ScrollTrigger);

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export interface AnimatedContentProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  container?: string | HTMLElement | null;
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
  delay?: number;
  stagger?: number;
  staggerFrom?: AnimatedStaggerFrom;
  trigger?: AnimatedTriggerMode;
  once?: boolean;
  scrub?: boolean | number;
  disappearAfter?: number;
  disappearDuration?: number;
  disappearEase?: string;
  onStart?: () => void;
  onComplete?: () => void;
  onDisappearanceComplete?: () => void;
  className?: string;
  style?: CSSProperties;
}

export const AnimatedContent: React.FC<AnimatedContentProps> = ({
  children,
  container,
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
  threshold = 0.1,
  delay = 0,
  stagger = 0,
  staggerFrom = 'start',
  trigger = 'scroll',
  once = true,
  scrub = false,
  disappearAfter = 0,
  disappearDuration = 0.5,
  disappearEase = 'power3.in',
  onStart,
  onComplete,
  onDisappearanceComplete,
  className = '',
  style,
  ...props
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const callbacksRef = useRef({ onStart, onComplete, onDisappearanceComplete });
  callbacksRef.current = { onStart, onComplete, onDisappearanceComplete };

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    let scroller: Element | string | null =
      container || document.getElementById('snap-main-container') || null;
    if (typeof scroller === 'string') {
      scroller = document.querySelector(scroller);
    }

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    const ctx = gsap.context(() => {
      const targets = stagger > 0 && el.children.length ? Array.from(el.children) : [el];
      const { axis, sign, mask, from, to } = buildAnimatedContentStates({
        distance,
        direction,
        reverse,
        duration,
        ease,
        initialOpacity,
        animateOpacity,
        scale,
        blur,
        rotate,
        tilt,
        wipe,
        stagger,
        staggerFrom,
      });

      gsap.set(el, { visibility: 'visible' });

      if (reduce) {
        callbacksRef.current.onComplete?.();
        return;
      }

      if (mask) {
        gsap.set(targets, { maskImage: mask, webkitMaskImage: mask });
      }

      const settle = () => {
        if (scrub) return;
        gsap.set(targets, {
          clearProps: mask ? 'filter,transform,maskImage,webkitMaskImage' : 'filter,transform',
        });
      };

      const disappear = () => {
        if (disappearAfter <= 0) return;
        const out: gsap.TweenVars = {
          [axis]: -distance * sign,
          scale: 0.8,
          opacity: animateOpacity ? initialOpacity : 0,
          delay: disappearAfter,
          duration: disappearDuration,
          ease: disappearEase,
          onComplete: () => callbacksRef.current.onDisappearanceComplete?.(),
        };
        if (blur > 0) out.filter = `blur(${blur}px)`;
        if (stagger > 0) out.stagger = { each: stagger, from: staggerFrom };
        gsap.to(targets, out);
      };

      const tl = gsap.timeline({
        paused: true,
        onStart: () => callbacksRef.current.onStart?.(),
        onComplete: () => {
          callbacksRef.current.onComplete?.();
          settle();
          if (once && !scrub) disappear();
        },
      });
      tl.fromTo(targets, from, to, scrub ? 0 : Math.max(delay, 0));

      if (trigger === 'mount') {
        tl.play();
        return;
      }

      const { start, end } = buildScrollTriggerBounds(threshold);

      if (scrub) {
        ScrollTrigger.create({
          trigger: el,
          scroller: scroller || undefined,
          start,
          end,
          scrub: scrub === true ? true : Math.max(Number(scrub) || 0, 0.01),
          animation: tl,
        });
        return;
      }

      ScrollTrigger.create({
        trigger: el,
        scroller: scroller || undefined,
        start,
        once,
        onEnter: () => tl.play(),
        onLeaveBack: once
          ? undefined
          : () => {
              if (mask) gsap.set(targets, { maskImage: mask, webkitMaskImage: mask });
              tl.reverse();
            },
      });
    }, el);

    return () => ctx.revert();
  }, [
    container,
    distance,
    direction,
    reverse,
    duration,
    ease,
    initialOpacity,
    animateOpacity,
    scale,
    blur,
    rotate,
    tilt,
    wipe,
    threshold,
    delay,
    stagger,
    staggerFrom,
    trigger,
    once,
    scrub,
    disappearAfter,
    disappearDuration,
    disappearEase,
  ]);

  return (
    <div ref={ref} className={className} style={{ visibility: 'hidden', ...style }} {...props}>
      {children}
    </div>
  );
};

export default AnimatedContent;
