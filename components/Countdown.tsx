'use client';
import { useEffect, useState, useMemo } from 'react';

interface CountdownProps {
  date: string;
  className?: string;
  title?: string;
}

export default function Countdown({ date, className = '', title }: CountdownProps) {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const targetTime = useMemo(() => {
    try {
      if (!date) return 0;
      // Handle "YYYY-MM-DDTHH:mm" with default timezone or parsed ISO
      const iso = date.includes('Z') || date.includes('+') ? date : `${date}:00+02:00`;
      return new Date(iso).getTime();
    } catch {
      return 0;
    }
  }, [date]);

  const diffSeconds = Math.max(0, Math.floor((targetTime - now) / 1000));
  const isPast = targetTime > 0 && now >= targetTime;

  const days = Math.floor(diffSeconds / 86400);
  const hours = Math.floor((diffSeconds % 86400) / 3600);
  const minutes = Math.floor((diffSeconds % 3600) / 60);
  const seconds = diffSeconds % 60;

  if (!mounted) {
    return (
      <div className={`event-countdown-wrapper ${className}`}>
        {title && <span className="countdown-eyebrow">{title}</span>}
        <div className="event-countdown-grid">
          {['DIAS', 'HORAS', 'MINUTOS', 'SEGUNDOS'].map((unit, i) => (
            <div className="countdown-card" key={i}>
              <span className="countdown-number">00</span>
              <span className="countdown-unit">{unit}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isPast) {
    return (
      <div className={`event-countdown-wrapper finished ${className}`}>
        <div className="countdown-celebration">
          <span className="celebration-badge">✦ O GRANDE DIA CHEGOU ✦</span>
          <h3>A celebração está a acontecer!</h3>
          <p>Obrigado por fazer parte deste momento inesquecível.</p>
        </div>
      </div>
    );
  }

  const items = [
    { value: days, unit: 'DIAS' },
    { value: hours, unit: 'HORAS' },
    { value: minutes, unit: 'MINUTOS' },
    { value: seconds, unit: 'SEGUNDOS' },
  ];

  return (
    <div className={`event-countdown-wrapper ${className}`}>
      {title && <span className="countdown-eyebrow">{title}</span>}
      <div className="event-countdown-grid">
        {items.map((item, idx) => (
          <div className="countdown-card" key={idx}>
            <span className="countdown-number">{String(item.value).padStart(2, '0')}</span>
            <span className="countdown-unit">{item.unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
