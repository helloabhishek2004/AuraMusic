import React from 'react';

export interface AuraButtonProps {
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  href?: string;
  target?: string;
  rel?: string;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  disabled?: boolean;
  className?: string;
  title?: string;
  'aria-label'?: string;
  successDuration?: number;
}

const SIZE_STYLES = {
  sm: 'px-3.5 py-1.5 text-xs rounded-full min-h-[36px] gap-2',
  md: 'px-5 py-2.5 text-xs sm:text-sm rounded-full min-h-[44px] gap-2.5', // 44px min touch target
  lg: 'px-7 py-3 text-sm sm:text-base rounded-full min-h-[48px] gap-3 font-semibold',
};

const VARIANT_STYLES = {
  primary:
    'bg-gradient-to-r from-[#BF5AF2] via-[#A838DA] to-[#9B38DA] text-white shadow-[0_4px_20px_-3px_rgba(191,90,242,0.55)] hover:shadow-[0_6px_25px_-2px_rgba(191,90,242,0.7)] border border-white/20 hover:brightness-105 active:brightness-95',
  secondary:
    'bg-white/[0.06] hover:bg-white/[0.1] active:bg-white/[0.15] text-white border border-white/[0.12] backdrop-blur-xl shadow-[0_4px_16px_rgba(0,0,0,0.4)]',
  tertiary:
    'bg-white/[0.03] hover:bg-white/[0.07] active:bg-white/[0.1] text-white/80 hover:text-white border border-white/[0.06]',
  ghost:
    'bg-transparent hover:bg-white/[0.06] active:bg-white/[0.12] text-white/70 hover:text-white',
};

export const AuraButton: React.FC<AuraButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  href,
  target,
  rel,
  onClick,
  disabled = false,
  className = '',
  title,
  'aria-label': ariaLabel,
}) => {
  const isLink = Boolean(href);
  const Component = (isLink ? 'a' : 'button') as React.ElementType;

  return (
    <Component
      href={href}
      target={target}
      rel={target === '_blank' && !rel ? 'noopener noreferrer' : rel}
      onClick={disabled ? (e: React.MouseEvent) => e.preventDefault() : onClick}
      title={title}
      aria-label={ariaLabel}
      disabled={!isLink ? disabled : undefined}
      className={`group relative inline-flex items-center justify-center font-medium select-none transition-all duration-150 ease-out active:scale-[0.975] hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF5AF2]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07070C] ${
        SIZE_STYLES[size]
      } ${VARIANT_STYLES[variant]} ${
        disabled ? 'opacity-40 pointer-events-none transform-none' : ''
      } ${className}`}
    >
      {/* Icon with Subtle iOS Micro-Translation */}
      {icon && iconPosition === 'left' && (
        <span className="shrink-0 flex items-center justify-center transition-transform duration-200 ease-out group-hover:scale-105">
          {icon}
        </span>
      )}

      {/* Label */}
      <span className="tracking-tight">{children}</span>

      {/* Right Icon */}
      {icon && iconPosition === 'right' && (
        <span className="shrink-0 flex items-center justify-center transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
          {icon}
        </span>
      )}
    </Component>
  );
};

export default AuraButton;
