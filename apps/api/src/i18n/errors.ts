/**
 * Centralised API error message registry — Uzbek-only.
 * Services call translateError(key) instead of hardcoding strings so
 * every error path uses a registered, reviewable message.
 */
export const API_ERRORS = {
  login_failed: "Login yoki parol noto'g'ri",
  blocked_warning: 'Profil bloklangan (ogohlantirishlar)',
  blocked_payment: "To'lov amalga oshirilmagan",
  profile_blocked: 'Profilingiz bloklangan',
  refresh_invalid: 'Refresh token yaroqsiz',
  multiple_tenants:
    'Bir xil login bir nechta markazda topildi. Iltimos, markaz nomini kiriting.',
  tenant_not_found: 'Tenant topilmadi',
  user_not_found: 'Foydalanuvchi topilmadi',
  duplicate_login: 'Bu login allaqachon mavjud',
  lesson_not_found: 'Dars topilmadi',
  exam_not_found: 'Imtihon topilmadi',
  template_not_found: 'Shablon topilmadi',
  branding_not_found: 'Tenant topilmadi',
  order_conflict: 'Bu tartib raqami allaqachon mavjud',
  no_questions: 'Bu darsda baholanadigan savollar mavjud emas',
  not_enough_questions:
    'Duel uchun yetarli savol topilmadi (kamida 10 ta kerak)',
  no_shared_lessons:
    'Umumiy bajarilgan dars topilmadi — duel uchun kamida 1 ta kerak',
  too_many_active_duels: "Bir vaqtda faqat 2 ta faol duel bo'lishi mumkin",
  forbidden: "Ruxsat yo'q",
  progress_exists: "Darsda o'quvchi progressi bor. O'chirib bo'lmaydi.",
  setting_key_invalid: "Noma'lum sozlama kalitlari",
  exam_already_done: 'Imtihon allaqachon yakunlangan',
  student_not_found: "O'quvchi topilmadi",
  parent_not_linked: 'Ota-ona Telegram ulanmagan',
  face_not_enrolled: "Yuz ro'yxatdan o'tmagan",
} as const;

export type ErrorKey = keyof typeof API_ERRORS;

/**
 * Pure translation function — returns the Uzbek string for a known key,
 * or the key itself when missing (so callers can surface a hint instead
 * of an empty string).
 */
export function translateError(key: ErrorKey): string {
  const entry = API_ERRORS[key];
  return entry ?? key;
}
