import React, { useId } from 'react';

// Lightweight clay-style illustrations inspired by the Home reference.
export function HomeActivityIcon({ kind, progress = 0, className = '' }) {
  const id = useId().replaceAll(':', '');
  const paint = name => `url(#${id}-${name})`;
  return (
    <svg viewBox="0 0 140 140" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-cream`} x1="0" y1="0" x2=".8" y2="1">
          <stop stopColor="#fff9de" /><stop offset=".55" stopColor="#ffdfb5" /><stop offset="1" stopColor="#f5af88" />
        </linearGradient>
        <linearGradient id={`${id}-coral`} x1="0" y1="0" x2=".8" y2="1">
          <stop stopColor="#ff9972" /><stop offset=".5" stopColor="#ff6446" /><stop offset="1" stopColor="#d6382e" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#fff0a5" /><stop offset=".5" stopColor="#ffbb45" /><stop offset="1" stopColor="#ef7c25" />
        </linearGradient>
        <linearGradient id={`${id}-green`} x1="0" y1="0" x2=".7" y2="1">
          <stop stopColor="#b6d49d" /><stop offset="1" stopColor="#457c50" />
        </linearGradient>
        <filter id={`${id}-shadow`} x="-30%" y="-30%" width="170%" height="180%">
          <feDropShadow dx="0" dy="5" stdDeviation="3" floodColor="#521b0c" floodOpacity=".35" />
          <feDropShadow dx="-1" dy="-1" stdDeviation=".5" floodColor="#fff6dc" floodOpacity=".65" />
        </filter>
      </defs>
      <g fill="none" stroke={paint('gold')} strokeWidth="5" strokeLinecap="round">
        <path d={kind === 'chat' ? 'M112 15l4-10M123 27l9-5' : 'M119 24l5-8M126 40h10'} />
        {kind === 'youtube' && <path d="M13 26l-6-4M23 15l-2-8M119 111l7 5M112 121l3 8" />}
      </g>
      <g filter={paint('shadow')}>
        {kind === 'chat' && <>
          <path d="M68 53q-8 0-8 16v26q0 17 18 18h20l17 12-3-20q13-9 13-27 0-28-26-27z" fill={paint('coral')} />
          <path d="M21 25q-17 7-17 36 0 24 18 34l-3 20q0 5 6 2l17-13h24q35-1 35-41 0-43-36-43z" fill={paint('cream')} />
          {[35, 54, 73].map(x => <ellipse key={x} cx={x} cy="59" rx="5.5" ry="6" fill="#e68b51" />)}
        </>}
        {kind === 'youtube' && <g transform="rotate(-8 65 72)">
          <rect x="19" y="36" width="102" height="85" rx="27" fill="#c93228" />
          <rect x="17" y="29" width="104" height="85" rx="27" fill={paint('coral')} stroke="#ffae86" strokeOpacity=".6" strokeWidth="2" />
          <path d="M59 53q-5-2-5 4v35q0 5 5 2l27-17q6-4 0-7z" fill={paint('cream')} />
        </g>}
        {kind === 'text' && <g transform="rotate(-6 67 73)">
          <rect x="17" y="34" width="108" height="96" rx="18" fill="#e97728" />
          <rect x="13" y="29" width="110" height="96" rx="18" fill={paint('gold')} />
          <path d="M23 27q23-5 43 1 22-6 44 0v84q-21-5-44 0-22-5-43-1z" fill={paint('cream')} stroke="#fff4d6" strokeWidth="2" />
          <path d="M67 31v74" fill="none" stroke="#e9b994" strokeWidth="3" />
          <path d="M80 23h20v45l-10-9-10 8z" fill={paint('gold')} />
          <g stroke="#e9ba93" strokeWidth="5" strokeLinecap="round"><path d="M34 48h20M34 65h20M34 82h20M78 83h20M34 98h20" /></g>
        </g>}
        {kind === 'image' && <g transform="rotate(-13 68 76)">
          <rect x="18" y="29" width="107" height="100" rx="21" fill="#e58e68" />
          <rect x="15" y="23" width="107" height="101" rx="21" fill={paint('cream')} />
          <rect x="26" y="34" width="84" height="76" rx="12" fill="#e5e4d8" stroke="#fff4dc" strokeWidth="3" />
          <circle cx="91" cy="52" r="12" fill={paint('gold')} />
          <path d="M68 96l13-20q5-8 12-1l16 25q2 8-9 8H66z" fill="#5f8d5c" />
          <path d="M28 98l20-27q5-7 12 0l27 37H36q-10 0-8-10" fill={paint('green')} />
        </g>}
        {kind === 'habits' && <>
          <circle cx="66" cy="73" r="49" fill="none" stroke={paint('coral')} strokeWidth="16" />
          <circle cx="66" cy="73" r="49" fill="none" stroke={paint('cream')} strokeWidth="16" strokeLinecap="round" pathLength="100" strokeDasharray={`${progress || 52} 100`} transform="rotate(90 66 73)" />
          <path d="M64 43q20 6 18 26l6-10q17 30-2 42-20 13-36-4-12-16 0-33l4 10q11-15 10-31" fill={paint('gold')} />
          <path d="M66 76q14 15 4 26-11 5-16-6-2-8 12-20" fill="#ffc561" />
        </>}
      </g>
    </svg>
  );
}
