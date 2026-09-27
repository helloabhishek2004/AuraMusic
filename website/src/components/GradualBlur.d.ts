import type { CSSProperties, ComponentType } from 'react';

interface GradualBlurProps {
  target?: 'page' | 'parent';
  position?: 'top' | 'bottom' | 'left' | 'right';
  height?: string;
  width?: string;
  strength?: number;
  divCount?: number;
  exponential?: boolean;
  curve?: 'linear' | 'bezier' | 'ease-in' | 'ease-out' | 'ease-in-out';
  opacity?: number;
  zIndex?: number;
  className?: string;
  style?: CSSProperties;
}

declare const GradualBlur: ComponentType<GradualBlurProps>;
export default GradualBlur;
