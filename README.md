# SummarizeThisPage

SummarizeThisPage is a Firefox extension that summarizes the current web page in the Firefox sidebar. It connects directly to OpenAI or Google Gemini using your own API key.

## Features

- Summarizes the main content of the active web page
- Supports OpenAI and Google Gemini
- Renders summaries as formatted Markdown
- Offers main ideas, key numbers, TL;DR, and detailed summaries
- Provides short, medium, and detailed output lengths
- Includes neutral, Monday, business analyst, and student writing styles
- Supports English, French, German, and Italian
- Stores API keys and preferences locally in Firefox

## Installation

Firefox 109 or later is required.

The extension can be loaded directly from the project root:

1. Open `about:debugging#/runtime/this-firefox`.
2. Remove any previously loaded SummarizeThisPage extension.
3. Click **Load Temporary Add-on**.
4. Select the root `manifest.json`.

You can also create a clean distribution directory:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\build.ps1
```

Then load `dist/firefox/manifest.json` from Firefox. The build also creates `dist/SummarizeThisPage-firefox.zip` for submission to Mozilla Add-ons. Temporary extensions are removed when Firefox closes.

## Configuration

1. Open the extension settings.
2. Select OpenAI or Gemini.
3. Enter the API key and model name.
4. Optionally test the API key.
5. Choose the language, writing style, summary type, and length.
6. Click **Save**.

The default models are `gpt-4o-mini` for OpenAI and `gemini-3.5-flash` for Gemini. They can be replaced with another model supported by the provider and API account.

## Usage

1. Navigate to a web page.
2. Click the SummarizeThisPage toolbar icon to open the sidebar.
3. Optionally select another output language.
4. Click **Summarize this page**.

The extension extracts the page's readable content and sends it directly to the configured provider. Very long pages are truncated before submission.

## Privacy

- Page content is sent only after an explicit summarization request.
- Requests go directly to the selected LLM provider.
- The selected provider receives the page content and API key required to process the request.
- API keys and preferences use Firefox extension storage.
- No intermediary server or analytics is used.

## Permissions

- `activeTab` and `scripting` extract content from the current page.
- `storage` saves API keys and preferences locally.
- HTTP and HTTPS host access allows page processing and provider requests.

## Project Structure

```text
.
|-- background.js       # Provider requests and extension orchestration
|-- content.js          # Web page content extraction
|-- markdown.js         # Safe Markdown rendering
|-- sidepanel.html/js   # Firefox sidebar interface
|-- options.html/js     # Provider and preference settings
|-- styles.css          # Shared styles
|-- i18n/               # Interface and prompt translations
|-- icons/              # Extension icons
|-- manifest.json       # Firefox extension manifest
`-- build.ps1           # Firefox packaging script
```

## Development

The project uses plain HTML, CSS, and JavaScript with no external runtime dependencies. After a change, reload the temporary extension from `about:debugging` and refresh the tested page.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## Made for fun

By https://github.com/loguilhem
