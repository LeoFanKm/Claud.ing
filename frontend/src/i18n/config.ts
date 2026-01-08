import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import { SUPPORTED_I18N_CODES, uiLanguageToI18nCode } from "./languages";

// Import translation files
import enCommon from "./locales/en/common.json";
import enLanding from "./locales/en/landing.json";
import enOrganization from "./locales/en/organization.json";
import enProjects from "./locales/en/projects.json";
import enSettings from "./locales/en/settings.json";
import enTasks from "./locales/en/tasks.json";
import esCommon from "./locales/es/common.json";
import esLanding from "./locales/es/landing.json";
import esOrganization from "./locales/es/organization.json";
import esProjects from "./locales/es/projects.json";
import esSettings from "./locales/es/settings.json";
import esTasks from "./locales/es/tasks.json";
import jaCommon from "./locales/ja/common.json";
import jaLanding from "./locales/ja/landing.json";
import jaOrganization from "./locales/ja/organization.json";
import jaProjects from "./locales/ja/projects.json";
import jaSettings from "./locales/ja/settings.json";
import jaTasks from "./locales/ja/tasks.json";
import koCommon from "./locales/ko/common.json";
import koLanding from "./locales/ko/landing.json";
import koOrganization from "./locales/ko/organization.json";
import koProjects from "./locales/ko/projects.json";
import koSettings from "./locales/ko/settings.json";
import koTasks from "./locales/ko/tasks.json";
import zhHansCommon from "./locales/zh-Hans/common.json";
import zhHansLanding from "./locales/zh-Hans/landing.json";
import zhHansOrganization from "./locales/zh-Hans/organization.json";
import zhHansProjects from "./locales/zh-Hans/projects.json";
import zhHansSettings from "./locales/zh-Hans/settings.json";
import zhHansTasks from "./locales/zh-Hans/tasks.json";

const resources = {
  en: {
    common: enCommon,
    settings: enSettings,
    projects: enProjects,
    tasks: enTasks,
    organization: enOrganization,
    landing: enLanding,
  },
  ja: {
    common: jaCommon,
    settings: jaSettings,
    projects: jaProjects,
    tasks: jaTasks,
    organization: jaOrganization,
    landing: jaLanding,
  },
  es: {
    common: esCommon,
    settings: esSettings,
    projects: esProjects,
    tasks: esTasks,
    organization: esOrganization,
    landing: esLanding,
  },
  ko: {
    common: koCommon,
    settings: koSettings,
    projects: koProjects,
    tasks: koTasks,
    organization: koOrganization,
    landing: koLanding,
  },
  "zh-Hans": {
    common: zhHansCommon,
    settings: zhHansSettings,
    projects: zhHansProjects,
    tasks: zhHansTasks,
    organization: zhHansOrganization,
    landing: zhHansLanding,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: {
      zh: ["zh-Hans"], // Map generic Chinese to Simplified Chinese
      default: ["en"],
    },
    defaultNS: "common",
    debug: import.meta.env.DEV,
    supportedLngs: [...SUPPORTED_I18N_CODES, "zh"], // Include 'zh' for browser detection
    nonExplicitSupportedLngs: true, // Accept zh -> zh-Hans mapping
    load: "currentOnly", // Load exact language code

    interpolation: {
      escapeValue: false, // React already escapes
    },

    react: {
      useSuspense: false, // Avoid suspense for now to simplify initial setup
    },

    detection: {
      order: ["navigator", "htmlTag"],
      caches: [], // Disable localStorage cache - we'll handle this via config
    },
  });

// Debug logging in development
if (import.meta.env.DEV) {
  console.log("i18n initialized:", i18n.isInitialized);
  console.log("i18n language:", i18n.language);
  console.log("i18n namespaces:", i18n.options.ns);
  console.log("Common bundle loaded:", i18n.hasResourceBundle("en", "common"));
}

// Function to update language from config
export const updateLanguageFromConfig = (configLanguage: string) => {
  if (configLanguage === "BROWSER") {
    // Use browser detection
    const detected = i18n.services.languageDetector?.detect();
    const detectedLang = Array.isArray(detected) ? detected[0] : detected;
    i18n.changeLanguage(detectedLang || "en");
  } else {
    // Use explicit language selection with proper mapping
    const langCode = uiLanguageToI18nCode(configLanguage);
    if (langCode) {
      i18n.changeLanguage(langCode);
    } else {
      console.warn(
        `Unknown UI language: ${configLanguage}, falling back to 'en'`
      );
      i18n.changeLanguage("en");
    }
  }
};

export default i18n;
