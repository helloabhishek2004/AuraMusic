import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion, useScroll, useTransform, MotionValue } from 'framer-motion';

import type { Transition } from 'framer-motion';

export interface BlurTextProps {
  text?: string;
  delay?: number;
  className?: string;
  animateBy?: 'words' | 'letters';
  direction?: 'top' | 'bottom';
  threshold?: number;
  rootMargin?: string;
  animationFrom?: Record<string, string | number>;
  animationTo?: Array<Record<string, string | number>>;
  easing?: Transition['ease'];
  onAnimationComplete?: () => void;
  stepDuration?: number;
  scrollDriven?: boolean;
  scrollOffset?: [string, string];
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span' | 'div';
  style?: React.CSSProperties;
}

const buildKeyframes = (
  from: Record<string, string | number>,
  steps: Array<Record<string, string | number>>
) => {
  const keys = new Set([...Object.keys(from), ...steps.flatMap((s) => Object.keys(s))]);

  const keyframes: Record<string, Array<string | number>> = {};
  keys.forEach((k) => {
    keyframes[k] = [from[k], ...steps.map((s) => s[k])];
  });
  return keyframes;
};

interface ScrollSegmentProps {
  segment: string;
  progress: MotionValue<number>;
  range: [number, number];
  direction: 'top' | 'bottom';
  isLast: boolean;
  animateBy: 'words' | 'letters';
}

function ScrollSegment({
  segment,
  progress,
  range,
  direction,
  isLast,
  animateBy,
}: ScrollSegmentProps) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const initialBlur = isMobile ? 8 : 12;
  const initialY = direction === 'top' ? (isMobile ? -20 : -35) : (isMobile ? 20 : 35);

  // Smoothly transform opacity, blur filter, and vertical translation with scroll progress
  const opacity = useTransform(progress, range, [0, 1], { clamp: true });
  const blurAmount = useTransform(progress, range, [initialBlur, 0], { clamp: true });
  const filter = useTransform(blurAmount, (v) =>
    v <= 0.1 ? 'none' : `blur(${v.toFixed(1)}px)`
  );
  const y = useTransform(progress, range, [initialY, 0], { clamp: true });

  return (
    <motion.span
      className="inline-block"
      style={{
        opacity,
        filter,
        y,
        willChange: 'transform, filter, opacity',
      }}
    >
      {segment === ' ' ? '\u00A0' : segment}
      {animateBy === 'words' && !isLast && '\u00A0'}
    </motion.span>
  );
}

export const BlurText: React.FC<BlurTextProps> = ({
  text = '',
  delay = 200,
  className = '',
  animateBy = 'words',
  direction = 'top',
  threshold = 0.1,
  rootMargin = '0px',
  animationFrom,
  animationTo,
  easing = (t) => t,
  onAnimationComplete,
  stepDuration = 0.35,
  scrollDriven = false,
  scrollOffset = ['start 95%', 'start 36%'],
  as = 'p',
  style,
}) => {
  const elements = useMemo(() => {
    return animateBy === 'words' ? text.split(' ') : text.split('');
  }, [text, animateBy]);

  const [inView, setInView] = useState(false);
  const containerRef = useRef<HTMLElement | null>(null);

  // Scroll-linked progress measurement
  const { scrollYProgress } = useScroll({
    target: containerRef as React.RefObject<HTMLElement>,
    offset: scrollOffset as any,
  });

  // IntersectionObserver for standard timed mode
  useEffect(() => {
    if (scrollDriven) return;
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [scrollDriven, threshold, rootMargin]);

  const defaultFrom = useMemo(
    () =>
      direction === 'top'
        ? { filter: 'blur(10px)', opacity: 0, y: -50 }
        : { filter: 'blur(10px)', opacity: 0, y: 50 },
    [direction]
  );

  const defaultTo = useMemo(
    () => [
      {
        filter: 'blur(5px)',
        opacity: 0.5,
        y: direction === 'top' ? 5 : -5,
      },
      { filter: 'blur(0px)', opacity: 1, y: 0 },
    ],
    [direction]
  );

  const fromSnapshot = animationFrom ?? defaultFrom;
  const toSnapshots = animationTo ?? defaultTo;

  const stepCount = toSnapshots.length + 1;
  const totalDuration = stepDuration * (stepCount - 1);
  const times = Array.from({ length: stepCount }, (_, i) =>
    stepCount === 1 ? 0 : i / (stepCount - 1)
  );

  // Pre-calculate stagger ranges for scroll-driven mode
  const ranges = useMemo(() => {
    const n = elements.length;
    if (n <= 1) return [[0, 0.9] as [number, number]];

    const segmentDuration = Math.max(0.2, Math.min(0.45, 1.0 / n));
    const targetCompletion = 0.92;
    const staggerSpan = targetCompletion - segmentDuration;

    return elements.map((_, i) => {
      const start = (i / (n - 1)) * staggerSpan;
      const end = start + segmentDuration;
      return [start, end] as [number, number];
    });
  }, [elements]);

  const isCentered =
    className.includes('text-center') || className.includes('justify-center');

  const containerStyle: React.CSSProperties = {
    display: as === 'span' ? 'inline-flex' : 'flex',
    flexWrap: 'wrap',
    justifyContent: isCentered ? 'center' : undefined,
    ...style,
  };

  const Component = (as ?? 'p') as React.ElementType;

  return (
    <Component ref={containerRef} className={className} style={containerStyle}>
      {elements.map((segment, index) => {
        if (scrollDriven) {
          return (
            <ScrollSegment
              key={index}
              segment={segment}
              progress={scrollYProgress}
              range={ranges[index]}
              direction={direction}
              isLast={index === elements.length - 1}
              animateBy={animateBy}
            />
          );
        }

        const animateKeyframes = buildKeyframes(fromSnapshot, toSnapshots);

        const spanTransition = {
          duration: totalDuration,
          times,
          delay: (index * delay) / 1000,
          ease: easing,
        };

        return (
          <motion.span
            className="inline-block will-change-[transform,filter,opacity]"
            key={index}
            initial={fromSnapshot}
            animate={inView ? animateKeyframes : fromSnapshot}
            transition={spanTransition}
            onAnimationComplete={
              index === elements.length - 1 ? onAnimationComplete : undefined
            }
          >
            {segment === ' ' ? '\u00A0' : segment}
            {animateBy === 'words' && index < elements.length - 1 && '\u00A0'}
          </motion.span>
        );
      })}
    </Component>
  );
};

export default BlurText;
