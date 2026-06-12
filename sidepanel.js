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

const summarizeButton = document.getElementById("summarizeButton");
const openOptionsButton = document.getElementById("openOptionsButton");
const loadingState = document.getElementById("loadingState");
const errorBox = document.getElementById("errorBox");
const summaryLanguageOverride = document.getElementById("summaryLanguageOverride");
const summaryOutput = document.getElementById("summaryOutput");
const summaryMeta = document.getElementById("summaryMeta");
const settingsStatus = document.getElementById("settingsStatus");

document.addEventListener("DOMContentLoaded", initializeSidePanel);

async function initializeSidePanel() {
  await window.STP_I18N.init();
  summarizeButton.addEventListener("click", handleSummarizeClick);
  openOptionsButton.addEventListener("click", () => EXTENSION_API.runtime.openOptionsPage());
  EXTENSION_API.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === "local" && hasRelevantSettingsChange(changes)) {
      if (changes.uiLanguage) {
        await window.STP_I18N.setLanguage(changes.uiLanguage.newValue || DEFAULT_SETTINGS.uiLanguage);
        resetSummaryPlaceholder();
      }

      refreshSettingsStatus();
    }
  });

  refreshSettingsStatus();
}

async function refreshSettingsStatus() {
  const settings = await EXTENSION_API.storage.local.get(DEFAULT_SETTINGS);
  const provider = getProviderConfig(settings.llmProvider);
  const hasApiKey = Boolean(String(settings[provider.apiKeySetting] || "").trim());
  const model = settings[provider.modelSetting] || DEFAULT_SETTINGS[provider.modelSetting];

  summarizeButton.disabled = !hasApiKey;
  settingsStatus.textContent = hasApiKey
    ? window.STP_I18N.t("sidepanel.providerModel", { provider: provider.label, model })
    : window.STP_I18N.t("sidepanel.missingProviderKey", { provider: provider.label });

  if (!hasApiKey) {
    showError(window.STP_I18N.t("sidepanel.configureProviderKey", { provider: provider.label }));
  } else if (errorBox.dataset.reason === "missing-key") {
    hideError();
  }
}

async function handleSummarizeClick() {
  setLoading(true);
  hideError();
  summaryMeta.textContent = "";
  summaryOutput.classList.add("empty");
  summaryOutput.textContent = window.STP_I18N.t("sidepanel.extracting");

  try {
    const response = await EXTENSION_API.runtime.sendMessage({
      type: "SUMMARIZE_THIS_PAGE",
      summaryLanguage: summaryLanguageOverride.value
    });

    if (!response?.ok) {
      const providerError = response?.error || {};
      const error = new Error(providerError.message || window.STP_I18N.t("sidepanel.unknownGenerationError"));
      error.code = providerError.code;
      error.details = providerError.details;
      throw error;
    }

    renderSummary(response.result);
  } catch (error) {
    summaryOutput.classList.add("empty");
    summaryOutput.textContent = window.STP_I18N.t("sidepanel.summaryEmpty");
    showError(error.message || window.STP_I18N.t("sidepanel.unknownGenerationError"), error.details);
  } finally {
    setLoading(false);
    refreshSettingsStatus();
  }
}

function renderSummary(result) {
  const summary = result?.summary || "";

  if (!summary.trim()) {
    throw new Error(window.STP_I18N.t("sidepanel.emptyProviderSummary"));
  }

  summaryOutput.classList.remove("empty");
  summaryOutput.textContent = summary.trim();

  const source = result.page?.truncated
    ? window.STP_I18N.t("sidepanel.sourceTruncated")
    : window.STP_I18N.t("sidepanel.sourceComplete");
  summaryMeta.textContent = `${result.provider} · ${result.model} · ${source}`;
}

function setLoading(isLoading) {
  summarizeButton.disabled = isLoading;
  loadingState.classList.toggle("hidden", !isLoading);
}

function showError(message, details = "") {
  errorBox.textContent = details
    ? `${message}\n\n${window.STP_I18N.t("sidepanel.technicalDetails")}:\n${details}`
    : message;
  errorBox.classList.remove("hidden");

  if (/clé api/i.test(message)) {
    errorBox.dataset.reason = "missing-key";
  } else {
    delete errorBox.dataset.reason;
  }
}

function hideError() {
  errorBox.textContent = "";
  errorBox.classList.add("hidden");
  delete errorBox.dataset.reason;
}

function getProviderConfig(provider) {
  return PROVIDERS[provider] || PROVIDERS[DEFAULT_SETTINGS.llmProvider];
}

function hasRelevantSettingsChange(changes) {
  return [
    "uiLanguage",
    "llmProvider",
    "openaiApiKey",
    "openaiModel",
    "geminiApiKey",
    "geminiModel"
  ].some((key) => Boolean(changes[key]));
}

function resetSummaryPlaceholder() {
  if (summaryOutput.classList.contains("empty")) {
    summaryOutput.textContent = window.STP_I18N.t("sidepanel.summaryEmpty");
  }
}
