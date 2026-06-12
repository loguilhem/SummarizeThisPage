(() => {
  const EXTENSION_API = globalThis.browser || globalThis.chrome;

  const DEFAULT_LANGUAGE = "en";
  const SUPPORTED_LANGUAGES = ["en", "fr", "de", "it"];
  const messageCache = new Map();

  let currentLanguage = DEFAULT_LANGUAGE;
  let currentMessages = {};
  let fallbackMessages = {};

  async function init() {
    const settings = await EXTENSION_API.storage.local.get({ uiLanguage: DEFAULT_LANGUAGE });
    await setLanguage(settings.uiLanguage || DEFAULT_LANGUAGE);
  }

  async function setLanguage(language) {
    currentLanguage = normalizeLanguage(language);
    fallbackMessages = await loadMessages(DEFAULT_LANGUAGE);
    currentMessages = currentLanguage === DEFAULT_LANGUAGE
      ? fallbackMessages
      : await loadMessages(currentLanguage);

    document.documentElement.lang = currentLanguage;
    translateDocument(document);
  }

  async function loadMessages(language) {
    const normalizedLanguage = normalizeLanguage(language);

    if (messageCache.has(normalizedLanguage)) {
      return messageCache.get(normalizedLanguage);
    }

    const response = await fetch(EXTENSION_API.runtime.getURL(`i18n/${normalizedLanguage}.json`));
    const messages = await response.json();
    messageCache.set(normalizedLanguage, messages);

    return messages;
  }

  function translateDocument(root = document) {
    root.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = t(element.dataset.i18n);
    });

    root.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
      element.placeholder = t(element.dataset.i18nPlaceholder);
    });

    root.querySelectorAll("[data-i18n-title]").forEach((element) => {
      element.title = t(element.dataset.i18nTitle);
    });

    root.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
      element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
    });
  }

  function t(key, replacements = {}) {
    const template = getValue(currentMessages, key) ?? getValue(fallbackMessages, key) ?? key;

    return String(template).replace(/\{(\w+)\}/g, (match, name) => {
      return Object.prototype.hasOwnProperty.call(replacements, name) ? replacements[name] : match;
    });
  }

  function getValue(messages, key) {
    return key.split(".").reduce((value, part) => {
      return value && Object.prototype.hasOwnProperty.call(value, part) ? value[part] : undefined;
    }, messages);
  }

  function normalizeLanguage(language) {
    return SUPPORTED_LANGUAGES.includes(language) ? language : DEFAULT_LANGUAGE;
  }

  window.STP_I18N = {
    init,
    setLanguage,
    translateDocument,
    t,
    normalizeLanguage,
    supportedLanguages: SUPPORTED_LANGUAGES,
    defaultLanguage: DEFAULT_LANGUAGE,
    get language() {
      return currentLanguage;
    }
  };
})();
