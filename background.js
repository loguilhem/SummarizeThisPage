const EXTENSION_API = globalThis.browser || globalThis.chrome;

const DEFAULT_SETTINGS = {
  uiLanguage: "en",
  llmProvider: "openai",
  openaiApiKey: "",
  openaiModel: "gpt-4o-mini",
  geminiApiKey: "",
  geminiModel: "gemini-3.5-flash",
  agentStyle: "neutral",
  summaryType: "main_ideas",
  summaryLength: "medium"
};

const OPENAI_API_BASE_URL = "https://api.openai.com/v1";
const OPENAI_CHAT_COMPLETIONS_URL = `${OPENAI_API_BASE_URL}/chat/completions`;
const GEMINI_GENERATE_CONTENT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const PROVIDERS = {
  openai: {
    label: "OpenAI",
    apiKeySetting: "openaiApiKey",
    modelSetting: "openaiModel"
  },
  gemini: {
    label: "Gemini",
    apiKeySetting: "geminiApiKey",
    modelSetting: "geminiModel"
  }
};
const SUPPORTED_LANGUAGES = ["en", "fr", "de", "it"];
const DEFAULT_LANGUAGE = "en";
const LEGACY_VALUES = {
  agentStyle: {
    "Neutre": "neutral",
    "Monday": "monday",
    "Analyste business": "business_analyst",
    "Étudiant": "student"
  },
  summaryType: {
    "Idées principales": "main_ideas",
    "Chiffres clés": "key_numbers",
    "TL;DR": "tldr",
    "Résumé détaillé": "detailed"
  },
  summaryLength: {
    "Court": "short",
    "Moyen": "medium",
    "Détaillé": "detailed"
  }
};
const CHOICE_VALUES = {
  agentStyle: ["neutral", "monday", "business_analyst", "student"],
  summaryType: ["main_ideas", "key_numbers", "tldr", "detailed"],
  summaryLength: ["short", "medium", "detailed"]
};
const i18nMessageCache = new Map();

EXTENSION_API.runtime.onInstalled.addListener(() => {
  initializeExtension();
});

EXTENSION_API.runtime.onStartup.addListener(() => {
  restrictStorageAccess();
});

if (EXTENSION_API.sidePanel?.setPanelBehavior) {
  EXTENSION_API.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error("Unable to configure side panel behavior", error));
} else if (EXTENSION_API.sidebarAction?.open && EXTENSION_API.action?.onClicked) {
  EXTENSION_API.action.onClicked.addListener(() => {
    EXTENSION_API.sidebarAction
      .open()
      .catch((error) => console.error("Unable to open Firefox sidebar", error));
  });
}

EXTENSION_API.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "SUMMARIZE_THIS_PAGE") {
    summarizeActiveTab(message.summaryLanguage)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: toSerializableError(error) }));

    return true;
  }

  if (message?.type === "TEST_LLM_PROVIDER") {
    testProviderConnection(message.settings)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: toSerializableError(error) }));

    return true;
  }

  return false;
});

async function initializeExtension() {
  await Promise.all([ensureDefaultSettings(), restrictStorageAccess()]);
}

async function ensureDefaultSettings() {
  const current = await EXTENSION_API.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  const missingDefaults = {};

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (typeof current[key] === "undefined") {
      missingDefaults[key] = value;
    }
  }

  if (Object.keys(missingDefaults).length > 0) {
    await EXTENSION_API.storage.local.set(missingDefaults);
  }
}

async function restrictStorageAccess() {
  if (!EXTENSION_API.storage?.local?.setAccessLevel) {
    return;
  }

  try {
    await EXTENSION_API.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  } catch (error) {
    console.warn("Unable to restrict storage access level", error);
  }
}

async function summarizeActiveTab(summaryLanguageOverride = "default") {
  const settings = await getSettings();
  settings.summaryLanguage = resolveSummaryLanguage(summaryLanguageOverride, settings.uiLanguage);
  const provider = getProviderConfig(settings.llmProvider);
  const providerApiKey = settings[provider.apiKeySetting] || "";
  const providerModel = settings[provider.modelSetting] || "";

  if (!providerApiKey.trim()) {
    throw new UserVisibleError(
      `Clé API ${provider.label} manquante. Ouvrez les paramètres et ajoutez votre clé API avant de résumer une page.`,
      "missing_api_key"
    );
  }

  const [tab] = await EXTENSION_API.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    throw new UserVisibleError("Aucun onglet actif n'a été trouvé.", "missing_active_tab");
  }

  if (tab.url && isUnsupportedTabUrl(tab.url)) {
    throw new UserVisibleError(
      "Cette page ne peut pas être lue par l'extension. Essayez depuis une page web http:// ou https://.",
      "unsupported_page"
    );
  }

  const page = await extractPageContent(tab.id);
  validateExtractedPage(page);

  const summary = await requestProviderSummary(settings, page);

  return {
    summary,
    page: {
      title: page.title,
      url: page.url,
      truncated: page.truncated,
      characterCount: page.characterCount
    },
    provider: provider.label,
    model: providerModel,
    summaryLanguage: settings.summaryLanguage
  };
}

async function getSettings() {
  const settings = await EXTENSION_API.storage.local.get(DEFAULT_SETTINGS);

  return normalizeSettings(settings);
}

function normalizeSettings(settings) {
  return {
    uiLanguage: normalizeLanguage(settings.uiLanguage),
    llmProvider: normalizeProvider(settings.llmProvider),
    openaiApiKey: String(settings.openaiApiKey || ""),
    openaiModel: String(settings.openaiModel || DEFAULT_SETTINGS.openaiModel).trim(),
    geminiApiKey: String(settings.geminiApiKey || ""),
    geminiModel: String(settings.geminiModel || DEFAULT_SETTINGS.geminiModel).trim(),
    agentStyle: normalizeChoice("agentStyle", settings.agentStyle),
    summaryType: normalizeChoice("summaryType", settings.summaryType),
    summaryLength: normalizeChoice("summaryLength", settings.summaryLength)
  };
}

function normalizeProvider(provider) {
  return PROVIDERS[provider] ? provider : DEFAULT_SETTINGS.llmProvider;
}

function getProviderConfig(provider) {
  return PROVIDERS[normalizeProvider(provider)];
}

function normalizeLanguage(language) {
  return SUPPORTED_LANGUAGES.includes(language) ? language : DEFAULT_LANGUAGE;
}

function resolveSummaryLanguage(summaryLanguageOverride, uiLanguage) {
  if (summaryLanguageOverride && summaryLanguageOverride !== "default") {
    return normalizeLanguage(summaryLanguageOverride);
  }

  return normalizeLanguage(uiLanguage);
}

function normalizeChoice(key, value) {
  const normalizedValue = LEGACY_VALUES[key]?.[value] || value || DEFAULT_SETTINGS[key];

  return CHOICE_VALUES[key]?.includes(normalizedValue) ? normalizedValue : DEFAULT_SETTINGS[key];
}

function isUnsupportedTabUrl(url) {
  return /^(chrome|chrome-extension|moz-extension|edge|about|devtools|file):/i.test(url);
}

async function extractPageContent(tabId) {
  try {
    return await EXTENSION_API.tabs.sendMessage(tabId, { type: "SUMMARIZE_THIS_PAGE_EXTRACT" });
  } catch (firstError) {
    try {
      await EXTENSION_API.scripting.executeScript({
        target: { tabId },
        files: ["content.js"]
      });

      return await EXTENSION_API.tabs.sendMessage(tabId, { type: "SUMMARIZE_THIS_PAGE_EXTRACT" });
    } catch (secondError) {
      throw new UserVisibleError(
        "Impossible d'extraire le contenu de cette page. Rechargez l'onglet ou essayez une autre page web.",
        "content_extraction_failed",
        secondError
      );
    }
  }
}

function validateExtractedPage(page) {
  if (!page || typeof page !== "object") {
    throw new UserVisibleError("La page n'a pas renvoyé de contenu exploitable.", "invalid_page_payload");
  }

  if (page.error) {
    throw new UserVisibleError(page.error, "page_extraction_error");
  }

  if (!page.text || page.text.trim().length < 120) {
    throw new UserVisibleError(
      "Aucun contenu exploitable n'a été trouvé sur cette page.",
      "empty_page_content"
    );
  }
}

async function testProviderConnection(rawSettings = {}) {
  const settings = normalizeSettings({ ...DEFAULT_SETTINGS, ...rawSettings });
  const provider = getProviderConfig(settings.llmProvider);
  const apiKey = settings[provider.apiKeySetting] || "";
  const model = settings[provider.modelSetting] || DEFAULT_SETTINGS[provider.modelSetting];

  if (!apiKey.trim()) {
    throw new UserVisibleError(
      `Clé API ${provider.label} manquante. Renseignez une clé avant de lancer le test.`,
      "missing_api_key"
    );
  }

  if (settings.llmProvider === "gemini") {
    await testGeminiConnection(apiKey, model);
  } else {
    await testOpenAIConnection(apiKey, model);
  }

  return {
    provider: provider.label,
    model
  };
}

async function testOpenAIConnection(apiKey, model) {
  let response;

  try {
    response = await fetch(`${OPENAI_API_BASE_URL}/models/${encodeURIComponent(model)}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey.trim()}`
      }
    });
  } catch (error) {
    throw new UserVisibleError(
      "Erreur réseau pendant le test OpenAI. Vérifiez votre connexion puis réessayez.",
      "network_error",
      error
    );
  }

  const payload = await parseProviderResponse(response, "OpenAI");

  if (!response.ok) {
    throwProviderHttpError("OpenAI", response.status, payload);
  }
}

async function testGeminiConnection(apiKey, model) {
  const normalizedModel = normalizeGeminiModel(model);
  let response;

  try {
    response = await fetch(`${GEMINI_GENERATE_CONTENT_BASE_URL}/${encodeURIComponent(normalizedModel)}`, {
      method: "GET",
      headers: {
        "x-goog-api-key": apiKey.trim()
      }
    });
  } catch (error) {
    throw new UserVisibleError(
      "Erreur réseau pendant le test Gemini. Vérifiez votre connexion puis réessayez.",
      "network_error",
      error
    );
  }

  const payload = await parseProviderResponse(response, "Gemini");

  if (!response.ok) {
    throwProviderHttpError("Gemini", response.status, payload);
  }
}

async function requestOpenAISummary(settings, page) {
  const prompt = await buildPrompt(settings, page);
  let response;

  try {
    response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${settings.openaiApiKey.trim()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: settings.openaiModel || DEFAULT_SETTINGS.openaiModel,
        messages: [
          {
            role: "system",
            content: prompt.systemInstruction
          },
          {
            role: "user",
            content: prompt.userPrompt
          }
        ],
        temperature: 0.2
      })
    });
  } catch (error) {
    throw new UserVisibleError(
      "Erreur réseau pendant l'appel à OpenAI. Vérifiez votre connexion puis réessayez.",
      "network_error",
      error
    );
  }

  const payload = await parseOpenAIResponse(response);

  if (!response.ok) {
    throwOpenAIHttpError(response.status, payload);
  }

  const summary = payload?.choices?.[0]?.message?.content;

  if (!summary || typeof summary !== "string") {
    throw new UserVisibleError(
      "Réponse OpenAI invalide : aucun résumé n'a été renvoyé.",
      "invalid_openai_response"
    );
  }

  return summary.trim();
}

async function requestProviderSummary(settings, page) {
  if (settings.llmProvider === "gemini") {
    return requestGeminiSummary(settings, page);
  }

  return requestOpenAISummary(settings, page);
}

async function requestGeminiSummary(settings, page) {
  const prompt = await buildPrompt(settings, page);
  const model = normalizeGeminiModel(settings.geminiModel || DEFAULT_SETTINGS.geminiModel);
  const endpoint = `${GEMINI_GENERATE_CONTENT_BASE_URL}/${encodeURIComponent(model)}:generateContent`;
  let response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": settings.geminiApiKey.trim()
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [
            {
              text: prompt.systemInstruction
            }
          ]
        },
        contents: [
          {
            parts: [
              {
                text: prompt.userPrompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2
        }
      })
    });
  } catch (error) {
    throw new UserVisibleError(
      "Erreur réseau pendant l'appel à Gemini. Vérifiez votre connexion puis réessayez.",
      "network_error",
      error
    );
  }

  const payload = await parseProviderResponse(response, "Gemini");

  if (!response.ok) {
    throwProviderHttpError("Gemini", response.status, payload);
  }

  const summary = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  if (!summary) {
    throw new UserVisibleError(
      getGeminiEmptyResponseMessage(payload),
      "invalid_gemini_response",
      undefined,
      buildProviderErrorDetails("Gemini", 200, payload)
    );
  }

  return summary;
}

function normalizeGeminiModel(model) {
  return String(model || DEFAULT_SETTINGS.geminiModel)
    .trim()
    .replace(/^models\//, "");
}

async function buildPrompt(settings, page) {
  const messages = await loadI18nMessages(settings.summaryLanguage);
  const template = getMessageValue(messages, "prompt.template");
  const systemInstruction = getMessageValue(messages, "prompt.systemInstruction");

  return {
    systemInstruction,
    userPrompt: formatTemplate(template, {
      agent: getMessageValue(messages, `prompt.agents.${settings.agentStyle}`),
      languageName: getMessageValue(messages, "prompt.languageName"),
      summaryType: getMessageValue(messages, `summaryTypes.${settings.summaryType}`),
      summaryLength: getMessageValue(messages, `summaryLengths.${settings.summaryLength}`),
      url: page.url,
      title: page.title,
      pageText: page.text
    })
  };
}

async function loadI18nMessages(language) {
  const normalizedLanguage = normalizeLanguage(language);

  if (i18nMessageCache.has(normalizedLanguage)) {
    return i18nMessageCache.get(normalizedLanguage);
  }

  const response = await fetch(EXTENSION_API.runtime.getURL(`i18n/${normalizedLanguage}.json`));
  const messages = await response.json();
  i18nMessageCache.set(normalizedLanguage, messages);

  return messages;
}

function getMessageValue(messages, key) {
  const value = key.split(".").reduce((currentValue, part) => {
    return currentValue && Object.prototype.hasOwnProperty.call(currentValue, part)
      ? currentValue[part]
      : undefined;
  }, messages);

  if (typeof value !== "undefined") {
    return value;
  }

  return key;
}

function formatTemplate(template, replacements) {
  return String(template).replace(/\{(\w+)\}/g, (match, name) => {
    return Object.prototype.hasOwnProperty.call(replacements, name) ? replacements[name] : match;
  });
}

async function parseOpenAIResponse(response) {
  return parseProviderResponse(response, "OpenAI");
}

async function parseProviderResponse(response, providerLabel) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    if (response.ok) {
      throw new UserVisibleError(
        `Réponse ${providerLabel} illisible : le JSON retourné est invalide.`,
        "invalid_json_response",
        error
      );
    }

    return { error: { message: text } };
  }
}

function throwOpenAIHttpError(status, payload) {
  throwProviderHttpError("OpenAI", status, payload);
}

function throwProviderHttpError(providerLabel, status, payload) {
  const apiMessage = getProviderApiMessage(payload);
  const providerCode = providerLabel.toLowerCase();
  const details = buildProviderErrorDetails(providerLabel, status, payload);

  if (status === 401) {
    throw new UserVisibleError(
      apiMessage || `${providerLabel} a refusé la requête : vérifiez votre clé API.`,
      `${providerCode}_unauthorized`,
      undefined,
      details
    );
  }

  if (status === 403) {
    throw new UserVisibleError(
      apiMessage || `${providerLabel} a refusé l'accès à ce modèle ou à cette clé API.`,
      `${providerCode}_forbidden`,
      undefined,
      details
    );
  }

  if (status === 429) {
    throw new UserVisibleError(
      apiMessage || `${providerLabel} indique une limite de quota ou de débit atteinte.`,
      `${providerCode}_rate_limited`,
      undefined,
      details
    );
  }

  if (status >= 500) {
    throw new UserVisibleError(
      apiMessage || `${providerLabel} rencontre une erreur serveur. Réessayez dans quelques instants.`,
      `${providerCode}_server_error`,
      undefined,
      details
    );
  }

  throw new UserVisibleError(
    apiMessage || `${providerLabel} a renvoyé une erreur HTTP ${status}.`,
    `${providerCode}_http_error`,
    undefined,
    details
  );
}

function toSerializableError(error) {
  return {
    message: error?.message || "Erreur inconnue.",
    code: error?.code || "unknown_error",
    details: error?.details || getCauseMessage(error?.cause)
  };
}

class UserVisibleError extends Error {
  constructor(message, code, cause, details) {
    super(message);
    this.name = "UserVisibleError";
    this.code = code;
    this.cause = cause;
    this.details = details;
  }
}

function getProviderApiMessage(payload) {
  return payload?.error?.message || payload?.error?.status || payload?.message || "";
}

function buildProviderErrorDetails(providerLabel, status, payload) {
  const lines = [`Provider: ${providerLabel}`, `HTTP status: ${status}`];
  const apiStatus = payload?.error?.status;
  const apiCode = payload?.error?.code;

  if (apiStatus) {
    lines.push(`API status: ${apiStatus}`);
  }

  if (apiCode) {
    lines.push(`API code: ${apiCode}`);
  }

  if (payload) {
    lines.push("");
    lines.push("Payload:");
    lines.push(limitErrorDetails(JSON.stringify(payload, null, 2)));
  }

  return lines.join("\n");
}

function getGeminiEmptyResponseMessage(payload) {
  const blockReason = payload?.promptFeedback?.blockReason;
  const finishReason = payload?.candidates?.[0]?.finishReason;

  if (blockReason) {
    return `Gemini a bloqué la requête : ${blockReason}.`;
  }

  if (finishReason) {
    return `Gemini n'a pas renvoyé de texte. Raison : ${finishReason}.`;
  }

  return "Réponse Gemini invalide : aucun résumé n'a été renvoyé.";
}

function getCauseMessage(cause) {
  return cause?.message ? `Cause: ${cause.message}` : "";
}

function limitErrorDetails(details) {
  const maxLength = 2500;

  if (!details || details.length <= maxLength) {
    return details || "";
  }

  return `${details.slice(0, maxLength)}\n...`;
}
