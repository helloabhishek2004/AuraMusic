import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { ConnectedProviderId } from '../types/provider';

interface ServiceIconProps {
  size?: number;
  color?: string;
}

export function SpotifyIcon({ size = 24, color = '#1ED760' }: ServiceIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.563.387-.857.207-2.35-1.435-5.308-1.76-8.793-.963-.335.077-.67-.133-.746-.468-.077-.334.132-.67.467-.746 3.808-.87 7.076-.5 9.722 1.113.294.18.386.563.207.857zm1.225-2.723c-.226.367-.707.482-1.074.256-2.69-1.654-6.79-2.133-9.97-1.167-.413.125-.85-.108-.975-.521-.125-.413.108-.85.521-.975 3.632-1.102 8.163-.568 11.242 1.328.367.226.482.707.256 1.079zm.106-2.835C14.692 8.95 9.375 8.775 6.297 9.71c-.494.15-1.018-.13-1.168-.624-.15-.494.13-1.018.624-1.168 3.532-1.073 9.404-.866 13.115 1.338.445.264.59.838.327 1.282-.264.444-.838.59-1.28.328z"
        fill={color}
      />
    </Svg>
  );
}

export function YouTubeMusicIcon({ size = 24, color = '#FF0033' }: ServiceIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm-1.5 2l3-1.5-3-1.5v3z"
        fill={color}
      />
    </Svg>
  );
}

export function AppleMusicIcon({ size = 24, color = '#FC3C44' }: ServiceIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 0.92-2.87-.9.04-2 .6-2.63 1.34-.56.64-1.04 1.7-0.91 2.74 1.01.08 2.01-.46 2.62-1.21z"
        fill={color}
      />
    </Svg>
  );
}

export function ServiceIcon({
  providerId,
  size = 24,
  color,
}: {
  providerId: ConnectedProviderId;
  size?: number;
  color?: string;
}) {
  switch (providerId) {
    case 'spotify':
      return <SpotifyIcon size={size} color={color || '#1ED760'} />;
    case 'ytmusic':
      return <YouTubeMusicIcon size={size} color={color || '#FF0033'} />;
    case 'applemusic':
      return <AppleMusicIcon size={size} color={color || '#FC3C44'} />;
    default:
      return null;
  }
}
