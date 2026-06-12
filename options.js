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

const form = document.getElementById("optionsForm");
const testProviderButton = document.getElementById("testProviderButton");
const providerTestStatus = document.getElementById("providerTestStatus");
const providerTestIcon = document.getElementById("providerTestIcon");
const providerTestText = document.getElementById("providerTestText");
const statusMessage = document.getElementById("statusMessage");
const fields = {
  uiLanguage: document.getElementById("uiLanguage"),
  llmProvider: document.getElementById("llmProvider"),
  openaiApiKey: document.getElementById("openaiApiKey"),
  openaiModel: document.getElementById("openaiModel"),
  geminiApiKey: document.getElementById("geminiApiKey"),
  geminiModel: document.getElementById("geminiModel"),
  agentStyle: document.getElementById("agentStyle"),
  summaryType: document.getElementById("summaryType"),
  summaryLength: document.getElementById("summaryLength")
};
const providerSections = document.querySelectorAll(".provider-settings");

document.addEventListener("DOMContentLoaded", initializeOptions);

async function initializeOptions() {
  await window.STP_I18N.init();
  await restoreOptions();
  form.addEventListener("submit", saveOptions);
  testProviderButton.addEventListener("click", testProviderConnection);
  fields.uiLanguage.addEventListener("change", async () => {
    await window.STP_I18N.setLanguage(fields.uiLanguage.value);
    resetProviderTestStatus();
    hideStatus();
  });
  fields.llmProvider.addEventListener("change", () => {
    updateProviderSections(fields.llmProvider.value);
    resetProviderTestStatus();
  });

  Object.values(fields).forEach((input) => {
    input.addEventListener("input", resetProviderTestStatus);
    input.addEventListener("change", resetProviderTestStatus);
  });
}

async function restoreOptions() {
  const settings = await EXTENSION_API.storage.local.get(DEFAULT_SETTINGS);

  for (const [key, input] of Object.entries(fields)) {
    input.value = normalizeStoredValue(key, settings[key]);
  }

  await window.STP_I18N.setLanguage(fields.uiLanguage.value);
  updateProviderSections(fields.llmProvider.value);
  resetProviderTestStatus();
}

async function saveOptions(event) {
  event.preventDefault();
  hideStatus();

  await EXTENSION_API.storage.local.set(getCurrentSettings());
  showStatus(window.STP_I18N.t("options.saved"));
}

async function testProviderConnection() {
  hideStatus();
  setProviderTestState("loading", "*", window.STP_I18N.t("options.testInProgress"));
  testProviderButton.disabled = true;

  try {
    const response = await EXTENSION_API.runtime.sendMessage({
      type: "TEST_LLM_PROVIDER",
      settings: getCurrentSettings()
    });

    if (!response?.ok) {
      throw new Error(response?.error?.message || window.STP_I18N.t("options.apiKeyInvalid"));
    }

    setProviderTestState("success", "OK", response.result?.message || window.STP_I18N.t("options.apiKeyValid"));
  } catch (error) {
    setProviderTestState("error", "X", error.message || window.STP_I18N.t("options.apiKeyInvalid"));
  } finally {
    testProviderButton.disabled = false;
  }
}

function getCurrentSettings() {
  return {
    uiLanguage: fields.uiLanguage.value,
    llmProvider: fields.llmProvider.value,
    openaiApiKey: fields.openaiApiKey.value.trim(),
    openaiModel: fields.openaiModel.value.trim() || DEFAULT_SETTINGS.openaiModel,
    geminiApiKey: fields.geminiApiKey.value.trim(),
    geminiModel: fields.geminiModel.value.trim() || DEFAULT_SETTINGS.geminiModel,
    agentStyle: fields.agentStyle.value,
    summaryType: fields.summaryType.value,
    summaryLength: fields.summaryLength.value
  };
}

function showStatus(message) {
  statusMessage.textContent = message;
  statusMessage.classList.remove("hidden");
}

function hideStatus() {
  statusMessage.textContent = "";
  statusMessage.classList.add("hidden");
}

function updateProviderSections(provider) {
  providerSections.forEach((section) => {
    section.classList.toggle("hidden", section.dataset.provider !== provider);
  });
}

function resetProviderTestStatus() {
  if (testProviderButton.disabled) {
    return;
  }

  setProviderTestState("idle", "*", window.STP_I18N.t("options.testNotRun"));
}

function setProviderTestState(state, icon, message) {
  providerTestStatus.classList.remove(
    "test-status-idle",
    "test-status-loading",
    "test-status-success",
    "test-status-error"
  );
  providerTestStatus.classList.add(`test-status-${state}`);
  providerTestIcon.textContent = icon;
  providerTestText.textContent = message;
}

function normalizeStoredValue(key, value) {
  const normalizedValue = LEGACY_VALUES[key]?.[value] || value || DEFAULT_SETTINGS[key];
  const input = fields[key];

  if (!input || input.tagName !== "SELECT") {
    return normalizedValue;
  }

  return Array.from(input.options).some((option) => option.value === normalizedValue)
    ? normalizedValue
    : DEFAULT_SETTINGS[key];
}
