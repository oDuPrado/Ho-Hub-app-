import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Importando os arquivos de tradução
import en from './lib/locales/en.json';
import pt from './lib/locales/pt.json';
import es from './lib/locales/es.json';

// Recursos de idiomas
const resources = {
  en: { translation: en },
  pt: { translation: pt },
  es: { translation: es },
};

// Inicializa o i18n
i18n
  .use(initReactI18next) // Integração com React
  .init({
    resources,
    lng: 'pt', // Idioma padrão inicial
    fallbackLng: 'en', // Idioma padrão se não encontrar tradução
    interpolation: { escapeValue: false }, // Permite variáveis nos textos
    debug: true, // Ativa logs no console (remova em produção)
  });

export default i18n;
