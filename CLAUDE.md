# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CORS Playground** is a bilingual interactive tool for learning Same-Origin Policy (SOP), Cross-Origin Resource Sharing (CORS), and preflight requests through theory, simulation, iframe experiments, and controlled live requests.

**Demo:** https://ipusiron.github.io/cors-playground/

## Development

### Running Locally

This is a static site with no build step required. Simply open `index.html` in a browser:

```bash
start index.html
```

Or serve via a local HTTP server:

```bash
# Python 3
python -m http.server 8000

# Then visit http://localhost:8000
```

### Testing Changes

Run the dependency-free test suite first:

```bash
npm test
```

After modifying files, refresh the browser. Use browser DevTools (F12) to:
- **Console tab**: Check for JavaScript errors and see logs from fetch experiments
- **Network tab**: Observe actual preflight (OPTIONS) requests and CORS headers in responses

## Architecture

### Four-Tab Structure

The application is organized into four tabs, providing a progressive learning path from fundamentals to hands-on experimentation:

1. **Basics** (📚 基礎知識) - Static HTML content in `index.html`
   - Visual explanation of DOM structure with tree visualization
   - Origin breakdown (scheme + host + port) with color-coded diagrams
   - iframe parent-child relationship visualization
   - Attack vs. protection scenarios showing why SOP is necessary
   - No JavaScript required - pure HTML/CSS educational content

2. **SOP Lab** (`js/sop-lab.js`)
   - Uses `<iframe>` elements to demonstrate Same-Origin Policy restrictions
   - Compares same-origin iframe vs. sandboxed iframe (treated as cross-origin)
   - Demonstrates `postMessage` API for safe cross-origin communication
   - Shows that sandboxed iframes without `allow-same-origin` get `origin: null`

3. **CORS Decision Simulator** (`js/cors-simulator.js`)
   - Uses the DOM-independent decision core in `js/cors-core.js`
   - **Key constants:**
     - `SAFE_METHODS`: GET, HEAD, POST
     - Safelisted headers: accept, accept-language, content-language, content-type, range
     - `SAFE_CONTENT_TYPES`: text/plain, application/x-www-form-urlencoded, multipart/form-data
   - **Decision flow:**
     1. `unsafeRequestHeaderNames()`: Checks complete names, values, and size limits
     2. `needsPreflight()`: Determines if OPTIONS is needed
     3. `finalDecision()`: Validates server response headers against request requirements
   - **Validation rules implemented:**
     - `withCredentials=true` requires exact origin match (no wildcard `*`)
     - `withCredentials=true` requires `Access-Control-Allow-Credentials: true`
     - Non-safe methods must be in `Access-Control-Allow-Methods`
     - Non-safe headers must be in `Access-Control-Allow-Headers`
   - Renders visual flow diagram showing decision steps

4. **Live Fetch Lab** (`js/live-fetch.js`)
   - Actually executes `fetch()` API calls against real endpoints
   - Logs request/response details and estimated preflight behavior
   - Presets include:
     - GitHub raw content (CORS-enabled, succeeds)
     - example.com (no CORS headers, fails)
     - httpbin.org (customizable response headers for experimentation)
   - Restricts destinations to the three CSP-approved external origins and same origin
   - Distinguishes CSP blocks from indeterminate Fetch API failures
   - **Note:** Preflight detection is estimated client-side; actual OPTIONS requests should be verified in DevTools Network tab

### Common UI (`js/app.js`)

- Tab switching logic for all four tabs
- Theme toggle (light/dark mode) with localStorage persistence (key: `'corspg-theme'`)
- Accordion toggle for collapsible content sections
- Help panel toggle for contextual explanations

### CORS Validation Logic

When adding features or fixing bugs related to CORS decision-making:

- **Simple Request criteria** must all be met (method AND content-type AND headers)
- **Preflight is triggered** if ANY simple request criterion is violated
- **Credentials mode** has special restrictions:
  - Cannot use `Access-Control-Allow-Origin: *`
  - Must explicitly return the requesting origin
  - Must include `Access-Control-Allow-Credentials: true`

### iframe Security Demonstration

The SOP Lab uses two iframes to contrast security models:

- `labs/iframe-safe.html`: Normal iframe (same origin as parent)
  - Parent can access `contentDocument` and DOM
  - `postMessage` works with actual origin

- `labs/iframe-sandboxed.html`: Sandboxed iframe without `allow-same-origin`
  - Parent cannot access `contentDocument` (throws SecurityError)
  - Treated as `origin: null` by browser
  - `postMessage` still works but with `origin: null`

### Educational Focus

This tool is designed for **defensive security education**. When making changes:

- Prioritize **accuracy** of CORS/SOP behavior simulation over simplification
- Include **explanatory notes** in UI for why requests succeed/fail
- Use **visual feedback** (color coding: green=allowed, red=blocked, yellow=warning)
- Maintain **bilingual support** (Japanese UI with English technical terms in code)

### Educational Features (Added for Beginners)

Each tab now includes comprehensive learning aids:

1. **Learning Objectives** (`.learning-objectives`)
   - Appears at the top of each tab
   - Lists 3-4 key concepts students will learn
   - Uses emoji icons for visual appeal

2. **Help Toggle Buttons** (`.help-toggle`)
   - Collapsible help panels for each major section
   - Provides context: "What is SOP?", "What is CORS?", "How to use this experiment?"
   - Animated slide-down effect when toggled

3. **Step-by-Step Guides** (`.step-guide`)
   - Numbered instructions for conducting experiments
   - Tells users exactly what buttons to press and what to expect
   - Helps prevent confusion about "what to do next"

4. **Glossary Tooltips** (`.term` + `.tooltip`)
   - Technical terms are marked with dotted underlines
   - Hover to see definitions in a tooltip
   - Examples: "オリジン", "sandbox", "Simple Request", "Preflight Request"

5. **Result Explanations** (`.result-explanation`)
   - Dynamically generated after experiments
   - Explains WHY something succeeded or failed
   - Includes relevant technical details (error messages, header values)
   - Color-coded: green for success, red for errors

6. **Key Concept Boxes** (`.key-concept`)
   - Highlights critical concepts that beginners often misunderstand
   - Example: "CORS errors mean the request WAS sent, but the browser blocked the response"

### User Journey Design

The four tabs form a progressive learning path where each step builds on the previous:

1. **📚 Basics** → 2. **🧪 SOP Lab** → 3. **⚙️ CORS Simulator** → 4. **🚀 Live Fetch**

Each tab includes learning objectives at the top and provides immediate visual feedback.

## File Organization

```
cors-playground/
├── index.html              # Main page with four tab sections (Basics tab is inline HTML)
├── css/style.css           # All styling including light/dark themes
├── js/
│   ├── cors-core.js       # Dependency-free CORS decision core
│   ├── messages.js        # Japanese and English dynamic messages
│   ├── language-init.js   # Initial language selection
│   ├── app.js             # Tab switching, theme toggle, accordion control
│   ├── sop-lab.js         # Parent-side SOP and postMessage experiments
│   ├── cors-simulator.js  # CORS simulator UI
│   └── live-fetch.js      # Controlled live fetch experiments
└── labs/
    ├── iframe-lab.js        # Frame-side postMessage handler
    ├── iframe-safe.html       # Same-origin iframe content
    └── iframe-sandboxed.html  # Sandboxed iframe content
```

## Key Implementation Details

### Preflight Decision Logic

From `cors-core.js`:

```javascript
function needsPreflight(method, headers) {
  return !SAFE_METHODS.has(String(method || '').toUpperCase())
    || unsafeRequestHeaderNames(headers).length > 0;
}
```

### Error Handling in Live Fetch

From `live-fetch.js`:

- Successful CORS requests: Log response status, headers, and body preview
- CSP-restricted targets: Stop before `fetch()` and identify CSP as the reason
- Other failures: Explain that `TypeError` cannot distinguish CORS, DNS, TLS, offline, and other network causes
- The actual preflight OPTIONS request is invisible to JavaScript; only estimated based on request characteristics

### postMessage Communication

Both safe and sandboxed iframes respond to `postMessage`:

- Safe iframe: Uses actual origin (same as parent)
- Sandboxed iframe: Uses `origin: null` and replies with `targetOrigin: '*'`

This demonstrates that `postMessage` works across security boundaries where direct DOM access fails.
