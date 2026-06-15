(function initializeMarkdownRenderer(globalScope) {
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderInline(source) {
    const tokens = [];
    const storeToken = (html) => {
      const token = `\u0000${tokens.length}\u0000`;
      tokens.push(html);
      return token;
    };

    let text = String(source || "")
      .replace(/`([^`\n]+)`/g, (_match, code) => storeToken(`<code>${escapeHtml(code)}</code>`))
      .replace(/\[([^\]]+)\]\(([^\s)]+)(?:\s+["']([^"']*)["'])?\)/g, (_match, label, url, title) => {
        if (!/^(https?:|mailto:)/i.test(url)) {
          return label;
        }

        const titleAttribute = title ? ` title="${escapeHtml(title)}"` : "";
        return storeToken(
          `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"${titleAttribute}>${escapeHtml(label)}</a>`
        );
      });

    text = escapeHtml(text)
      .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
      .replace(/__([^_\n]+)__/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
      .replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>")
      .replace(/~~([^~\n]+)~~/g, "<del>$1</del>");

    return text.replace(/\u0000(\d+)\u0000/g, (_match, index) => tokens[Number(index)] || "");
  }

  function render(markdown) {
    const lines = String(markdown || "").replace(/\r\n?/g, "\n").split("\n");
    const output = [];
    let paragraph = [];
    let listType = "";
    let inCodeBlock = false;
    let codeLanguage = "";
    let codeLines = [];

    const flushParagraph = () => {
      if (paragraph.length) {
        output.push(`<p>${paragraph.map(renderInline).join("<br>")}</p>`);
        paragraph = [];
      }
    };
    const closeList = () => {
      if (listType) {
        output.push(`</${listType}>`);
        listType = "";
      }
    };

    for (const line of lines) {
      const fence = line.match(/^```\s*([\w+-]*)\s*$/);
      if (fence) {
        if (inCodeBlock) {
          const languageClass = codeLanguage ? ` class="language-${escapeHtml(codeLanguage)}"` : "";
          output.push(`<pre><code${languageClass}>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
          inCodeBlock = false;
          codeLanguage = "";
          codeLines = [];
        } else {
          flushParagraph();
          closeList();
          inCodeBlock = true;
          codeLanguage = fence[1] || "";
        }
        continue;
      }

      if (inCodeBlock) {
        codeLines.push(line);
        continue;
      }

      if (!line.trim()) {
        flushParagraph();
        closeList();
        continue;
      }

      const heading = line.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        flushParagraph();
        closeList();
        const level = heading[1].length;
        output.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
        continue;
      }

      if (/^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line)) {
        flushParagraph();
        closeList();
        output.push("<hr>");
        continue;
      }

      const quote = line.match(/^>\s?(.*)$/);
      if (quote) {
        flushParagraph();
        closeList();
        output.push(`<blockquote>${renderInline(quote[1])}</blockquote>`);
        continue;
      }

      const unorderedItem = line.match(/^\s*[-+*]\s+(.+)$/);
      const orderedItem = line.match(/^\s*\d+[.)]\s+(.+)$/);
      const item = unorderedItem || orderedItem;
      if (item) {
        flushParagraph();
        const nextListType = unorderedItem ? "ul" : "ol";
        if (listType !== nextListType) {
          closeList();
          listType = nextListType;
          output.push(`<${listType}>`);
        }
        output.push(`<li>${renderInline(item[1])}</li>`);
        continue;
      }

      closeList();
      paragraph.push(line.trim());
    }

    if (inCodeBlock) {
      output.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
    }
    flushParagraph();
    closeList();

    return output.join("\n");
  }

  globalScope.STP_MARKDOWN = { render };
})(globalThis);
