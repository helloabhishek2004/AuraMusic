import React from 'react';

export interface AuraIconButtonProps {
  icon: React.ReactNode;
  'aria-label': string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  variant?: 'glass' | 'solid' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
  disabled?: boolean;
  className?: string;
  title?: string;
}

const SIZE_CLASSES = {
  sm: 'w-8 h-8 p-1.5',
  md: 'w-10 h-10 p-2 sm:w-11 sm:h-11 sm:p-2.5', // Meets 44px touch target on mobile
  lg: 'w-12 h-12 p-3 sm:w-14 sm:h-14',
};

const VARIANT_CLASSES = {
  glass:
    'bg-white/[0.06] hover:bg-white/[0.12] active:bg-white/[0.18] border border-white/[0.1] text-white/80 hover:text-white backdrop-blur-xl shadow-[0_4px_16px_rgba(0,0,0,0.4)]',
  solid:
    'bg-gradient-to-tr from-[#BF5AF2] to-[#9B38DA] hover:brightness-110 active:brightness-95 text-white shadow-[0_6px_25px_rgba(191,90,242,0.5)]',
  ghost:
    'bg-transparent hover:bg-white/[0.08] active:bg-white/[0.14] text-white/70 hover:text-white',
};

export const AuraIconButton: React.FC<AuraIconButtonProps> = ({
  icon,
  'aria-label': ariaLabel,
  onClick,
  variant = 'glass',
  size = 'md',
  active = false,
  disabled = false,
  className = '',
  title,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title || ariaLabel}
      className={`inline-flex items-center justify-center rounded-full transition-all duration-150 ease-out select-none active:scale-[0.94] hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF5AF2]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07070C] disabled:opacity-40 disabled:pointer-events-none disabled:transform-none ${
        SIZE_CLASSES[size]
      } ${VARIANT_CLASSES[variant]} ${
        active ? 'ring-1 ring-[#BF5AF2]/70 !bg-white/[0.16] text-[#DAB9FF]' : ''
      } ${className}`}
    >
      <span className="flex items-center justify-center pointer-events-none">{icon}</span>
    </button>
  );
};

export default AuraIconButton;
