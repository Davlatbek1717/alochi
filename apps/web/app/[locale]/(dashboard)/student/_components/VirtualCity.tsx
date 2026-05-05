'use client';
import Building, {
  BUILDING_LABELS,
  TIER_HEIGHT_MULTIPLIER,
} from './buildings/Building';

// Per spec §17.1: students BUILD their own city as they progress. This
// component renders the per-student building list as an isometric-ish
// SVG cityscape — sky, ground, sun + clouds, with each building drawn
// as an inline SVG component. The newest building gets a bounce-in
// animation plus a transient "yangi qurilish" gold chip.

export type VirtualCityBuilding = {
  id: string;
  type: string;
  tier: number;
  index: number;
  unlockedAt: string;
  isNewest: boolean;
};

export type VirtualCityProps = {
  // New shape (preferred)
  buildings?: VirtualCityBuilding[] | string[];
  tier?: { level: number; name: string };
  lessonsCompleted?: number;
  nextTierAt?: number | null;
  // Back-compat shape
  level?: number;
  name?: string;
  nextLevelAt?: number | null;
};

const TIER_NAMES: Record<number, string> = {
  1: 'Qishloq',
  2: 'Shaharcha',
  3: 'Shahar',
  4: 'Metropolis',
  5: 'Megapolis',
};

const TIER_COLORS: Record<number, { sky: string; ground: string; accent: string }> = {
  1: { sky: 'from-[#fdf6e3] via-[#ffe8b8] to-[#a3d8f5]', ground: '#a3d09a', accent: '#a04020' },
  2: { sky: 'from-[#fff4d6] via-[#ffe0a8] to-[#a8d8f8]', ground: '#9bc88e', accent: '#a05030' },
  3: { sky: 'from-[#e8f0fa] via-[#cce0f0] to-[#a0c8e8]', ground: '#8ab87a', accent: '#3a78b8' },
  4: { sky: 'from-[#d8e0e8] via-[#b8c8d8] to-[#7aa0c8]', ground: '#7aa86a', accent: '#3a3a40' },
  5: { sky: 'from-[#c8d4e8] via-[#a0b8d0] to-[#3a5a78]', ground: '#5a8a4a', accent: '#1a1a30' },
};

export default function VirtualCity(props: VirtualCityProps) {
  // Normalise input. If buildings is a string[] (back-compat), wrap each
  // into a synthetic record so the renderer has a stable shape. The
  // synthetic case loses isNewest/index detail but still draws.
  const rawBuildings = props.buildings ?? [];
  const buildings: VirtualCityBuilding[] =
    rawBuildings.length === 0
      ? []
      : typeof rawBuildings[0] === 'string'
      ? (rawBuildings as string[]).map((type, i, arr) => ({
          id: `${type}-${i}`,
          type,
          tier: tierForIndex(i),
          index: i,
          unlockedAt: new Date().toISOString(),
          isNewest: i === arr.length - 1,
        }))
      : (rawBuildings as VirtualCityBuilding[]);

  const tierLevel = props.tier?.level ?? props.level ?? tierForIndex(buildings.length - 1);
  const tierName = props.tier?.name ?? props.name ?? TIER_NAMES[tierLevel] ?? 'Qishloq';
  const lessonsCompleted = props.lessonsCompleted ?? buildings.length;
  const nextThreshold = props.nextTierAt ?? props.nextLevelAt ?? null;

  const progress =
    nextThreshold == null
      ? 100
      : nextThreshold > 0
      ? Math.min((lessonsCompleted / nextThreshold) * 100, 100)
      : 100;

  const palette = TIER_COLORS[tierLevel] ?? TIER_COLORS[1];

  return (
    <div className="bg-white rounded-3xl p-4 shadow-sm border border-[#ede9e1] space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden>
            {'\u{1F3D9}\u{FE0F}'}
          </span>
          <div>
            <h2 className="font-extrabold text-[#3c3c3c] text-base">
              {tierName}
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#777]">
              Daraja {tierLevel} · {buildings.length} ta qurilish
            </p>
          </div>
        </div>
        <span className="text-xs font-bold text-[#46a302]">
          {lessonsCompleted}
          {nextThreshold != null && (
            <span className="text-[#777]"> / {nextThreshold} dars</span>
          )}
        </span>
      </div>

      {/* Progress bar to next tier */}
      <div className="w-full bg-[#f3eedf] rounded-full h-2 border border-[#e8e0d0] overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* The cityscape */}
      <div
        className={`relative aspect-[16/9] rounded-2xl overflow-hidden bg-gradient-to-b ${palette.sky} border border-[#e8e0d0]`}
      >
        {/* Sun */}
        <div
          aria-hidden
          className="absolute top-3 right-5 w-10 h-10 rounded-full bg-yellow-300 shadow-[0_0_28px_8px_rgba(252,211,77,0.7)]"
        />

        {/* Clouds */}
        <div aria-hidden className="absolute top-4 left-4 opacity-80">
          <Cloud />
        </div>
        <div aria-hidden className="absolute top-8 left-[36%] opacity-60">
          <Cloud small />
        </div>
        <div aria-hidden className="absolute top-2 left-[60%] opacity-70">
          <Cloud />
        </div>

        {/* Ground line at 70% height */}
        <div
          aria-hidden
          className="absolute left-0 right-0 bottom-0 h-[30%]"
          style={{
            background: `linear-gradient(to bottom, ${palette.ground} 0%, ${darken(palette.ground, 12)} 100%)`,
          }}
        />
        {/* Grass accent line */}
        <div
          aria-hidden
          className="absolute left-0 right-0 h-[3px] bottom-[30%]"
          style={{ background: darken(palette.ground, 18) }}
        />

        {/* Buildings — laid out left→right with subtle depth offset per tier */}
        <div className="absolute inset-0">
          {buildings.length === 0 ? (
            <EmptyCity />
          ) : (
            <BuildingLayout buildings={buildings} />
          )}
        </div>
      </div>

      {/* Footer — tier name + spec quote (subtle) */}
      <p className="text-[11px] text-[#777] text-center font-semibold leading-snug">
        Har dars o&apos;tganda yangi qurilish qo&apos;shiladi.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- */

function BuildingLayout({ buildings }: { buildings: VirtualCityBuilding[] }) {
  // Layout strategy:
  // - 8 columns per "row", 6 rows max visible at once → 48 buildings on screen.
  // - For students with > 48 buildings, only the latest 48 are drawn (older
  //   ones are summarised by the count chip up top).
  // - Each tier's buildings stack on a slightly higher baseline to imply depth.
  const visible = buildings.slice(-48);

  return (
    <>
      {visible.map((b) => {
        const localIndex = b.index - (buildings.length - visible.length);
        const col = localIndex % 8;
        const row = Math.floor(localIndex / 8);
        // Closer rows render on top; further rows sit slightly higher.
        const left = (col / 8) * 100 + 100 / 16; // centred in column
        const baseBottom = 30 + row * 8; // rows above ground
        const heightMul = TIER_HEIGHT_MULTIPLIER[b.tier] ?? 1;
        const size = 56 * heightMul;
        return (
          <div
            key={b.id}
            className={`absolute -translate-x-1/2 ${
              b.isNewest ? 'motion-safe:animate-[bounce-in_500ms_ease-out] z-10' : ''
            }`}
            style={{
              left: `${left}%`,
              bottom: `${baseBottom}%`,
              width: size,
              height: size,
            }}
            title={`${BUILDING_LABELS[b.type] ?? b.type} · ${formatDate(b.unlockedAt)}`}
          >
            <Building type={b.type} width={size} height={size} />
            {b.isNewest && (
              <>
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap bg-amber-400 text-amber-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-amber-600 shadow motion-safe:animate-[bounce-in_500ms_ease-out]">
                  +1 yangi qurilish
                </div>
                {/* Sparkle particles */}
                <Sparkle x="20%" y="10%" delay={0} />
                <Sparkle x="80%" y="20%" delay={120} />
                <Sparkle x="50%" y="-10%" delay={240} />
              </>
            )}
          </div>
        );
      })}
    </>
  );
}

function Sparkle({ x, y, delay }: { x: string; y: string; delay: number }) {
  return (
    <span
      aria-hidden
      className="absolute text-[14px] motion-safe:animate-[pop_900ms_ease-out_infinite]"
      style={{ left: x, top: y, animationDelay: `${delay}ms` }}
    >
      {'✨'}
    </span>
  );
}

function Cloud({ small = false }: { small?: boolean }) {
  const w = small ? 36 : 56;
  const h = small ? 20 : 28;
  return (
    <svg width={w} height={h} viewBox="0 0 56 28" fill="white">
      <ellipse cx="14" cy="18" rx="14" ry="9" />
      <ellipse cx="30" cy="14" rx="16" ry="11" />
      <ellipse cx="44" cy="20" rx="11" ry="7" />
    </svg>
  );
}

function EmptyCity() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
      <div className="text-5xl mb-2" aria-hidden>
        {'\u{1F423}'}
      </div>
      <p className="font-extrabold text-[#3c3c3c]">Sizning shahringiz hali bo&apos;sh</p>
      <p className="text-xs text-[#777] font-semibold mt-1">
        Birinchi darsni boshlang — Aloqush sizga uy qurib beradi!
      </p>
    </div>
  );
}

/* helpers */

function tierForIndex(idx: number): number {
  const n = idx + 1;
  if (n <= 50) return 1;
  if (n <= 150) return 2;
  if (n <= 300) return 3;
  if (n <= 500) return 4;
  return 5;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('uz-UZ');
  } catch {
    return '';
  }
}

// Tiny color shifter — takes a hex like #a3d09a and returns a darker shade.
function darken(hex: string, percent: number): string {
  if (!hex.startsWith('#') || hex.length !== 7) return hex;
  const r = clamp(Math.round(parseInt(hex.slice(1, 3), 16) * (1 - percent / 100)));
  const g = clamp(Math.round(parseInt(hex.slice(3, 5), 16) * (1 - percent / 100)));
  const b = clamp(Math.round(parseInt(hex.slice(5, 7), 16) * (1 - percent / 100)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
function clamp(n: number) {
  return Math.max(0, Math.min(255, n));
}
