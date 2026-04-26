import Link from 'next/link';

export default function SuperadminDashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Superadmin Paneli</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          href="/superadmin/lessons"
          className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow border border-transparent hover:border-indigo-200"
        >
          <div className="text-3xl mb-2">📚</div>
          <h2 className="font-semibold text-gray-900">Darslar</h2>
          <p className="text-sm text-gray-500 mt-1">Dars yaratish, tahrirlash, nashr qilish</p>
        </Link>

        <Link
          href="/superadmin/payments"
          className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow border border-transparent hover:border-indigo-200"
        >
          <div className="text-3xl mb-2">💰</div>
          <h2 className="font-semibold text-gray-900">To&apos;lovlar</h2>
          <p className="text-sm text-gray-500 mt-1">Qarzdorlar hisoboti, filial statistikasi</p>
        </Link>

        <Link
          href="/superadmin/users"
          className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow border border-transparent hover:border-indigo-200"
        >
          <div className="text-3xl mb-2">👥</div>
          <h2 className="font-semibold text-gray-900">Foydalanuvchilar</h2>
          <p className="text-sm text-gray-500 mt-1">Yaratish, tahrirlash, faollashtirish</p>
        </Link>

        <Link
          href="/superadmin/branches"
          className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow border border-transparent hover:border-indigo-200"
        >
          <div className="text-3xl mb-2">🏢</div>
          <h2 className="font-semibold text-gray-900">Filiallar</h2>
          <p className="text-sm text-gray-500 mt-1">Qo&apos;shish, nomini o&apos;zgartirish</p>
        </Link>

        <Link
          href="/superadmin/keywords"
          className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow border border-transparent hover:border-indigo-200"
        >
          <div className="text-3xl mb-2">🚫</div>
          <h2 className="font-semibold text-gray-900">Taqiqlangan so&apos;zlar</h2>
          <p className="text-sm text-gray-500 mt-1">Chat filtrlash uchun kalit so&apos;zlar</p>
        </Link>
      </div>
    </div>
  );
}
