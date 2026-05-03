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
    bullets: ['Tenantlar boshqaruvi', 'Darslar yaratish', 'Tahlillar', 'ML monitoring'],
  },
  {
    name: 'Filadmin',
    color: '#f97316',
    blurb: 'Filial direktori uchun panel.',
    bullets: ['Filial xodimlari', 'To’lovlar', 'Ogohlantirishlar', 'Targ’ibot'],
  },
  {
    name: 'Manager',
    color: '#10b981',
    blurb: 'Qizil/sariq o’quvchilar bilan ishlash.',
    bullets: ['Qizil/sariq o’quvchilar', 'KPI mukofotlash', '1:1 sessiya', 'Sertifikatlar'],
  },
  {
    name: 'Mentor',
    color: '#1cb0f6',
    blurb: 'O’z guruhi bilan kunlik aloqa.',
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
    bullets: ['Yo’l xaritasi', 'AI suhbat', 'Do’stlar, hamkorlik', 'Sertifikatlar'],
  },
];

export function Roles() {
  return (
    <section
      id="roles"
      aria-labelledby="roles-h2"
      className="bg-[#fffaf0] scroll-mt-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="max-w-2xl">
          <span className="text-xs uppercase tracking-widest font-extrabold text-[#f97316]">
            Multi-rol panel
          </span>
          <h2
            id="roles-h2"
            className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1e1b4b] tracking-tight"
          >
            Hammaning o&apos;z paneli bor.
          </h2>
          <p className="mt-4 text-lg text-[#475569] font-semibold">
            Olti xil rol — har birining vazifasi va interfeysi alohida o&apos;ylangan. Filadmindan
            o&apos;quvchigacha — bir tizimda, lekin hech kim ortiqcha narsani ko&apos;rmaydi.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ROLES.map((role) => (
            <article
              key={role.name}
              className="lift bg-white rounded-2xl border border-[#e8e0d0] overflow-hidden"
            >
              {/* Top color band */}
              <div className="h-2 w-full" style={{ backgroundColor: role.color }} aria-hidden />
              <div className="p-6">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: role.color }}
                    aria-hidden
                  />
                  <h3 className="text-xl font-extrabold text-[#1e1b4b] tracking-tight">
                    {role.name}
                  </h3>
                </div>
                <p className="mt-1.5 text-sm text-[#475569] font-semibold">
                  {role.blurb}
                </p>

                <ul className="mt-5 space-y-2.5">
                  {role.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-sm font-semibold text-[#1e1b4b]">
                      <Check
                        size={16}
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
