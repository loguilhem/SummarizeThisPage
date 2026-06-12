(() => {
  const EXTENSION_API = globalThis.browser || globalThis.chrome;

  if (window.__summarizeThisPageContentScriptLoaded) {
    return;
  }

  window.__summarizeThisPageContentScriptLoaded = true;

  const MAX_CONTENT_LENGTH = 15000;
  const MIN_CONTENT_LENGTH = 120;

  EXTENSION_API.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== "SUMMARIZE_THIS_PAGE_EXTRACT") {
      return false;
    }

    try {
      sendResponse(extractPage());
    } catch (error) {
      sendResponse({
        error: "Erreur pendant l'extraction du contenu de la page."
      });
    }

    return true;
  });

  function extractPage() {
    const title = normalizeWhitespace(document.title || "");
    const url = location.href;
    const text = getMainText();

    if (!text || text.length < MIN_CONTENT_LENGTH) {
      return {
        title,
        url,
        text: "",
        characterCount: 0,
        truncated: false,
        error: "Aucun contenu exploitable n'a été trouvé sur cette page."
      };
    }

    const truncated = text.length > MAX_CONTENT_LENGTH;
    const limitedText = truncated ? truncateText(text, MAX_CONTENT_LENGTH) : text;

    return {
      title,
      url,
      text: limitedText,
      characterCount: text.length,
      truncated
    };
  }

  function getMainText() {
    const candidates = collectContentCandidates();
    let bestText = "";

    for (const candidate of candidates) {
      const text = getCleanText(candidate);

      if (text.length > bestText.length) {
        bestText = text;
      }
    }

    if (bestText.length >= MIN_CONTENT_LENGTH) {
      return bestText;
    }

    return getCleanText(document.body || document.documentElement);
  }

  function collectContentCandidates() {
    const selectors = [
      "article",
      "main",
      "[role='main']",
      ".article",
      ".article-content",
      ".content",
      ".entry-content",
      ".post",
      ".post-content",
      ".story",
      ".story-body"
    ];

    const candidates = [];

    for (const selector of selectors) {
      candidates.push(...document.querySelectorAll(selector));
    }

    if (document.body) {
      candidates.push(document.body);
    }

    return candidates;
  }

  function getCleanText(element) {
    if (!element) {
      return "";
    }

    const clone = element.cloneNode(true);
    removeNoisyElements(clone);

    return normalizeWhitespace(clone.textContent || "");
  }

  function removeNoisyElements(root) {
    const selectors = [
      "script",
      "style",
      "noscript",
      "template",
      "svg",
      "canvas",
      "iframe",
      "object",
      "embed",
      "nav",
      "footer",
      "aside",
      "form",
      "button",
      "input",
      "select",
      "textarea",
      "[hidden]",
      "[aria-hidden='true']",
      "[role='navigation']",
      "[role='banner']",
      "[role='contentinfo']",
      "[role='complementary']",
      ".ad",
      ".ads",
      ".advertisement",
      ".banner",
      ".cookie",
      ".cookie-banner",
      ".modal",
      ".newsletter",
      ".popup",
      ".related",
      ".share",
      ".sidebar",
      ".social"
    ];

    root.querySelectorAll(selectors.join(",")).forEach((node) => node.remove());
  }

  function normalizeWhitespace(value) {
    return value
      .replace(/\u00a0/g, " ")
      .replace(/[ \t\r\f\v]+/g, " ")
      .replace(/\n\s*\n\s*\n+/g, "\n\n")
      .replace(/\s+\n/g, "\n")
      .replace(/\n\s+/g, "\n")
      .trim();
  }

  function truncateText(text, maxLength) {
    const truncated = text.slice(0, maxLength);
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf("."),
      truncated.lastIndexOf("!"),
      truncated.lastIndexOf("?"),
      truncated.lastIndexOf("\n")
    );

    if (lastSentenceEnd > maxLength * 0.8) {
      return truncated.slice(0, lastSentenceEnd + 1).trim();
    }

    return truncated.trim();
  }
})();
