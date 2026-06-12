# SummarizeThisPage

SummarizeThisPage is a Chrome extension that generates a summary of the current web page in a convenient side panel. It connects directly to your chosen LLM provider using your own API key.

## Features

- Summarizes the main content of the active web page
- Supports OpenAI and Google Gemini
- Displays summaries in Chrome's side panel
- Offers multiple summary types: main ideas, key numbers, TL;DR, and detailed summary
- Provides short, medium, and detailed output lengths
- Includes neutral, Monday, business analyst, and student writing styles
- Supports English, French, German, and Italian for the interface and summaries
- Lets you test your API key from the settings page
- Stores settings locally in Chrome

## Installation

This extension can be loaded locally in any Chromium-based browser that supports Manifest V3 and the Side Panel API. Chrome 114 or later is required.

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the project directory.

## Configuration

1. Open the extension's settings page.
2. Select OpenAI or Gemini as the active provider.
3. Enter your API key and the model name you want to use.
4. Optionally test the API key.
5. Choose your preferred language, summary style, type, and length.
6. Click **Save**.

The default model names are `gpt-4o-mini` for OpenAI and `gemini-3.5-flash` for Gemini. You can replace them with another model supported by your provider and API account.

## Usage

1. Navigate to the web page you want to summarize.
2. Click the SummarizeThisPage extension icon to open the side panel.
3. Optionally choose a different output language.
4. Click **Summarize this page**.

The extension extracts the page's main readable content and sends it directly to the configured LLM provider. Very long pages are truncated before being submitted.

## Privacy

- Page content is sent only when you explicitly request a summary.
- Requests are made directly from the extension to the selected LLM provider.
- API keys and preferences are stored locally using Chrome's storage API.
- The extension does not use an intermediary server.
- The extension does not collect analytics.

Your use of OpenAI or Gemini remains subject to the selected provider's terms and privacy policy.

## Permissions

The extension requests the following Chrome permissions:

- `activeTab` and `scripting` to access and extract content from the current page
- `sidePanel` to display the extension interface
- `storage` to save API keys and preferences locally
- HTTP and HTTPS host access to process web pages and contact the configured provider

## Project Structure

```text
.
|-- background.js       # Provider requests and extension orchestration
|-- content.js          # Web page content extraction
|-- sidepanel.html/js   # Summary interface
|-- options.html/js     # Provider and preference settings
|-- styles.css          # Shared styles
|-- i18n/               # Interface and prompt translations
|-- icons/              # Extension icons
`-- manifest.json       # Chrome extension manifest
```

## Development

The project uses plain HTML, CSS, and JavaScript, with no build step or external runtime dependencies. After changing a file, reload the extension from `chrome://extensions` and refresh the page being tested.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## Made for fun
By https://github.com/loguilhem