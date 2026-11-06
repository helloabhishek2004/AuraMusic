import { useEffect, useState } from 'react';

interface DecryptedTextProps {
  text: string;
  speed?: number;
  className?: string;
  encryptedClassName?: string;
}

const CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()_+';

function isReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const DecryptedText = ({
  text,
  speed = 48,
  className = '',
  encryptedClassName = '',
}: DecryptedTextProps) => {
  const [value, setValue] = useState(() =>
    isReducedMotion()
      ? text
      : text.replace(/[^ ]/g, () => CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)])
  );
  const [revealed, setRevealed] = useState(() => (isReducedMotion() ? text.length : 0));

  useEffect(() => {
    if (isReducedMotion()) return;
    let iterations = 0;
    const timer = window.setInterval(() => {
      iterations += 1;
      const completed = Math.min(text.length, Math.floor(iterations / 2));
      setRevealed(completed);
      setValue(
        text
          .split('')
          .map((char, index) => {
            if (char === ' ' || index < completed) return char;
            return CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
          })
          .join('')
      );
      if (completed >= text.length) window.clearInterval(timer);
    }, speed);
    return () => window.clearInterval(timer);
  }, [text, speed]);

  return (
    <span className={className} aria-label={text}>
      {value.split('').map((char, index) => (
        <span key={`${char}-${index}`} className={index >= revealed ? encryptedClassName : ''}>
          {char}
        </span>
      ))}
    </span>
  );
};

export default DecryptedText;
