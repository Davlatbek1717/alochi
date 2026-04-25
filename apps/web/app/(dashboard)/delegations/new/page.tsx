'use client';
import { useState } from 'react';

export default function NewDelegationPage() {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Sabab maydoni majburiy');
      return;
    }
    alert('Delegatsiya yaratildi (mock)');
  }

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Yangi Delegatsiya</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Oluvchi xodim *</label>
          <select className="w-full border rounded-lg px-3 py-2">
            <option>Alisher Toshev (Manager)</option>
            <option>Kamola Nazarova (Mentor)</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Boshlanish</label>
            <input type="date" className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tugash</label>
            <input type="date" className="w-full border rounded-lg px-3 py-2" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Sabab *</label>
          <textarea
            value={reason}
            onChange={(e) => { setReason(e.target.value); setError(''); }}
            rows={3}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Nima uchun delegatsiya bermoqchisiz?"
          />
          {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
        </div>

        <button
          type="submit"
          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium"
        >
          Yuborish
        </button>
      </form>
    </div>
  );
}
