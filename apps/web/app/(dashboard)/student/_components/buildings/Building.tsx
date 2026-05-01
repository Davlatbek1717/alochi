'use client';

import type * as React from 'react';

/**
 * Single dispatch component that maps a building `type` string to one of
 * 25 inline-SVG renderers (5 per tier × 5 tiers). Each renderer returns an
 * <svg> sized to a fixed bounding box so the cityscape can lay them out
 * deterministically. We keep all geometry in here as plain primitives —
 * <rect>, <polygon>, <circle> — so there are no external assets and the
 * footprint stays tiny.
 */

type BuildingProps = {
  type: string;
  width?: number;
  height?: number;
};

// Standard footprint — every building renders inside a 100×100 viewBox.
// Variations in apparent height come from how much of the box the shape
// uses, not the SVG dimensions.
const W = 100;
const H = 100;

export default function Building({ type, width = 90, height = 90 }: BuildingProps) {
  const renderer = RENDERERS[type] ?? RENDERERS.house;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={width}
      height={height}
      role="img"
      aria-label={LABELS[type] ?? type}
      style={{ overflow: 'visible' }}
    >
      {renderer()}
    </svg>
  );
}

// User-facing Uzbek labels per type. Used for accessibility + tooltip.
const LABELS: Record<string, string> = {
  house: 'Uy',
  road: "Ko'cha",
  tree: 'Daraxt',
  well: 'Quduq',
  fence: 'Devor',
  school: 'Maktab',
  shop: "Do'kon",
  park: 'Park',
  bus_stop: "Bekat",
  garden: 'Bog',
  library: 'Kutubxona',
  theatre: 'Teatr',
  fountain: 'Favvora',
  hospital: 'Shifoxona',
  square: 'Maydon',
  airport: 'Aeroport',
  university: 'Universitet',
  tower: 'Minora',
  stadium: 'Stadion',
  museum: 'Muzey',
  skyscraper: "Osmono'par",
  monorail: 'Monorel',
  planetarium: 'Planetariy',
  cathedral: 'Sobor',
  satellite_dish: 'Antenna',
};

type Renderer = () => React.ReactElement;

const RENDERERS: Record<string, Renderer> = {
  // -------------------- TIER 1 — QISHLOQ (warm earth tones) --------------------
  house: () => (
    <g>
      {/* body */}
      <rect x="22" y="50" width="56" height="42" fill="#e9c89a" stroke="#7a4a1f" strokeWidth="1.5" />
      {/* roof */}
      <polygon points="18,52 50,22 82,52" fill="#a04020" stroke="#5a2010" strokeWidth="1.5" />
      {/* door */}
      <rect x="42" y="68" width="16" height="24" fill="#7a4a1f" />
      <circle cx="55" cy="80" r="1.2" fill="#f0d080" />
      {/* window */}
      <rect x="28" y="58" width="10" height="10" fill="#bce3ff" stroke="#5a2010" strokeWidth="1" />
      <rect x="62" y="58" width="10" height="10" fill="#bce3ff" stroke="#5a2010" strokeWidth="1" />
      {/* chimney */}
      <rect x="62" y="30" width="6" height="14" fill="#7a4a1f" />
    </g>
  ),
  road: () => (
    <g>
      {/* dirt path with stones */}
      <rect x="6" y="74" width="88" height="18" fill="#caa97a" />
      <rect x="6" y="74" width="88" height="18" fill="url(#road-tex)" opacity="0.5" />
      <ellipse cx="22" cy="84" rx="4" ry="2.5" fill="#8a6a40" />
      <ellipse cx="40" cy="86" rx="3" ry="2" fill="#8a6a40" />
      <ellipse cx="60" cy="83" rx="4" ry="2.5" fill="#8a6a40" />
      <ellipse cx="78" cy="86" rx="3" ry="2" fill="#8a6a40" />
      {/* dashed centerline */}
      <line x1="10" y1="83" x2="22" y2="83" stroke="#fff" strokeWidth="1" strokeDasharray="3 2" opacity="0.5" />
      <line x1="34" y1="83" x2="46" y2="83" stroke="#fff" strokeWidth="1" strokeDasharray="3 2" opacity="0.5" />
      <line x1="58" y1="83" x2="70" y2="83" stroke="#fff" strokeWidth="1" strokeDasharray="3 2" opacity="0.5" />
    </g>
  ),
  tree: () => (
    <g>
      {/* trunk */}
      <rect x="46" y="58" width="8" height="34" fill="#6a4020" />
      {/* canopy */}
      <circle cx="50" cy="44" r="26" fill="#3a8a3a" />
      <circle cx="38" cy="40" r="16" fill="#4ea14e" />
      <circle cx="62" cy="40" r="16" fill="#4ea14e" />
      <circle cx="50" cy="32" r="14" fill="#5cb15c" />
    </g>
  ),
  well: () => (
    <g>
      {/* base stones */}
      <ellipse cx="50" cy="84" rx="22" ry="6" fill="#8a8278" />
      <rect x="32" y="58" width="36" height="28" fill="#a8a098" stroke="#5a5048" strokeWidth="1.5" />
      {/* mortar lines */}
      <line x1="32" y1="66" x2="68" y2="66" stroke="#5a5048" strokeWidth="0.8" />
      <line x1="32" y1="74" x2="68" y2="74" stroke="#5a5048" strokeWidth="0.8" />
      <line x1="50" y1="58" x2="50" y2="86" stroke="#5a5048" strokeWidth="0.8" />
      {/* roof */}
      <polygon points="24,46 50,22 76,46" fill="#7a4a1f" />
      {/* support */}
      <line x1="32" y1="46" x2="32" y2="58" stroke="#5a3010" strokeWidth="2" />
      <line x1="68" y1="46" x2="68" y2="58" stroke="#5a3010" strokeWidth="2" />
      {/* bucket */}
      <rect x="44" y="44" width="12" height="10" fill="#6a4020" />
    </g>
  ),
  fence: () => (
    <g>
      {/* horizontal rails */}
      <rect x="6" y="64" width="88" height="3" fill="#8a5a30" />
      <rect x="6" y="76" width="88" height="3" fill="#8a5a30" />
      {/* posts (pointed top) */}
      {[10, 24, 38, 52, 66, 80].map((x) => (
        <g key={x}>
          <polygon points={`${x},58 ${x + 3},54 ${x + 6},58 ${x + 6},92 ${x},92`} fill="#a07040" stroke="#5a3010" strokeWidth="0.8" />
        </g>
      ))}
    </g>
  ),

  // -------------------- TIER 2 — SHAHARCHA (medium warm) --------------------
  school: () => (
    <g>
      {/* body */}
      <rect x="14" y="44" width="72" height="48" fill="#e0a060" stroke="#5a3010" strokeWidth="1.5" />
      {/* roof */}
      <polygon points="10,46 50,28 90,46" fill="#a05030" stroke="#5a2010" strokeWidth="1.5" />
      {/* clock tower */}
      <rect x="44" y="18" width="12" height="18" fill="#e0a060" stroke="#5a3010" strokeWidth="1" />
      <polygon points="42,20 50,10 58,20" fill="#a05030" />
      <circle cx="50" cy="26" r="4" fill="#fff" stroke="#5a2010" strokeWidth="0.8" />
      <line x1="50" y1="26" x2="50" y2="23" stroke="#5a2010" strokeWidth="0.8" />
      <line x1="50" y1="26" x2="52" y2="26" stroke="#5a2010" strokeWidth="0.8" />
      {/* windows grid */}
      {[20, 34, 56, 70].map((x) => (
        <g key={x}>
          <rect x={x} y="52" width="10" height="10" fill="#bce3ff" stroke="#5a2010" strokeWidth="0.6" />
          <rect x={x} y="68" width="10" height="10" fill="#bce3ff" stroke="#5a2010" strokeWidth="0.6" />
        </g>
      ))}
      {/* door */}
      <rect x="44" y="74" width="12" height="18" fill="#5a2010" />
    </g>
  ),
  shop: () => (
    <g>
      {/* body */}
      <rect x="14" y="50" width="72" height="42" fill="#f5d090" stroke="#a05030" strokeWidth="1.5" />
      {/* awning (stripes) */}
      <polygon points="10,50 90,50 86,40 14,40" fill="#d04030" />
      {[20, 30, 40, 50, 60, 70, 80].map((x) => (
        <line key={x} x1={x} y1="40" x2={x - 4} y2="50" stroke="#fff" strokeWidth="2" />
      ))}
      {/* big window */}
      <rect x="20" y="56" width="36" height="22" fill="#bce3ff" stroke="#5a2010" strokeWidth="1" />
      <line x1="38" y1="56" x2="38" y2="78" stroke="#5a2010" strokeWidth="0.6" />
      <line x1="20" y1="67" x2="56" y2="67" stroke="#5a2010" strokeWidth="0.6" />
      {/* door */}
      <rect x="62" y="56" width="16" height="36" fill="#7a4020" />
      {/* sign */}
      <rect x="36" y="44" width="28" height="6" fill="#fff" stroke="#5a2010" strokeWidth="0.6" />
      <text x="50" y="49" fontSize="5" textAnchor="middle" fill="#5a2010" fontFamily="sans-serif" fontWeight="bold">SHOP</text>
    </g>
  ),
  park: () => (
    <g>
      {/* grass */}
      <rect x="6" y="70" width="88" height="22" fill="#6cba4a" />
      {/* path */}
      <path d="M 10 90 Q 50 78 90 90" stroke="#caa97a" strokeWidth="4" fill="none" />
      {/* trees */}
      <g>
        <rect x="22" y="50" width="4" height="22" fill="#6a4020" />
        <circle cx="24" cy="46" r="14" fill="#3a8a3a" />
        <circle cx="18" cy="42" r="9" fill="#4ea14e" />
        <circle cx="30" cy="42" r="9" fill="#4ea14e" />
      </g>
      <g>
        <rect x="56" y="42" width="5" height="30" fill="#6a4020" />
        <circle cx="58.5" cy="36" r="18" fill="#3a8a3a" />
        <circle cx="50" cy="32" r="11" fill="#4ea14e" />
        <circle cx="68" cy="32" r="11" fill="#4ea14e" />
      </g>
      {/* bench */}
      <rect x="76" y="74" width="14" height="2" fill="#5a3010" />
      <rect x="78" y="76" width="2" height="6" fill="#5a3010" />
      <rect x="86" y="76" width="2" height="6" fill="#5a3010" />
    </g>
  ),
  bus_stop: () => (
    <g>
      {/* shelter pole */}
      <rect x="20" y="40" width="3" height="52" fill="#5a5a60" />
      <rect x="74" y="40" width="3" height="52" fill="#5a5a60" />
      {/* roof */}
      <rect x="14" y="36" width="68" height="6" fill="#3a6a9a" />
      {/* sign */}
      <rect x="42" y="46" width="14" height="14" fill="#3a6a9a" />
      <text x="49" y="56" fontSize="9" textAnchor="middle" fill="#fff" fontFamily="sans-serif" fontWeight="bold">B</text>
      {/* bench */}
      <rect x="26" y="74" width="46" height="3" fill="#7a4020" />
      <rect x="28" y="77" width="3" height="10" fill="#7a4020" />
      <rect x="68" y="77" width="3" height="10" fill="#7a4020" />
      {/* sidewalk */}
      <rect x="6" y="88" width="88" height="4" fill="#a0a098" />
    </g>
  ),
  garden: () => (
    <g>
      {/* grass */}
      <rect x="6" y="70" width="88" height="22" fill="#6cba4a" />
      {/* flower beds (rows) */}
      {[0, 1, 2].map((row) =>
        [0, 1, 2, 3, 4, 5].map((col) => (
          <g key={`${row}-${col}`}>
            <circle cx={14 + col * 14} cy={56 + row * 8} r="2.4" fill={col % 2 === 0 ? '#e44' : '#fc6'} />
            <circle cx={14 + col * 14} cy={56 + row * 8} r="0.8" fill="#fff" />
          </g>
        )),
      )}
      {/* picket border */}
      <rect x="6" y="68" width="88" height="2" fill="#7a4020" />
      {[8, 18, 28, 38, 48, 58, 68, 78, 88].map((x) => (
        <rect key={x} x={x} y="64" width="2" height="6" fill="#a06030" />
      ))}
    </g>
  ),

  // -------------------- TIER 3 — SHAHAR (cool stone/civic) --------------------
  library: () => (
    <g>
      {/* base steps */}
      <rect x="6" y="86" width="88" height="6" fill="#a8a098" />
      <rect x="10" y="80" width="80" height="6" fill="#bcb4ac" />
      {/* body */}
      <rect x="14" y="42" width="72" height="40" fill="#d8d0c4" stroke="#5a5048" strokeWidth="1.5" />
      {/* pediment */}
      <polygon points="10,42 50,22 90,42" fill="#e8e0d4" stroke="#5a5048" strokeWidth="1.5" />
      {/* columns */}
      {[20, 32, 44, 56, 68, 80].map((x) => (
        <g key={x}>
          <rect x={x - 2} y="42" width="6" height="40" fill="#f0e8dc" stroke="#5a5048" strokeWidth="0.5" />
          <rect x={x - 3} y="40" width="8" height="3" fill="#f0e8dc" stroke="#5a5048" strokeWidth="0.5" />
          <rect x={x - 3} y="80" width="8" height="3" fill="#f0e8dc" stroke="#5a5048" strokeWidth="0.5" />
        </g>
      ))}
      {/* book symbol on pediment */}
      <rect x="46" y="32" width="8" height="6" fill="#3a5a8a" />
    </g>
  ),
  theatre: () => (
    <g>
      {/* body */}
      <rect x="14" y="42" width="72" height="50" fill="#a04050" stroke="#5a1020" strokeWidth="1.5" />
      {/* roof — domed */}
      <ellipse cx="50" cy="42" rx="40" ry="14" fill="#8a3040" stroke="#5a1020" strokeWidth="1.2" />
      {/* curtain entrance */}
      <rect x="38" y="58" width="24" height="34" fill="#5a1020" />
      <path d="M 38 58 Q 50 70 62 58" stroke="#fdb" strokeWidth="2" fill="none" />
      {/* tiebacks */}
      <line x1="40" y1="58" x2="40" y2="92" stroke="#fff5d0" strokeWidth="0.8" opacity="0.6" />
      <line x1="60" y1="58" x2="60" y2="92" stroke="#fff5d0" strokeWidth="0.8" opacity="0.6" />
      {/* marquee */}
      <rect x="18" y="46" width="64" height="8" fill="#fdc640" stroke="#5a1020" strokeWidth="0.8" />
      {[24, 34, 44, 54, 64, 74].map((x) => (
        <circle key={x} cx={x} cy="50" r="1.2" fill="#fff" />
      ))}
      {/* mask icon */}
      <text x="50" y="40" fontSize="10" textAnchor="middle" fontFamily="serif">★</text>
    </g>
  ),
  fountain: () => (
    <g>
      {/* base pool */}
      <ellipse cx="50" cy="86" rx="38" ry="6" fill="#3a78b8" stroke="#1a4a78" strokeWidth="1" />
      <ellipse cx="50" cy="84" rx="34" ry="4" fill="#5aa0d8" />
      {/* tiers */}
      <ellipse cx="50" cy="76" rx="20" ry="4" fill="#bcb4ac" stroke="#5a5048" strokeWidth="1" />
      <ellipse cx="50" cy="62" rx="12" ry="3" fill="#bcb4ac" stroke="#5a5048" strokeWidth="1" />
      <rect x="46" y="60" width="8" height="14" fill="#bcb4ac" stroke="#5a5048" strokeWidth="0.6" />
      <rect x="48" y="46" width="4" height="16" fill="#bcb4ac" stroke="#5a5048" strokeWidth="0.6" />
      {/* water spurt */}
      <path d="M 50 46 Q 44 30 40 38" stroke="#7ec0e8" strokeWidth="1.6" fill="none" opacity="0.8" />
      <path d="M 50 46 Q 56 30 60 38" stroke="#7ec0e8" strokeWidth="1.6" fill="none" opacity="0.8" />
      <circle cx="50" cy="32" r="2" fill="#bce3ff" />
      {/* drops */}
      <circle cx="42" cy="40" r="1" fill="#bce3ff" />
      <circle cx="58" cy="40" r="1" fill="#bce3ff" />
    </g>
  ),
  hospital: () => (
    <g>
      {/* body */}
      <rect x="14" y="38" width="72" height="54" fill="#f0f0f0" stroke="#5a5a60" strokeWidth="1.5" />
      {/* roof */}
      <rect x="10" y="32" width="80" height="8" fill="#d0d0d0" />
      {/* big red cross sign */}
      <rect x="42" y="42" width="16" height="16" fill="#fff" stroke="#a01010" strokeWidth="1" />
      <rect x="48" y="44" width="4" height="12" fill="#d01020" />
      <rect x="44" y="48" width="12" height="4" fill="#d01020" />
      {/* windows */}
      {[20, 32, 60, 72].map((x) => (
        <g key={x}>
          <rect x={x} y="46" width="8" height="8" fill="#bce3ff" stroke="#5a5a60" strokeWidth="0.6" />
          <rect x={x} y="62" width="8" height="8" fill="#bce3ff" stroke="#5a5a60" strokeWidth="0.6" />
          <rect x={x} y="78" width="8" height="8" fill="#bce3ff" stroke="#5a5a60" strokeWidth="0.6" />
        </g>
      ))}
      {/* entrance */}
      <rect x="44" y="76" width="12" height="16" fill="#5a5a60" />
    </g>
  ),
  square: () => (
    <g>
      {/* paving */}
      <rect x="6" y="60" width="88" height="32" fill="#bcb4ac" stroke="#5a5048" strokeWidth="1" />
      {/* radial paving lines */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <line key={i} x1={6 + i * 18} y1="60" x2={6 + i * 18} y2="92" stroke="#9a9088" strokeWidth="0.5" />
      ))}
      <line x1="6" y1="76" x2="94" y2="76" stroke="#9a9088" strokeWidth="0.5" />
      {/* central monument */}
      <rect x="44" y="44" width="12" height="22" fill="#8a8278" />
      <polygon points="42,44 50,30 58,44" fill="#a8a098" />
      <circle cx="50" cy="22" r="4" fill="#fdc640" stroke="#5a4020" strokeWidth="0.6" />
      {/* benches */}
      <rect x="18" y="68" width="14" height="2" fill="#5a3010" />
      <rect x="68" y="68" width="14" height="2" fill="#5a3010" />
    </g>
  ),

  // -------------------- TIER 4 — METROPOLIS (tall, dark glass) --------------------
  airport: () => (
    <g>
      {/* terminal */}
      <rect x="6" y="62" width="88" height="30" fill="#a8c0d8" stroke="#3a5a78" strokeWidth="1.2" />
      {/* control tower */}
      <rect x="42" y="22" width="10" height="40" fill="#9aaec4" stroke="#3a5a78" strokeWidth="1" />
      <rect x="38" y="18" width="18" height="8" fill="#3a5a78" />
      <rect x="40" y="14" width="14" height="6" fill="#bce3ff" stroke="#3a5a78" strokeWidth="0.8" />
      {/* antenna */}
      <line x1="47" y1="14" x2="47" y2="6" stroke="#5a5a60" strokeWidth="1" />
      <circle cx="47" cy="6" r="1.4" fill="#d01020" />
      {/* terminal windows */}
      {[12, 22, 32, 58, 68, 78].map((x) => (
        <rect key={x} x={x} y="70" width="8" height="14" fill="#bce3ff" stroke="#3a5a78" strokeWidth="0.5" />
      ))}
      {/* runway hint */}
      <line x1="6" y1="90" x2="94" y2="90" stroke="#3a3a40" strokeWidth="1.4" strokeDasharray="4 3" />
      {/* tiny plane */}
      <path d="M 70 28 L 80 30 L 86 28 L 80 26 Z" fill="#fff" stroke="#3a5a78" strokeWidth="0.5" />
      <line x1="74" y1="28" x2="76" y2="32" stroke="#3a5a78" strokeWidth="0.5" />
    </g>
  ),
  university: () => (
    <g>
      {/* body */}
      <rect x="14" y="40" width="72" height="52" fill="#d8b88a" stroke="#5a3010" strokeWidth="1.2" />
      {/* dome */}
      <ellipse cx="50" cy="36" rx="22" ry="14" fill="#3a78a8" stroke="#1a4a78" strokeWidth="1" />
      <line x1="50" y1="22" x2="50" y2="14" stroke="#5a3010" strokeWidth="0.8" />
      <circle cx="50" cy="14" r="1.6" fill="#fdc640" />
      {/* arched windows */}
      {[22, 38, 54, 70].map((x) => (
        <g key={x}>
          <path d={`M ${x} 60 L ${x} 74 L ${x + 8} 74 L ${x + 8} 60 Q ${x + 4} 54 ${x} 60 Z`} fill="#bce3ff" stroke="#5a3010" strokeWidth="0.6" />
        </g>
      ))}
      {/* steps */}
      <rect x="40" y="78" width="20" height="3" fill="#a08070" />
      <rect x="36" y="82" width="28" height="3" fill="#bcb4a0" />
      <rect x="32" y="86" width="36" height="6" fill="#d8d0c4" />
      {/* columns */}
      {[34, 44, 54, 64].map((x) => (
        <rect key={x} x={x - 2} y="62" width="3" height="22" fill="#f0e8dc" />
      ))}
    </g>
  ),
  tower: () => (
    <g>
      {/* foundation */}
      <rect x="38" y="80" width="24" height="12" fill="#5a5a60" />
      {/* lattice tower */}
      <polygon points="44,24 56,24 62,80 38,80" fill="#7a3030" stroke="#3a1010" strokeWidth="1.2" />
      {/* lattice cross-bracing */}
      {[30, 40, 50, 60, 70].map((y) => (
        <line key={y} x1="40" y1={y} x2="60" y2={y} stroke="#a04040" strokeWidth="0.5" />
      ))}
      {[34, 46, 58, 70].map((y) => (
        <g key={y}>
          <line x1="42" y1={y - 4} x2="58" y2={y + 4} stroke="#3a1010" strokeWidth="0.4" />
          <line x1="58" y1={y - 4} x2="42" y2={y + 4} stroke="#3a1010" strokeWidth="0.4" />
        </g>
      ))}
      {/* observation deck */}
      <rect x="40" y="38" width="20" height="6" fill="#fdc640" stroke="#5a4020" strokeWidth="0.5" />
      {/* spire */}
      <line x1="50" y1="24" x2="50" y2="10" stroke="#3a1010" strokeWidth="1" />
      <circle cx="50" cy="10" r="1.6" fill="#d01020" />
    </g>
  ),
  stadium: () => (
    <g>
      {/* base ring */}
      <ellipse cx="50" cy="84" rx="44" ry="8" fill="#7a8090" stroke="#3a3a40" strokeWidth="1" />
      <ellipse cx="50" cy="80" rx="40" ry="6" fill="#5cb15c" />
      {/* tiered seats */}
      <ellipse cx="50" cy="68" rx="40" ry="14" fill="none" stroke="#a8a098" strokeWidth="6" />
      <ellipse cx="50" cy="62" rx="36" ry="12" fill="none" stroke="#bcb4ac" strokeWidth="5" />
      <ellipse cx="50" cy="58" rx="32" ry="10" fill="none" stroke="#d0d0d0" strokeWidth="4" />
      {/* roof flaps */}
      <path d="M 10 56 Q 50 38 90 56" stroke="#3a5a78" strokeWidth="2" fill="none" />
      {/* light masts */}
      {[14, 86].map((x) => (
        <g key={x}>
          <line x1={x} y1="56" x2={x} y2="38" stroke="#3a3a40" strokeWidth="1" />
          <rect x={x - 3} y="34" width="6" height="4" fill="#fdc640" />
        </g>
      ))}
    </g>
  ),
  museum: () => (
    <g>
      {/* base steps */}
      <rect x="6" y="86" width="88" height="6" fill="#bcb4ac" />
      {/* body */}
      <rect x="10" y="44" width="80" height="44" fill="#e8e0d0" stroke="#5a5048" strokeWidth="1.5" />
      {/* triangular pediment */}
      <polygon points="6,44 50,18 94,44" fill="#d8d0c0" stroke="#5a5048" strokeWidth="1.5" />
      {/* pediment relief */}
      <circle cx="50" cy="32" r="3" fill="#fdc640" />
      {/* columns (large doric) */}
      {[18, 32, 46, 60, 74].map((x) => (
        <g key={x}>
          <rect x={x - 2} y="44" width="6" height="44" fill="#f8f0e0" />
          <rect x={x - 4} y="42" width="10" height="3" fill="#e8e0d0" />
          <rect x={x - 4} y="86" width="10" height="3" fill="#e8e0d0" />
          {/* fluting */}
          <line x1={x - 1} y1="48" x2={x - 1} y2="84" stroke="#bcb4ac" strokeWidth="0.4" />
          <line x1={x + 1} y1="48" x2={x + 1} y2="84" stroke="#bcb4ac" strokeWidth="0.4" />
          <line x1={x + 3} y1="48" x2={x + 3} y2="84" stroke="#bcb4ac" strokeWidth="0.4" />
        </g>
      ))}
    </g>
  ),

  // -------------------- TIER 5 — MEGAPOLIS (sleek, futuristic) --------------------
  skyscraper: () => (
    <g>
      {/* body — gradient effect via two rects */}
      <rect x="30" y="14" width="40" height="78" fill="#3a5a78" stroke="#1a3a58" strokeWidth="1" />
      <rect x="30" y="14" width="20" height="78" fill="#5a8ab8" />
      {/* windows grid */}
      {Array.from({ length: 9 }).map((_, row) =>
        Array.from({ length: 5 }).map((__, col) => (
          <rect
            key={`${row}-${col}`}
            x={32 + col * 7.5}
            y={20 + row * 8}
            width="5"
            height="5"
            fill={(row + col) % 3 === 0 ? '#fdf6a0' : '#bce3ff'}
            opacity={(row + col) % 5 === 0 ? 0.4 : 1}
          />
        )),
      )}
      {/* roof spire */}
      <polygon points="40,14 50,4 60,14" fill="#1a3a58" />
      <line x1="50" y1="4" x2="50" y2="-2" stroke="#3a3a40" strokeWidth="0.8" />
      <circle cx="50" cy="-2" r="1.4" fill="#d01020" />
    </g>
  ),
  monorail: () => (
    <g>
      {/* support pillars */}
      {[16, 50, 84].map((x) => (
        <rect key={x} x={x - 3} y="50" width="6" height="42" fill="#7a8090" />
      ))}
      {/* track beam */}
      <rect x="6" y="44" width="88" height="6" fill="#a8a098" stroke="#5a5048" strokeWidth="1" />
      <rect x="6" y="42" width="88" height="2" fill="#5a5048" />
      {/* train pod */}
      <rect x="22" y="26" width="56" height="16" rx="8" fill="#3a78b8" stroke="#1a4a78" strokeWidth="1" />
      <rect x="22" y="26" width="56" height="6" rx="3" fill="#5aa0d8" />
      {/* pod windows */}
      {[28, 38, 48, 58, 68].map((x) => (
        <rect key={x} x={x} y="32" width="6" height="6" fill="#bce3ff" stroke="#1a4a78" strokeWidth="0.4" />
      ))}
      {/* nose light */}
      <circle cx="78" cy="34" r="1.6" fill="#fdf6a0" />
    </g>
  ),
  planetarium: () => (
    <g>
      {/* base */}
      <rect x="14" y="62" width="72" height="30" fill="#3a3a50" stroke="#1a1a30" strokeWidth="1.2" />
      {/* dome */}
      <ellipse cx="50" cy="62" rx="40" ry="32" fill="#6a7a9a" stroke="#3a3a50" strokeWidth="1" />
      <ellipse cx="50" cy="62" rx="40" ry="32" fill="url(#dome-grad)" opacity="0.4" />
      {/* dome panel lines */}
      {[20, 30, 40, 50, 60, 70, 80].map((x) => (
        <line key={x} x1={x} y1="62" x2={x} y2={62 - Math.sqrt(Math.max(0, 32 * 32 * (1 - Math.pow((x - 50) / 40, 2))))} stroke="#3a3a50" strokeWidth="0.4" opacity="0.5" />
      ))}
      {/* star + ring decoration */}
      <ellipse cx="50" cy="40" rx="14" ry="3" fill="none" stroke="#fdc640" strokeWidth="1" opacity="0.8" />
      <circle cx="50" cy="40" r="3" fill="#fdc640" />
      {/* entrance */}
      <rect x="42" y="74" width="16" height="18" fill="#1a1a30" />
      <ellipse cx="50" cy="74" rx="8" ry="3" fill="#1a1a30" />
    </g>
  ),
  cathedral: () => (
    <g>
      {/* body */}
      <rect x="14" y="36" width="72" height="56" fill="#c8b890" stroke="#5a3010" strokeWidth="1.2" />
      {/* twin spires */}
      <rect x="14" y="14" width="14" height="22" fill="#a89870" />
      <polygon points="14,14 21,2 28,14" fill="#7a5030" />
      <rect x="72" y="14" width="14" height="22" fill="#a89870" />
      <polygon points="72,14 79,2 86,14" fill="#7a5030" />
      {/* central rose window */}
      <circle cx="50" cy="50" r="9" fill="#5a3010" />
      <circle cx="50" cy="50" r="7" fill="#bce3ff" />
      <line x1="50" y1="43" x2="50" y2="57" stroke="#5a3010" strokeWidth="0.6" />
      <line x1="43" y1="50" x2="57" y2="50" stroke="#5a3010" strokeWidth="0.6" />
      <line x1="44" y1="44" x2="56" y2="56" stroke="#5a3010" strokeWidth="0.6" />
      <line x1="56" y1="44" x2="44" y2="56" stroke="#5a3010" strokeWidth="0.6" />
      {/* arched main door */}
      <path d="M 42 92 L 42 76 Q 42 66 50 66 Q 58 66 58 76 L 58 92 Z" fill="#5a3010" />
      {/* small arched windows */}
      {[20, 70].map((x) => (
        <path key={x} d={`M ${x} 76 L ${x} 64 Q ${x + 4} 58 ${x + 8} 64 L ${x + 8} 76 Z`} fill="#bce3ff" stroke="#5a3010" strokeWidth="0.5" />
      ))}
      {/* crosses on spires */}
      <line x1="21" y1="2" x2="21" y2="-4" stroke="#5a3010" strokeWidth="0.8" />
      <line x1="79" y1="2" x2="79" y2="-4" stroke="#5a3010" strokeWidth="0.8" />
    </g>
  ),
  satellite_dish: () => (
    <g>
      {/* base */}
      <rect x="42" y="78" width="16" height="14" fill="#5a5a60" />
      {/* mount */}
      <line x1="50" y1="78" x2="50" y2="50" stroke="#3a3a40" strokeWidth="2" />
      {/* dish */}
      <ellipse cx="50" cy="46" rx="32" ry="12" fill="#d8d8e0" stroke="#5a5a60" strokeWidth="1" transform="rotate(-15 50 46)" />
      <ellipse cx="50" cy="46" rx="32" ry="12" fill="url(#dish-grad)" opacity="0.5" transform="rotate(-15 50 46)" />
      {/* receiver arm */}
      <line x1="60" y1="40" x2="74" y2="22" stroke="#3a3a40" strokeWidth="1.5" />
      <circle cx="74" cy="22" r="3" fill="#5a5a60" />
      {/* signal waves */}
      <path d="M 78 18 Q 86 18 86 26" stroke="#fdc640" strokeWidth="1" fill="none" />
      <path d="M 80 14 Q 92 14 92 26" stroke="#fdc640" strokeWidth="0.8" fill="none" opacity="0.7" />
      <path d="M 82 10 Q 96 10 96 26" stroke="#fdc640" strokeWidth="0.6" fill="none" opacity="0.5" />
    </g>
  ),
};

// Re-export tier helpers for the parent cityscape so it can size and color
// per-tier groups consistently.
export const BUILDING_LABELS = LABELS;
export const TIER_HEIGHT_MULTIPLIER: Record<number, number> = {
  1: 0.78,
  2: 0.88,
  3: 0.95,
  4: 1.05,
  5: 1.15,
};
