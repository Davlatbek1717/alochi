import { Check } from 'lucide-react';

interface Role {
  name: string;
  color: string;
  blurb: string;
  bullets: string[];
}

const ROLES: Role[] = [
  {
    name: 'Superadmin',
    color: '#6d28d9',
    blurb: 'Platforma darajasidagi operator.',
    bullets: [
      'Tenantlar boshqaruvi',
      'Darslar yaratish',
      'Tahlillar',
      'ML monitoring',
    ],
  },
  {
    name: 'Filadmin',
    color: '#f59e0b',
    blurb: 'Filial direktori uchun panel.',
    bullets: [
      'Filial xodimlari',
      "To'lovlar",
      'Ogohlantirishlar',
      "Targ'ibot",
    ],
  },
  {
    name: 'Manager',
    color: '#15803d',
    blurb: "Qizil/sariq o'quvchilar bilan ishlash.",
    bullets: [
      "Qizil/sariq o'quvchilar",
      'KPI mukofotlash',
      '1:1 sessiya',
      'Sertifikatlar',
    ],
  },
  {
    name: 'Mentor',
    color: '#1cb0f6',
    blurb: "O'z guruhi bilan kunlik aloqa.",
    bullets: ['Guruh nazorati', 'Status berish', 'Davomat', 'AI xato tahlili'],
  },
  {
    name: 'Tester',
    color: '#ce82ff',
    blurb: 'Imtihon va texnik nazorat.',
    bullets: ['Imtihon navbati', 'Texnik yordam', 'Davomat', 'Hisobotlar'],
  },
  {
    name: "O'quvchi",
    color: '#fbbf24',
    blurb: 'Duolingo darajasidagi shaxsiy panel.',
    bullets: [
      "Yo'l xaritasi",
      'AI suhbat',
      "Do'stlar, hamkorlik",
      'Sertifikatlar',
    ],
  },
];

export function Roles() {
  return (
    <section
      id="roles"
      aria-labelledby="roles-h2"
      className="relative bg-[var(--surface-2)] border-y border-[var(--line)] scroll-mt-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
        <div className="max-w-3xl">
          <span className="section-eyebrow">Multi-rol panel</span>
          <h2
            id="roles-h2"
            className="font-display mt-5 text-4xl sm:text-5xl lg:text-6xl font-bold text-[var(--ink)] tracking-[-0.02em] leading-[1.05]"
          >
            Hammaning{' '}
            <span className="italic font-medium text-[var(--brand)]">
              o&apos;z paneli
            </span>{' '}
            bor.
          </h2>
          <p className="mt-6 text-lg text-[var(--ink-2)] leading-relaxed max-w-2xl">
            Olti xil rol — har birining vazifasi va interfeysi alohida
            o&apos;ylangan. Filadmindan o&apos;quvchigacha — bir tizimda, lekin
            hech kim ortiqcha narsani ko&apos;rmaydi.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
          {ROLES.map((role) => (
            <article
              key={role.name}
              className={[
                'lift relative overflow-hidden',
                'bg-[var(--surface)] rounded-3xl',
                'border border-[var(--line)]',
              ].join(' ')}
            >
              {/* Vertical accent stripe — editorial detail */}
              <div
                className="absolute top-0 bottom-0 left-0 w-1.5"
                style={{ backgroundColor: role.color }}
                aria-hidden
              />

              {/* Soft glow corner */}
              <div
                aria-hidden
                className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-15 blur-2xl"
                style={{ backgroundColor: role.color }}
              />

              <div className="relative p-7 pl-8">
                <div className="flex items-center gap-3">
                  <span
                    className="grid place-items-center w-10 h-10 rounded-xl text-white shrink-0"
                    style={{
                      backgroundColor: role.color,
                      boxShadow: `0 6px 16px -6px ${role.color}88`,
                    }}
                    aria-hidden
                  >
                    <span className="font-display font-bold text-base">
                      {role.name[0]}
                    </span>
                  </span>
                  <h3 className="font-display text-xl font-bold text-[var(--ink)] tracking-[-0.005em]">
                    {role.name}
                  </h3>
                </div>
                <p className="mt-3 text-[15px] text-[var(--ink-2)] leading-relaxed">
                  {role.blurb}
                </p>

                <ul className="mt-5 space-y-2.5">
                  {role.bullets.map((b) => (
                    <li
                      key={b}
                      className="flex items-start gap-2.5 text-sm text-[var(--ink)]"
                    >
                      <Check
                        size={15}
                        strokeWidth={3.25}
                        className="shrink-0 mt-0.5"
                        style={{ color: role.color }}
                      />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
