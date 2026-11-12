import React, { useState, useEffect } from 'react';
import {
  AppearanceConfig,
  DEFAULT_APPEARANCE_CONFIG,
  getFontFamily,
  ensureFontLoaded,
} from '../services/appearanceConfig';

interface LockScreenClockProps {
  config?: AppearanceConfig;
}

export const LockScreenClock: React.FC<LockScreenClockProps> = ({
  config = DEFAULT_APPEARANCE_CONFIG,
}) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    // 250ms update for smooth seconds ticking if enabled
    const interval = config.showSeconds ? 250 : 1000;
    const timer = setInterval(() => {
      setNow(new Date());
    }, interval);
    return () => clearInterval(timer);
  }, [config.showSeconds]);

  // Lazy load selected fonts locally
  useEffect(() => {
    ensureFontLoaded(config.timeFont);
    if (config.dateFont !== 'follow-time') {
      ensureFontLoaded(config.dateFont);
    }
  }, [config.timeFont, config.dateFont]);

  // Date Formatting via Intl.DateTimeFormat
  const locale = config.locale === 'default' ? undefined : config.locale;

  let dateString = '';
  if (config.dateFormat !== 'hidden') {
    switch (config.dateFormat) {
      case 'short':
        // e.g. "Thu Nov 12"
        dateString = new Intl.DateTimeFormat(locale, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }).format(now);
        break;
      case 'long':
        // e.g. "Thursday, 12 November"
        dateString = new Intl.DateTimeFormat(locale, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }).format(now);
        break;
      case 'numeric-dmy':
        // e.g. "12/11/2026"
        dateString = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
        break;
      case 'numeric-mdy':
        // e.g. "11/12/2026"
        dateString = `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')}/${now.getFullYear()}`;
        break;
      case 'iso':
        // e.g. "2026-11-12"
        dateString = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
        break;
      case 'day-month':
        // e.g. "12 Nov"
        dateString = new Intl.DateTimeFormat(locale, {
          day: 'numeric',
          month: 'short',
        }).format(now);
        break;
    }
  }

  // Time Formatting
  let rawHours = now.getHours();
  let ampm = '';

  if (config.timeFormat === '12h') {
    ampm = rawHours >= 12 ? 'PM' : 'AM';
    rawHours = rawHours % 12 || 12;
  }

  const hoursStr = config.leadingZero
    ? rawHours.toString().padStart(2, '0')
    : rawHours.toString();
  const minutesStr = now.getMinutes().toString().padStart(2, '0');
  const secondsStr = now.getSeconds().toString().padStart(2, '0');

  const timeFontFamily = getFontFamily(config.timeFont);
  const dateFontFamily =
    config.dateFont === 'follow-time'
      ? timeFontFamily
      : getFontFamily(config.dateFont);

  const dateNode = dateString ? (
    <div
      className="text-[15px] font-medium text-white/70 tracking-normal antialiased select-none"
      style={{
        fontFamily: dateFontFamily,
      }}
    >
      {dateString}
    </div>
  ) : null;

  const timeNode = (
    <div
      className="text-white tracking-[-0.03em] leading-[1.0] antialiased select-none flex items-baseline justify-center"
      style={{
        fontFamily: timeFontFamily,
        fontWeight: config.timeWeight,
        fontSize: `${config.timeSize}px`,
        fontFeatureSettings: '"tnum" 1',
      }}
    >
      <span>{hoursStr}</span>
      <span className="mx-[1px]">:</span>
      <span>{minutesStr}</span>
      {config.showSeconds && (
        <>
          <span className="mx-[1px]">:</span>
          <span className="text-[0.62em] opacity-75 font-normal">{secondsStr}</span>
        </>
      )}
      {config.timeFormat === '12h' && config.showAmPm && (
        <span className="ml-2.5 text-[0.24em] font-semibold uppercase tracking-wider text-white/60 self-start mt-2">
          {ampm}
        </span>
      )}
    </div>
  );

  return (
    <div className="flex flex-col items-center justify-center select-none pointer-events-none">
      {config.datePosition === 'above' && dateNode}
      {timeNode}
      {config.datePosition === 'below' && <div className="mt-1">{dateNode}</div>}
    </div>
  );
};
