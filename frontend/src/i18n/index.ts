import { createI18n } from 'vue-i18n';
import en from './en.json';
import km from './km.json';

const savedLocale = localStorage.getItem('mekong-locale');
const i18n = createI18n({
  legacy: false,
  locale: savedLocale === 'km' ? 'km' : 'en',
  fallbackLocale: 'en',
  messages: { en, km }
});
document.documentElement.lang = savedLocale === 'km' ? 'km' : 'en';

export function setLocale(locale: 'en' | 'km') {
  i18n.global.locale.value = locale;
  localStorage.setItem('mekong-locale', locale);
  document.documentElement.lang = locale;
}

export default i18n;