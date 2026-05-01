'use client';
import { useEffect, useRef, useState } from 'react';
import { X, Check, ArrowRight } from 'lucide-react';
import { apiRequest, ApiError } from '@/lib/api';

type Size = 'small' | 'mid' | 'large';

interface Props {
  open: boolean;
  onClose: () => void;
}

const SIZE_TO_ENUM: Record<Size, 'small' | 'medium' | 'large'> = {
  small: 'small',
  mid: 'medium',
  large: 'large',
};

export function DemoForm({ open, onClose }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [center, setCenter] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+998 ');
  const [email, setEmail] = useState('');
  const [size, setSize] = useState<Size>('mid');
  const [message, setMessage] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);

  // Lock scroll, escape to close, focus trap (simple)
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    // Focus first input
    requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLInputElement>('input[name="center"]')?.focus();
    });
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await apiRequest('/contact-requests', {
        method: 'POST',
        body: JSON.stringify({
          centerName: center.trim(),
          contactName: name.trim(),
          phone: phone.trim(),
          ...(email.trim() ? { email: email.trim() } : {}),
          centerSize: SIZE_TO_ENUM[size],
          ...(message.trim() ? { message: message.trim() } : {}),
        }),
      });
      setSuccess(true);
    } catch (err) {
      const fallback = "Yuborib bo'lmadi. Keyinroq qayta urinib ko'ring.";
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setErrorMsg('Juda ko’p urinish. Bir daqiqadan so’ng qayta urinib ko’ring.');
        } else {
          setErrorMsg(err.message || fallback);
        }
      } else {
        setErrorMsg(fallback);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    onClose();
    // Reset after close animation
    setTimeout(() => {
      setSuccess(false);
      setSubmitting(false);
      setErrorMsg(null);
    }, 200);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Modalni yopish"
        onClick={handleClose}
        className="absolute inset-0 bg-[#0f172a]/60 backdrop-blur-sm cursor-default"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-[#e8e0d0] overflow-hidden motion-safe:[animation:bounce-in_320ms_ease-out]"
      >
        <button
          type="button"
          onClick={handleClose}
          aria-label="Yopish"
          className="absolute top-3.5 right-3.5 grid place-items-center w-9 h-9 rounded-full bg-[#0f172a]/5 hover:bg-[#0f172a]/10 text-[#1e1b4b] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6d28d9]"
        >
          <X size={18} strokeWidth={2.5} />
        </button>

        {success ? (
          <div className="px-6 sm:px-8 py-12 text-center">
            <div
              className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-[#10b981] text-white shadow-[0_8px_0_0_#059669] motion-safe:[animation:bounce-in_500ms_ease-out]"
            >
              <Check size={28} strokeWidth={3.5} />
            </div>
            <h2 id="demo-title" className="mt-5 text-2xl font-extrabold text-[#1e1b4b] tracking-tight">
              Yuborildi!
            </h2>
            <p className="mt-2 text-[15px] font-semibold text-[#475569]">
              24 soat ichida bog&apos;lanamiz va platformani 30 daqiqada ko&apos;rsatamiz.
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="mt-6 inline-flex items-center justify-center gap-2 bg-[#6d28d9] hover:bg-[#5b21b6] text-white font-extrabold text-sm px-6 py-3 rounded-xl shadow-[0_6px_0_0_#4c1d95] active:translate-y-[2px] active:shadow-[0_2px_0_0_#4c1d95] transition-all"
            >
              Yopish
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 sm:px-8 py-7">
            <h2 id="demo-title" className="text-2xl font-extrabold text-[#1e1b4b] tracking-tight">
              Demo so&apos;rash
            </h2>
            <p className="mt-1.5 text-sm font-semibold text-[#64748b]">
              Bizning jamoa siz bilan 24 soat ichida bog&apos;lanadi.
            </p>

            <div className="mt-6 space-y-4">
              <Field label="Markaz nomi" required>
                <input
                  name="center"
                  type="text"
                  required
                  value={center}
                  onChange={(e) => setCenter(e.target.value)}
                  placeholder="Masalan: Bilim markazi"
                  className="input"
                />
              </Field>

              <Field label="F.I.O." required>
                <input
                  name="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Aliyev Akmal"
                  className="input"
                />
              </Field>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Telefon" required>
                  <input
                    name="phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+998 90 123 45 67"
                    className="input"
                  />
                </Field>
                <Field label="Email">
                  <input
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="director@center.uz"
                    className="input"
                  />
                </Field>
              </div>

              <fieldset>
                <legend className="text-xs font-extrabold uppercase tracking-widest text-[#1e1b4b] mb-2">
                  Markaz hajmi
                </legend>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { v: 'small', l: '< 50' },
                    { v: 'mid', l: '51–200' },
                    { v: 'large', l: '200+' },
                  ] as const).map((opt) => {
                    const active = size === opt.v;
                    return (
                      <label
                        key={opt.v}
                        className={[
                          'cursor-pointer text-center rounded-xl border-2 px-2 py-2.5 text-sm font-extrabold transition-colors',
                          active
                            ? 'bg-[#6d28d9] text-white border-[#6d28d9]'
                            : 'bg-white text-[#1e1b4b] border-[#e8e0d0] hover:border-[#6d28d9]/40',
                        ].join(' ')}
                      >
                        <input
                          type="radio"
                          name="size"
                          value={opt.v}
                          checked={active}
                          onChange={() => setSize(opt.v)}
                          className="sr-only"
                        />
                        {opt.l}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <Field label="Xabar (ixtiyoriy)">
                <textarea
                  name="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  placeholder="Bizga qanday yordam kerakligini yozing"
                  className="input resize-none"
                />
              </Field>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="mt-5 rounded-xl border-2 border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm font-bold text-[#b91c1c]"
              >
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 bg-[#6d28d9] hover:bg-[#5b21b6] disabled:bg-[#a78bfa] disabled:cursor-not-allowed text-white font-extrabold text-base px-6 py-3.5 rounded-2xl shadow-[0_6px_0_0_#4c1d95] active:translate-y-[2px] active:shadow-[0_2px_0_0_#4c1d95] disabled:shadow-[0_4px_0_0_#7c3aed] transition-all"
            >
              {submitting ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Yuborish
                  <ArrowRight size={18} strokeWidth={2.75} />
                </>
              )}
            </button>

            <p className="mt-3 text-[11px] font-semibold text-[#94a3b8] text-center">
              Yuborib, siz maxfiylik siyosatimiz bilan rozisiz.
            </p>
          </form>
        )}
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          background: #fffaf0;
          border: 2px solid #e8e0d0;
          border-radius: 12px;
          padding: 10px 14px;
          font-size: 15px;
          font-weight: 600;
          color: #1e1b4b;
          font-family: var(--font-nunito), system-ui, sans-serif;
          transition: border-color 0.15s, background 0.15s;
        }
        .input::placeholder {
          color: #94a3b8;
          font-weight: 600;
        }
        .input:focus {
          outline: none;
          border-color: #6d28d9;
          background: #fff;
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-extrabold uppercase tracking-widest text-[#1e1b4b] mb-1.5">
        {label}
        {required && <span className="text-[#f97316] ml-1">*</span>}
      </span>
      {children}
    </label>
  );
}
