import React from 'react';

export type AuraChipVariant =
  | 'default'
  | 'violet'
  | 'aqua'
  | 'lavender'
  | 'neutral'
  | 'status';

export type AuraChipSize = 'xs' | 'sm' | 'md';

export interface AuraChipProps {
  label: React.ReactNode;
  icon?: React.ReactNode;
  variant?: AuraChipVariant;
  size?: AuraChipSize;
  pulseDot?: boolean | string;
  interactive?: boolean;
  active?: boolean;
  onClick?: () => void;
  className?: string;
  title?: string;
}

const VARIANT_STYLES: Record<AuraChipVariant, string> = {
  default:
    'bg-white/[0.04] text-white/80 border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.3)]',
  violet:
    'bg-[#BF5AF2]/[0.08] text-[#DAB9FF] border-[#BF5AF2]/20 shadow-[0_2px_12px_rgba(191,90,242,0.15)]',
  aqua:
    'bg-[#46F5E0]/[0.08] text-[#46F5E0] border-[#46F5E0]/20 shadow-[0_2px_12px_rgba(70,245,224,0.12)]',
  lavender:
    'bg-[#DAB9FF]/[0.08] text-[#E2DDEE] border-[#DAB9FF]/20 shadow-[0_2px_10px_rgba(218,185,255,0.12)]',
  neutral:
    'bg-black/40 text-white/65 border-white/[0.06]',
  status:
    'bg-white/[0.05] text-white/90 border-white/[0.1] shadow-[0_2px_10px_rgba(0,0,0,0.4)]',
};

const SIZE_STYLES: Record<AuraChipSize, { container: string; icon: string; text: string }> = {
  xs: {
    container: 'px-2 py-0.5 gap-1.5 rounded-full',
    icon: 'scale-[0.85] shrink-0',
    text: 'text-[10px] tracking-wide font-mono uppercase',
  },
  sm: {
    container: 'px-2.5 py-1 gap-1.5 rounded-full',
    icon: 'shrink-0',
    text: 'text-[11px] sm:text-xs font-mono tracking-wide',
  },
  md: {
    container: 'px-3.5 py-1.5 gap-2 rounded-full',
    icon: 'shrink-0',
    text: 'text-xs sm:text-sm font-medium tracking-tight',
  },
};

export const AuraChip: React.FC<AuraChipProps> = ({
  label,
  icon,
  variant = 'default',
  size = 'sm',
  pulseDot,
  interactive = false,
  active = false,
  onClick,
  className = '',
  title,
}) => {
  const sizeConfig = SIZE_STYLES[size];
  const variantClass = VARIANT_STYLES[variant];

  const interactiveClasses = interactive
    ? 'cursor-pointer hover:bg-white/[0.08] hover:border-white/[0.16] active:scale-[0.97] transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF5AF2]/60 select-none'
    : 'select-none pointer-events-auto';

  const activeClass = active
    ? 'ring-1 ring-[#BF5AF2]/50 !bg-[#BF5AF2]/15 !border-[#BF5AF2]/40 !text-white'
    : '';

  const Component = interactive ? 'button' : 'div';

  return (
    <Component
      type={interactive ? 'button' : undefined}
      onClick={interactive ? onClick : undefined}
      title={title}
      className={`inline-flex items-center backdrop-blur-md border ${sizeConfig.container} ${variantClass} ${interactiveClasses} ${activeClass} ${className}`}
    >
      {/* Optional Pulsing Signal Dot */}
      {pulseDot && (
        <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{
              backgroundColor: typeof pulseDot === 'string' ? pulseDot : '#BF5AF2',
            }}
          />
          <span
            className="relative inline-flex rounded-full h-1.5 w-1.5"
            style={{
              backgroundColor: typeof pulseDot === 'string' ? pulseDot : '#BF5AF2',
            }}
          />
        </span>
      )}

      {/* Optical Icon Alignment */}
      {icon && <span className={`flex items-center justify-center ${sizeConfig.icon}`}>{icon}</span>}

      {/* Label Content */}
      <span className={sizeConfig.text}>{label}</span>
    </Component>
  );
};

export default AuraChip;
