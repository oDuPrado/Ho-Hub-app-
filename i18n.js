import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'react-native-localize';

import en from './lib/locales/en.json';
import pt from './lib/locales/pt.json';
import es from './lib/locales/es.json';

const resources = {
  en: { translation: en },
  pt: { translation: pt },
  es: { translation: es },
};

// Detecta o idioma do dispositivo automaticamente
const languageDetector = {
  type: 'languageDetector',
  async: true,
  detect: (callback) => {
    const supportedLanguages = ['en','es'];
    const bestLanguage = Localization.getLocales()[0]?.languageCode;
    if (supportedLanguages.includes(bestLanguage)) {
      callback(bestLanguage);
    } else {
      callback('en'); // Default para inglês
    }
  },
  init: () => {},
  cacheUserLanguage: () => {},
};

// Inicializa o i18next
i18n
  .use(languageDetector) // Usa o detector de idioma
  .use(initReactI18next) // Integração com React
  .init({
    resources,
    fallbackLng: 'en', // Idioma padrão se não encontrar tradução
    interpolation: { escapeValue: false }, // Permite variáveis nos textos
    debug: true, // Ativa logs no console (remova em produção)
  });

// Responde a mudanças de idioma do dispositivo
Localization.addEventListener('change', () => {
  const newLanguage = Localization.getLocales()[0]?.languageCode || 'en';
  if (['en', 'pt', 'es'].includes(newLanguage)) {
    i18n.changeLanguage(newLanguage);
  }
});

export default i18n;
