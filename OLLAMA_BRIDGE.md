# Ollama Bridge Extension Documentation

## Overview

The Ollama Bridge Extension is a browser extension that creates a secure bridge between web applications (HTTPS) and a local Ollama API instance (HTTP). It solves the "mixed content" security restriction problem in modern browsers.

## The Problem

Modern browsers block "mixed content" - when an HTTPS website tries to access HTTP resources like a local Ollama API server (typically on http://localhost:11434). This security feature prevents HTTPS websites from accessing potentially insecure HTTP content, but it also prevents legitimate use cases like connecting to local AI models.

## Our Solution

The Ollama Bridge Extension:

- Intercepts specific API calls from our portfolio website to Ollama
- Forwards these requests to the local Ollama API (http://localhost:11434)
- Returns the responses back to the website
- Handles all CORS and mixed content security issues

## How It Works

1. **Content Script**: Injected into our portfolio website to intercept any fetch requests to Ollama
2. **Background Script**: Receives the intercepted requests and forwards them to the local Ollama API
3. **Popup UI**: Provides user settings for enabling/disabling and configuring the connection

## Using the Extension

### For Visitors

1. Install the extension from the Chrome/Firefox store
2. Make sure Ollama is running locally (`ollama serve`)
3. Visit our portfolio site
4. The site will automatically detect the extension and use it for Ollama connections

### For Developers

If you're building a web application that needs to connect to Ollama, you can integrate with our extension:

```javascript
// Check if the extension is available
if (window.OllamaBridge && window.OllamaBridge.isAvailable) {
  console.log("Ollama Bridge extension detected!");
  
  // Make requests directly to localhost - they'll be intercepted by the extension
  fetch('http://localhost:11434/api/tags')
    .then(response => response.json())
    .then(data => console.log("Available models:", data));
} else {
  console.log("Extension not detected - fallback to alternative methods");
  // Implement alternative approaches when the extension isn't available
}
```

Our portfolio site automatically detects the presence of the extension and adapts its behavior accordingly.

## Extension Architecture

### manifest.json

The core configuration file defines permissions, content scripts, and background scripts.

### content.js

Injects into web pages and intercepts fetch requests to Ollama:

```javascript
// Simplified example
window.fetch = new Proxy(window.fetch, {
  apply: async function(target, thisArg, args) {
    const url = args[0]?.toString();
    if (url.includes('localhost:11434') || url.includes('127.0.0.1:11434')) {
      // Request is for Ollama, use our bridge
      return window.OllamaBridge.sendRequest(url, args[1]);
    }
    // Not an Ollama request, use normal fetch
    return Reflect.apply(target, thisArg, args);
  }
});
```

### background.js

Handles communication with the Ollama API:

```javascript
// Simplified example
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'ollama_request') {
    fetch(request.url, request.options)
      .then(response => response.json())
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Required for async response
  }
});
```

## Security Considerations

- The extension only forwards requests to localhost, not to external servers
- Users must explicitly install and enable the extension
- The extension does not modify response data
- All communication is limited to the localhost Ollama API

## Similar Approaches

This approach is similar to other projects like Lumos, which also faced the same security challenges when connecting to local LLMs from browser extensions.

## Contributing

We welcome contributions to the Ollama Bridge Extension! Check out our GitHub repository for issues and pull requests. 