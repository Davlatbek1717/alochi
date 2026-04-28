import { LoginForm } from './_components/LoginForm';
import { GraduationCap, Zap, Trophy, BarChart2 } from 'lucide-react';

const FEATURES = [
  { icon: <Zap size={16} />, text: 'AI bilan shaxsiy o\'quv yo\'li' },
  { icon: <Trophy size={16} />, text: 'Gamifikatsiya va turnirlar' },
  { icon: <BarChart2 size={16} />, text: 'Real vaqt tahlili' },
];

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col lg:flex-row">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-1 flex-col justify-between px-16 py-14 relative overflow-hidden">
        {/* Glow blobs */}
        <div className="absolute top-[-80px] left-[-80px] w-80 h-80 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)' }} />
        <div className="absolute bottom-[-60px] right-[-60px] w-64 h-64 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)' }} />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
              <GraduationCap size={20} className="text-white" />
            </div>
            <span className="text-white text-xl font-black tracking-tight">A&apos;lochi</span>
          </div>

          <h1 className="text-4xl font-black text-white leading-tight mb-4">
            O&apos;rganish —<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">
              yangi avlod
            </span>
          </h1>
          <p className="text-[#94a3b8] text-base leading-relaxed max-w-xs">
            Ingliz tili o&apos;rganuvchilar uchun zamonaviy platforma. AI, gamifikatsiya va real vaqt tahlili.
          </p>

          <div className="mt-10 space-y-3">
            {FEATURES.map((f) => (
              <div key={f.text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-violet-400 shrink-0">
                  {f.icon}
                </div>
                <span className="text-[#94a3b8] text-sm">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[#475569] text-xs relative z-10">© 2025 A&apos;lochi. Barcha huquqlar himoyalangan.</p>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center px-6 py-14 lg:bg-[#f7f4ef]">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
              <GraduationCap size={20} className="text-white" />
            </div>
            <span className="text-white text-xl font-black tracking-tight">A&apos;lochi</span>
          </div>

          <div className="mb-8">
            <h2 className="text-[#0f172a] text-2xl font-black lg:block hidden">Xush kelibsiz</h2>
            <h2 className="text-white text-2xl font-black lg:hidden">Xush kelibsiz</h2>
            <p className="text-[#64748b] text-sm mt-1 lg:block hidden">Hisobingizga kiring</p>
            <p className="text-[#94a3b8] text-sm mt-1 lg:hidden">Hisobingizga kiring</p>
          </div>

          <div className="bg-white rounded-[24px] p-6 shadow-sm border border-[#ede9e1]">
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}
