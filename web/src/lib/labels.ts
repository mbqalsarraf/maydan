import { useApp } from './app'
import type { Band, Listing } from './types'

const MAP: Record<string, [string, string]> = {
  // areas
  Salmiya: ['Salmiya', 'السالمية'], Hawalli: ['Hawalli', 'حولي'], Jabriya: ['Jabriya', 'الجابرية'],
  'Kuwait City': ['Kuwait City', 'مدينة الكويت'], Shuwaikh: ['Shuwaikh', 'الشويخ'], Mishref: ['Mishref', 'مشرف'],
  Fahaheel: ['Fahaheel', 'الفحيحيل'], Online: ['Online', 'عبر الإنترنت'],
  // categories
  arts: ['Arts', 'فنون'], food: ['Food', 'طعام'], sports: ['Sports', 'رياضة'], outdoors: ['Outdoors', 'هواء طلق'],
  learning: ['Learning', 'تعلّم'], family: ['Family', 'عائلي'], home: ['Home services', 'خدمات منزلية'],
  // types
  event: ['Event', 'فعالية'], course: ['Course', 'دورة'], workshop: ['Workshop', 'ورشة'], service: ['Service', 'خدمة'],
  // levels
  all: ['All levels', 'جميع المستويات'], beginner: ['Beginner', 'مبتدئ'], intermediate: ['Intermediate', 'متوسط'], advanced: ['Advanced', 'متقدم'],
  // participant age bands
  adult: ['Adult (18+)', 'بالغ (18+)'], teen_14_17: ['Teen, 14–17', 'يافع، 14–17'], child_10_13: ['Child, 10–13', 'طفل، 10–13'],
  child_6_9: ['Child, 6–9', 'طفل، 6–9'], child_3_5: ['Child, 3–5', 'طفل، 3–5'],
}

export function useLabels() {
  const { lang, L } = useApp()
  const label = (key: string) => (MAP[key] ? MAP[key][lang === 'ar' ? 1 : 0] : key)
  const title = (l: Pick<Listing, 'title_en' | 'title_ar'>) => (lang === 'ar' ? l.title_ar : l.title_en)
  const pick = (en: string, ar: string) => (lang === 'ar' ? ar || en : en || ar)
  const ages = (min: number, max: number | null) =>
    max === null
      ? min <= 3 ? L('All ages (3+)', 'جميع الأعمار (3+)') : min >= 18 ? L('Adults only (18+)', 'للكبار فقط (18+)') : L(`Ages ${min}+`, `من عمر ${min} فما فوق`)
      : L(`Ages ${min}–${max}`, `الأعمار ${min}–${max}`)
  const band = (b: Band) => label(b)
  return { label, title, pick, ages, band }
}
