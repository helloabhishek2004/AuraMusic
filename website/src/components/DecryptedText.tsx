import { useEffect, useState } from 'react';

interface DecryptedTextProps {
  text: string;
  speed?: number;
  className?: string;
  encryptedClassName?: string;
}

const CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()_+';

const DecryptedText = ({ text, speed = 48, className = '', encryptedClassName = '' }: DecryptedTextProps) => {
  const [value, setValue] = useState(() => text.replace(/[^ ]/g, () => CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)]));
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) { setValue(text); setRevealed(text.length); return; }
    let iterations = 0;
    const timer = window.setInterval(() => {
      iterations += 1;
      const completed = Math.min(text.length, Math.floor(iterations / 2));
      setRevealed(completed);
      setValue(text.split('').map((char, index) => {
        if (char === ' ' || index < completed) return char;
        return CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
      }).join(''));
      if (completed >= text.length) window.clearInterval(timer);
    }, speed);
    return () => window.clearInterval(timer);
  }, [text, speed]);

  return <span className={className} aria-label={text}>
    {value.split('').map((char, index) => <span key={`${char}-${index}`} className={index >= revealed ? encryptedClassName : ''}>{char}</span>)}
  </span>;
};

export default DecryptedText;
