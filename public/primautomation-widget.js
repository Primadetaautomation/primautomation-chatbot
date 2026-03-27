/**
 * primautomation-widget.js
 * Self-contained floating chat widget for PrimAutomation.
 * Text-only (no ElevenLabs). Bundle as IIFE:
 *   esbuild public/primautomation-widget.js --bundle --format=iife --outfile=public/primautomation-widget-bundle.js --platform=browser
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCENT = '#0d9488'
const ACCENT_HOVER = '#0f766e'
const ACCENT_DARK = '#115e59'
const POLL_INTERVAL_MS = 5000
const ESCALATION_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
const HUMAN_LINK_THRESHOLD = 3 // show "talk to human" after 3rd agent message

const API_BASE = window.PRIMAUTOMATION_API_URL || ''

// ---------------------------------------------------------------------------
// Language detection (nl/en only)
// ---------------------------------------------------------------------------

function detectLanguage() {
  const supported = ['nl', 'en']

  // 1. html[lang] attribute
  const htmlLang = document.documentElement.lang?.slice(0, 2).toLowerCase()
  if (supported.includes(htmlLang)) return htmlLang

  // 2. navigator.language
  const navLang = navigator.language?.slice(0, 2).toLowerCase()
  if (supported.includes(navLang)) return navLang

  return 'nl'
}

// ---------------------------------------------------------------------------
// Copy maps
// ---------------------------------------------------------------------------

function getWelcomeMessage(language) {
  const messages = {
    nl: 'Hoi! Ik ben de assistent van PrimAutomation. Waarmee kan ik je helpen?',
    en: "Hi! I'm the PrimAutomation assistant. How can I help you?",
  }
  return messages[language] || messages.nl
}

const UI_STRINGS = {
  nl: {
    title: 'PrimAutomation Assistant',
    escalated: 'Verbonden met een medewerker',
    inputPlaceholder: 'Typ een bericht...',
    send: 'Verstuur',
    talkToHuman: 'Praat met een medewerker',
    contactPrompt: 'Laat je gegevens achter zodat we je kunnen bereiken:',
    phonePlaceholder: 'Telefoonnummer *',
    emailPlaceholderOptional: 'E-mailadres (optioneel)',
    contactSubmit: 'Verbind mij',
    phoneRequired: 'Vul een telefoonnummer in',
    waitingForAgent: 'We zoeken een medewerker voor je. Even geduld...',
    emailPrompt: 'Geen medewerker beschikbaar. Laat je e-mailadres achter:',
    emailPlaceholder: 'jouw@email.com',
    emailSubmit: 'Verstuur',
    emailSent: 'We nemen zo snel mogelijk contact op!',
    error: 'Service niet beschikbaar. Probeer het later opnieuw.',
    connected: 'Online',
    langLabel: 'NL',
  },
  en: {
    title: 'PrimAutomation Assistant',
    escalated: 'Connected to support team',
    inputPlaceholder: 'Type a message...',
    send: 'Send',
    talkToHuman: 'Talk to a human',
    contactPrompt: 'Leave your details so we can reach you:',
    phonePlaceholder: 'Phone number *',
    emailPlaceholderOptional: 'Email (optional)',
    contactSubmit: 'Connect me',
    phoneRequired: 'Please enter a phone number',
    waitingForAgent: 'Looking for an available agent. Please wait...',
    emailPrompt: 'No agent available. Leave your email address:',
    emailPlaceholder: 'your@email.com',
    emailSubmit: 'Submit',
    emailSent: "We'll get back to you as soon as possible!",
    error: 'Service unavailable. Please try again later.',
    connected: 'Online',
    langLabel: 'EN',
  },
}

function t(key, language) {
  return UI_STRINGS[language]?.[key] || UI_STRINGS['nl'][key] || key
}

// ---------------------------------------------------------------------------
// CSS injection
// ---------------------------------------------------------------------------

function injectStyles() {
  const style = document.createElement('style')
  style.id = 'pa-styles'
  style.textContent = `
    /* =====================================================
       PrimAutomation Widget — .pd- namespace
       ===================================================== */

    :root {
      --pa-accent: ${ACCENT};
      --pa-accent-hover: ${ACCENT_HOVER};
      --pa-accent-dark: ${ACCENT_DARK};
      --pa-radius: 16px;
      --pa-shadow: 0 20px 60px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.25);
      --pa-bubble-size: 60px;
      --pa-panel-w: 380px;
      --pa-panel-h: 520px;
      --pa-font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

      /* Light-mode defaults */
      --pa-bg: #ffffff;
      --pa-bg-header: linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%);
      --pa-bg-messages: #f7f9fc;
      --pa-bg-input: #ffffff;
      --pa-bg-msg-agent: #f0f0fd;
      --pa-bg-msg-user: ${ACCENT};
      --pa-border: rgba(0,0,0,0.09);
      --pa-text: #1a1a2e;
      --pa-text-muted: #64748b;
      --pa-text-msg-user: #ffffff;
      --pa-text-msg-agent: #1a1a2e;
      --pa-text-header: #ffffff;
      --pa-avatar-bg: rgba(255,255,255,0.25);
      --pa-input-border: rgba(0,0,0,0.12);
      --pa-input-focus: ${ACCENT};
      --pa-btn-icon-bg: rgba(0,0,0,0.05);
      --pa-btn-icon-hover: rgba(0,0,0,0.1);
      --pa-escalated-bg: linear-gradient(135deg, #5a4f8a 0%, #4a3d7a 100%);
      --pa-human-link: ${ACCENT};
    }

    /* Dark mode via media query */
    @media (prefers-color-scheme: dark) {
      :root {
        --pa-bg: #12141a;
        --pa-bg-messages: #0e1016;
        --pa-bg-input: #1a1d26;
        --pa-bg-msg-agent: #1e1e30;
        --pa-border: rgba(255,255,255,0.08);
        --pa-text: #f1f3f9;
        --pa-text-muted: #94a3b8;
        --pa-text-msg-agent: #e2e5ec;
        --pa-btn-icon-bg: rgba(255,255,255,0.06);
        --pa-btn-icon-hover: rgba(255,255,255,0.12);
        --pa-input-border: rgba(255,255,255,0.1);
      }
    }

    /* Dark mode via parent attribute */
    [data-theme="dark"] {
      --pa-bg: #12141a;
      --pa-bg-messages: #0e1016;
      --pa-bg-input: #1a1d26;
      --pa-bg-msg-agent: #1e1e30;
      --pa-border: rgba(255,255,255,0.08);
      --pa-text: #f1f3f9;
      --pa-text-muted: #94a3b8;
      --pa-text-msg-agent: #e2e5ec;
      --pa-btn-icon-bg: rgba(255,255,255,0.06);
      --pa-btn-icon-hover: rgba(255,255,255,0.12);
      --pa-input-border: rgba(255,255,255,0.1);
    }

    /* ---- Bubble ---- */
    #pa-bubble {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: var(--pa-bubble-size);
      height: var(--pa-bubble-size);
      border-radius: 50%;
      background: var(--pa-bg-header);
      box-shadow: 0 4px 20px rgba(102,126,234,0.4), 0 2px 8px rgba(0,0,0,0.3);
      cursor: pointer;
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      outline: none;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      -webkit-tap-highlight-color: transparent;
    }
    #pa-bubble:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 28px rgba(102,126,234,0.55), 0 3px 12px rgba(0,0,0,0.35);
    }
    #pa-bubble:active {
      transform: scale(0.96);
    }
    #pa-bubble svg {
      width: 26px;
      height: 26px;
      fill: #fff;
      transition: opacity 0.2s ease;
    }
    #pa-bubble .pa-bubble-open { display: block; }
    #pa-bubble .pa-bubble-close { display: none; }
    #pa-bubble.pd-open .pa-bubble-open { display: none; }
    #pa-bubble.pd-open .pa-bubble-close { display: block; }

    /* Unread badge */
    #pd-badge {
      position: absolute;
      top: -3px;
      right: -3px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #ef4444;
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      font-family: var(--pa-font);
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid #fff;
      opacity: 0;
      transform: scale(0);
      transition: opacity 0.2s, transform 0.2s;
    }
    #pd-badge.pd-visible {
      opacity: 1;
      transform: scale(1);
    }

    /* ---- Panel ---- */
    #pa-panel {
      position: fixed;
      bottom: 96px;
      right: 24px;
      width: var(--pa-panel-w);
      height: var(--pa-panel-h);
      background: var(--pa-bg);
      border-radius: var(--pa-radius);
      box-shadow: var(--pa-shadow);
      z-index: 10000;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border: 1px solid var(--pa-border);
      font-family: var(--pa-font);
      color: var(--pa-text);

      /* Hidden state */
      opacity: 0;
      transform: translateY(16px) scale(0.97);
      pointer-events: none;
      transition: opacity 0.22s ease, transform 0.22s ease;
      transform-origin: bottom right;
    }
    #pa-panel.pd-open {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: all;
    }

    /* ---- Header ---- */
    .pa-header {
      background: var(--pa-bg-header);
      padding: 16px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
      position: relative;
    }
    .pa-header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .pa-header-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--pa-avatar-bg);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .pa-header-avatar svg {
      width: 20px;
      height: 20px;
      fill: rgba(255,255,255,0.9);
    }
    .pa-header-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .pa-header-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--pa-text-header);
      line-height: 1.2;
    }
    .pa-header-status {
      font-size: 11px;
      color: rgba(255,255,255,0.75);
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .pd-status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: rgba(255,255,255,0.6);
      transition: background 0.3s;
      flex-shrink: 0;
    }
    .pd-status-dot.pd-online { background: #86efac; }
    .pd-status-dot.pa-typing {
      background: #fbbf24;
      animation: pd-pulse 1s ease-in-out infinite;
    }

    .pa-header-right {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
      overflow: hidden;
    }
    .pa-lang-badge {
      font-size: 10px;
      font-weight: 600;
      color: rgba(255,255,255,0.8);
      background: rgba(255,255,255,0.15);
      border-radius: 4px;
      padding: 2px 6px;
      letter-spacing: 0.05em;
    }
    .pd-close-btn {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: none;
      background: rgba(255,255,255,0.15);
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
      flex-shrink: 0;
    }
    .pd-close-btn:hover { background: rgba(255,255,255,0.25); }
    .pd-close-btn svg { width: 14px; height: 14px; fill: #fff; }

    /* ---- Messages ---- */
    .pa-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: var(--pa-bg-messages);
      scroll-behavior: smooth;
    }
    .pa-messages::-webkit-scrollbar { width: 4px; }
    .pa-messages::-webkit-scrollbar-track { background: transparent; }
    .pa-messages::-webkit-scrollbar-thumb {
      background: rgba(102,126,234,0.3);
      border-radius: 2px;
    }

    /* ---- Message rows ---- */
    .pa-msg-row {
      display: flex;
      gap: 8px;
      align-items: flex-end;
      animation: pa-msg-in 0.18s ease;
    }
    .pa-msg-row.pd-user { flex-direction: row-reverse; }

    .pa-msg-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--pa-accent);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-bottom: 2px;
    }
    .pa-msg-avatar svg { width: 14px; height: 14px; fill: #fff; }

    .pa-msg-bubble {
      max-width: 78%;
      padding: 9px 13px;
      border-radius: 14px;
      font-size: 13.5px;
      line-height: 1.5;
      word-wrap: break-word;
    }
    .pa-msg-bubble ul, .pa-msg-bubble ol {
      margin: 4px 0;
      padding-left: 18px;
    }
    .pa-msg-bubble li {
      margin: 2px 0;
    }
    .pa-msg-bubble strong {
      font-weight: 700;
    }
    .pd-agent .pa-msg-bubble {
      background: var(--pa-bg-msg-agent);
      color: var(--pa-text-msg-agent);
      border-bottom-left-radius: 4px;
      border: 1px solid var(--pa-border);
    }
    .pd-user .pa-msg-bubble {
      background: var(--pa-bg-msg-user);
      color: var(--pa-text-msg-user);
      border-bottom-right-radius: 4px;
    }

    /* Typing indicator */
    .pa-typing-row {
      display: flex;
      gap: 8px;
      align-items: flex-end;
      animation: pa-msg-in 0.18s ease;
    }
    .pa-typing-bubble {
      background: var(--pa-bg-msg-agent);
      border: 1px solid var(--pa-border);
      border-radius: 14px;
      border-bottom-left-radius: 4px;
      padding: 10px 14px;
      display: flex;
      gap: 4px;
      align-items: center;
    }
    .pa-typing-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--pa-text-muted);
      animation: pa-typing-bounce 1.2s ease-in-out infinite;
    }
    .pa-typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .pa-typing-dot:nth-child(3) { animation-delay: 0.4s; }

    /* Email form */
    .pa-email-form {
      display: none;
      flex-direction: column;
      gap: 8px;
      padding: 12px 14px;
      background: var(--pa-bg-messages);
      border-top: 1px solid var(--pa-border);
      animation: pa-msg-in 0.2s ease;
    }
    .pa-email-form.pd-visible { display: flex; }
    .pa-email-form p {
      font-size: 12.5px;
      color: var(--pa-text-muted);
      margin: 0;
    }
    .pa-email-row {
      display: flex;
      gap: 6px;
    }
    .pa-email-input {
      flex: 1;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid var(--pa-input-border);
      background: var(--pa-bg-input);
      color: var(--pa-text);
      font-size: 13px;
      font-family: var(--pa-font);
      outline: none;
      transition: border-color 0.2s;
    }
    .pa-email-input:focus { border-color: var(--pa-input-focus); }
    .pa-email-submit {
      padding: 8px 14px;
      border-radius: 8px;
      border: none;
      background: var(--pa-accent);
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      font-family: var(--pa-font);
      transition: background 0.15s;
      white-space: nowrap;
    }
    .pa-email-submit:hover { background: var(--pa-accent-hover); }

    /* ---- Talk to human link ---- */
    .pa-human-link {
      display: none;
      text-align: center;
      padding: 6px 14px 0;
    }
    .pa-human-link.pd-visible { display: block; }
    .pa-human-link button {
      background: none;
      border: none;
      color: var(--pa-human-link, ${ACCENT});
      font-size: 12px;
      font-family: var(--pa-font);
      cursor: pointer;
      text-decoration: underline;
      text-underline-offset: 2px;
      padding: 4px 0;
      transition: opacity 0.15s;
    }
    .pa-human-link button:hover { opacity: 0.75; }

    /* ---- Input bar ---- */
    .pa-input-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 14px;
      border-top: 1px solid var(--pa-border);
      background: var(--pa-bg-input);
      flex-shrink: 0;
    }
    .pd-text-input {
      flex: 1;
      padding: 9px 12px;
      border-radius: 10px;
      border: 1px solid var(--pa-input-border);
      background: var(--pa-bg-messages);
      color: var(--pa-text);
      font-size: 13.5px;
      font-family: var(--pa-font);
      outline: none;
      resize: none;
      line-height: 1.4;
      transition: border-color 0.2s;
      min-height: 38px;
      max-height: 100px;
    }
    .pd-text-input:focus { border-color: var(--pa-input-focus); }
    .pd-text-input::placeholder { color: var(--pa-text-muted); }

    .pd-send-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: none;
      background: var(--pa-accent);
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.15s, transform 0.1s;
    }
    .pd-send-btn:hover { background: var(--pa-accent-hover); }
    .pd-send-btn:active { transform: scale(0.92); }
    .pd-send-btn svg { width: 16px; height: 16px; fill: #fff; }
    .pd-send-btn:disabled { opacity: 0.45; cursor: not-allowed; }

    /* ---- Keyframes ---- */
    @keyframes pa-msg-in {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes pa-typing-bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-5px); }
    }
    @keyframes pd-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    /* ---- Mobile ---- */
    @media (max-width: 768px) {
      #pa-panel {
        bottom: 0;
        right: 0;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        border-radius: 0;
        transform: translateY(100%) scale(1);
        transform-origin: bottom center;
      }
      #pa-panel.pd-open {
        transform: translateY(0) scale(1);
      }
      #pa-bubble {
        bottom: 16px;
        right: 16px;
      }
    }
  `
  document.head.appendChild(style)
}

// ---------------------------------------------------------------------------
// SVG icons (inline, no external dependencies)
// ---------------------------------------------------------------------------

const ICONS = {
  chat: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg>`,
  close: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6l12 12" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg>`,
  send: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`,
  agentAvatar: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2a5 5 0 1 0 0 10A5 5 0 0 0 12 2zM2 20c0-4 4.5-7 10-7s10 3 10 7H2z" fill="rgba(255,255,255,0.9)"/></svg>`,
  support: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 1a11 11 0 1 0 0 22A11 11 0 0 0 12 1zm0 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm0 14.5c-2.97 0-5.6-1.34-7.37-3.44C5.66 14.36 8.63 13 12 13s6.34 1.36 7.37 3.06C17.6 18.16 14.97 19.5 12 19.5z" fill="rgba(255,255,255,0.9)"/></svg>`,
}

// ---------------------------------------------------------------------------
// DOM builder helpers
// ---------------------------------------------------------------------------

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag)
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'className') node.className = v
    else if (k === 'innerHTML') node.innerHTML = v
    else if (k === 'style') Object.assign(node.style, v)
    else node.setAttribute(k, v)
  })
  children.forEach((c) => c && node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c))
  return node
}

// ---------------------------------------------------------------------------
// Widget state
// ---------------------------------------------------------------------------

const state = {
  isOpen: false,
  language: 'nl',
  conversationId: null,
  agentMessageCount: 0,
  chatHistory: [],             // {role, content} for escalation
  escalated: false,
  escalationId: null,
  escalationTimer: null,
  pollInterval: null,
  unread: 0,
  pendingTextRequestId: 0,
}

// ---------------------------------------------------------------------------
// DOM references (populated in buildWidget)
// ---------------------------------------------------------------------------

let dom = {}

// ---------------------------------------------------------------------------
// Widget DOM construction
// ---------------------------------------------------------------------------

function buildWidget() {
  // ----- Bubble -----
  const bubble = el('button', { id: 'pa-bubble', 'aria-label': 'Open chat' }, [])
  bubble.innerHTML = `
    <svg class="pa-bubble-open" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/>
    </svg>
    <svg class="pa-bubble-close" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 6L6 18M6 6l12 12" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    </svg>
    <span id="pd-badge"></span>
  `

  // ----- Panel -----
  const panel = el('div', { id: 'pa-panel', role: 'dialog', 'aria-label': 'PrimAutomation chat', 'aria-modal': 'true' })

  // Header
  const header = el('div', { className: 'pa-header' })
  header.innerHTML = `
    <div class="pa-header-left">
      <div class="pa-header-avatar">${ICONS.support}</div>
      <div class="pa-header-info">
        <div class="pa-header-title" id="pa-header-title">PrimAutomation Assistant</div>
        <div class="pa-header-status">
          <span class="pd-status-dot" id="pd-status-dot"></span>
          <span id="pd-status-text"></span>
        </div>
      </div>
    </div>
    <div class="pa-header-right">
      <span class="pa-lang-badge" id="pa-lang-badge">NL</span>
      <button class="pd-close-btn" id="pd-close-btn" aria-label="Close chat">${ICONS.close}</button>
    </div>
  `

  // Messages area
  const messages = el('div', { className: 'pa-messages', id: 'pa-messages', 'aria-live': 'polite', 'aria-relevant': 'additions' })

  // Email form
  const emailForm = el('div', { className: 'pa-email-form', id: 'pa-email-form' })
  emailForm.innerHTML = `
    <p id="pa-email-prompt"></p>
    <div class="pa-email-row">
      <input class="pa-email-input" id="pa-email-input" type="email" autocomplete="email" />
      <button class="pa-email-submit" id="pa-email-submit"></button>
    </div>
  `

  // Contact form (phone + optional email before escalation)
  const contactForm = el('div', { className: 'pa-email-form', id: 'pa-contact-form' })
  contactForm.innerHTML = `
    <p id="pa-contact-prompt" style="margin-bottom:8px;"></p>
    <div class="pa-email-row" style="margin-bottom:6px;">
      <input class="pa-email-input" id="pa-phone-input" type="tel" autocomplete="tel" style="flex:1;" />
    </div>
    <div class="pa-email-row" style="margin-bottom:6px;">
      <input class="pa-email-input" id="pa-contact-email" type="email" autocomplete="email" style="flex:1;" />
    </div>
    <p id="pa-phone-error" style="color:#ef4444;font-size:12px;margin:0 0 6px;display:none;"></p>
    <button class="pa-email-submit" id="pa-contact-submit" style="width:100%;"></button>
  `

  // "Talk to human" link
  const humanLink = el('div', { className: 'pa-human-link', id: 'pa-human-link' })
  humanLink.innerHTML = `<button id="pa-human-btn"></button>`

  // Input bar (no mic button)
  const inputBar = el('div', { className: 'pa-input-bar' })
  inputBar.innerHTML = `
    <textarea
      class="pd-text-input"
      id="pd-text-input"
      rows="1"
      aria-label="Message"
    ></textarea>
    <button class="pd-send-btn" id="pd-send-btn" aria-label="Send message" disabled>
      ${ICONS.send}
    </button>
  `

  panel.appendChild(header)
  panel.appendChild(messages)
  panel.appendChild(humanLink)
  panel.appendChild(contactForm)
  panel.appendChild(emailForm)
  panel.appendChild(inputBar)

  document.body.appendChild(bubble)
  document.body.appendChild(panel)

  // Cache references
  dom = {
    bubble,
    panel,
    badge: document.getElementById('pd-badge'),
    headerTitle: document.getElementById('pa-header-title'),
    statusDot: document.getElementById('pd-status-dot'),
    statusText: document.getElementById('pd-status-text'),
    langBadge: document.getElementById('pa-lang-badge'),
    closeBtn: document.getElementById('pd-close-btn'),
    messages,
    contactForm,
    contactPrompt: document.getElementById('pa-contact-prompt'),
    phoneInput: document.getElementById('pa-phone-input'),
    contactEmail: document.getElementById('pa-contact-email'),
    phoneError: document.getElementById('pa-phone-error'),
    contactSubmit: document.getElementById('pa-contact-submit'),
    emailForm,
    emailPrompt: document.getElementById('pa-email-prompt'),
    emailInput: document.getElementById('pa-email-input'),
    emailSubmit: document.getElementById('pa-email-submit'),
    humanLink,
    humanBtn: document.getElementById('pa-human-btn'),
    textInput: document.getElementById('pd-text-input'),
    sendBtn: document.getElementById('pd-send-btn'),
  }
}

// ---------------------------------------------------------------------------
// i18n application
// ---------------------------------------------------------------------------

function applyLanguage(lang) {
  dom.langBadge.textContent = t('langLabel', lang)
  dom.headerTitle.textContent = state.escalated ? t('escalated', lang) : t('title', lang)
  dom.textInput.placeholder = t('inputPlaceholder', lang)
  dom.humanBtn.textContent = t('talkToHuman', lang)
  dom.contactPrompt.textContent = t('contactPrompt', lang)
  dom.phoneInput.placeholder = t('phonePlaceholder', lang)
  dom.contactEmail.placeholder = t('emailPlaceholderOptional', lang)
  dom.contactSubmit.textContent = t('contactSubmit', lang)
  dom.phoneError.textContent = t('phoneRequired', lang)
  dom.emailPrompt.textContent = t('emailPrompt', lang)
  dom.emailInput.placeholder = t('emailPlaceholder', lang)
  dom.emailSubmit.textContent = t('emailSubmit', lang)
}

// ---------------------------------------------------------------------------
// Simple markdown renderer (safe — escapes HTML first)
// ---------------------------------------------------------------------------

function renderMarkdown(text) {
  // Escape HTML to prevent XSS
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc
    // Bold: **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // Italic: *text* or _text_
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
    // Bullet lists: lines starting with - or bullet
    .replace(/^[\-\u2022]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
    // Numbered lists: lines starting with 1. 2. etc
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
    .replace(/((?:<li>.*<\/li>\n?)+)/g, (m) => m.includes('<ul>') ? m : `<ol>${m}</ol>`)
    // Line breaks
    .replace(/\n/g, '<br>')
    // Clean up extra <br> inside lists
    .replace(/<br><li>/g, '<li>')
    .replace(/<\/li><br>/g, '</li>')
}

// ---------------------------------------------------------------------------
// Message rendering
// ---------------------------------------------------------------------------

function addChatMessage(role, text) {
  // Track for escalation
  state.chatHistory.push({ role, content: text })

  // Remove typing indicator if present
  removeTypingIndicator()

  const row = el('div', { className: `pa-msg-row ${role === 'user' ? 'pd-user' : 'pd-agent'}` })

  if (role === 'agent') {
    const avatar = el('div', { className: 'pa-msg-avatar', innerHTML: ICONS.agentAvatar })
    row.appendChild(avatar)
  }

  const bubble = el('div', { className: 'pa-msg-bubble' })
  if (role === 'agent') {
    bubble.innerHTML = renderMarkdown(text)
  } else {
    bubble.textContent = text
  }
  row.appendChild(bubble)

  dom.messages.appendChild(row)
  scrollToBottom()

  if (role === 'agent') {
    state.agentMessageCount++
    if (state.agentMessageCount >= HUMAN_LINK_THRESHOLD && !state.escalated) {
      dom.humanLink.classList.add('pd-visible')
    }

    // Show unread badge if panel is closed
    if (!state.isOpen) {
      state.unread++
      updateBadge()
    }
  }

  return row
}

function addSystemMessage(text) {
  const row = el('div', { className: 'pa-msg-row pd-agent' })
  const bubble = el('div', {
    className: 'pa-msg-bubble',
    style: { fontStyle: 'italic', opacity: '0.75', fontSize: '12.5px' },
  })
  bubble.textContent = text
  row.appendChild(bubble)
  dom.messages.appendChild(row)
  scrollToBottom()
  // Always show "talk to human" when errors occur
  if (!state.escalated) dom.humanLink.classList.add('pd-visible')
}

function showTypingIndicator() {
  if (document.getElementById('pa-typing')) return
  const row = el('div', { className: 'pa-typing-row', id: 'pa-typing' })
  const avatar = el('div', { className: 'pa-msg-avatar', innerHTML: ICONS.agentAvatar })
  const bubble = el('div', { className: 'pa-typing-bubble' })
  bubble.innerHTML = `
    <div class="pa-typing-dot"></div>
    <div class="pa-typing-dot"></div>
    <div class="pa-typing-dot"></div>
  `
  row.appendChild(avatar)
  row.appendChild(bubble)
  dom.messages.appendChild(row)
  scrollToBottom()
}

function removeTypingIndicator() {
  const typing = document.getElementById('pa-typing')
  if (typing) typing.remove()
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    dom.messages.scrollTop = dom.messages.scrollHeight
  })
}

function updateBadge() {
  if (state.unread > 0) {
    dom.badge.textContent = state.unread > 9 ? '9+' : String(state.unread)
    dom.badge.classList.add('pd-visible')
  } else {
    dom.badge.classList.remove('pd-visible')
  }
}

function setStatus(type, label) {
  dom.statusDot.className = `pd-status-dot ${type ? `pd-${type}` : ''}`
  dom.statusText.textContent = label
}

// ---------------------------------------------------------------------------
// Text message send
// ---------------------------------------------------------------------------

async function sendTextMessage() {
  const text = dom.textInput.value.trim()
  if (!text) return

  const requestId = ++state.pendingTextRequestId
  dom.textInput.value = ''
  autoResizeTextarea()
  dom.sendBtn.disabled = true

  addChatMessage('user', text)

  // After escalation: send user messages to admin, not AI
  if (state.escalated && state.escalationId) {
    try {
      await fetch(`${API_BASE}/api/user-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: state.escalationId, message: text }),
      })
    } catch (err) {
      console.error('[PrimAutomationWidget] user-reply error:', err)
    } finally {
      dom.sendBtn.disabled = false
    }
    return
  }

  showTypingIndicator()
  setStatus('online', t('connected', state.language))

  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        conversationId: state.conversationId,
        language: state.language,
      }),
    })

    removeTypingIndicator()

    if (!res.ok) throw new Error(`Chat failed: ${res.status}`)
    const data = await res.json()
    if (state.escalated || requestId !== state.pendingTextRequestId) return

    // Track conversationId from server
    if (data.conversationId) {
      state.conversationId = data.conversationId
    }

    if (data.reply) {
      addChatMessage('agent', data.reply)
    }

    // Auto-escalate if server says so
    if (data.escalate) {
      await escalateToHuman('Agent could not resolve the issue')
    }
  } catch (err) {
    removeTypingIndicator()
    console.error('[PrimAutomationWidget] chat error:', err)
    if (!state.escalated) {
      addSystemMessage(t('error', state.language))
    }
  } finally {
    dom.sendBtn.disabled = false
  }
}

// ---------------------------------------------------------------------------
// Escalation
// ---------------------------------------------------------------------------

async function submitContactForm() {
  const phone = dom.phoneInput.value.trim()
  const email = dom.contactEmail.value.trim()

  // Phone is required
  if (!phone || phone.length < 6) {
    dom.phoneError.style.display = 'block'
    dom.phoneInput.focus()
    return
  }
  dom.phoneError.style.display = 'none'
  dom.contactSubmit.disabled = true

  // Hide contact form
  dom.contactForm.classList.remove('pd-visible')

  // Store contact info and escalate
  state.userPhone = phone
  state.userEmail = email || null
  await escalateToHuman('User requested human agent')
}

async function escalateToHuman(reason = 'User requested human agent') {
  if (state.escalated) return
  state.escalated = true
  state.pendingTextRequestId += 1
  removeTypingIndicator()

  // Update header to escalated style
  dom.headerTitle.textContent = t('escalated', state.language)
  dom.panel.querySelector('.pa-header').style.background = 'var(--pa-escalated-bg)'
  setStatus('typing', '')

  // Hide "talk to human" link and contact form
  dom.humanLink.classList.remove('pd-visible')
  dom.contactForm.classList.remove('pd-visible')

  addSystemMessage(t('waitingForAgent', state.language))

  try {
    const res = await fetch(`${API_BASE}/api/escalate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: state.conversationId || 'widget-' + Date.now(),
        messages: state.chatHistory.length ? state.chatHistory : [{ role: 'user', content: reason }],
        language: state.language,
        userPhone: state.userPhone || null,
        email: state.userEmail || null,
      }),
    })
    if (!res.ok) throw new Error(`Escalate failed: ${res.status}`)
    const data = await res.json()
    state.escalationId = data.conversationId || data.id || null
  } catch (err) {
    console.error('[PrimAutomationWidget] Escalation error:', err)
    addSystemMessage(t('error', state.language))
    return
  }

  // Start polling for replies
  if (state.escalationId) {
    startPolling()
  }

  // Start escalation timeout timer (5 min -> show email form)
  state.escalationTimer = setTimeout(() => {
    showEmailForm()
  }, ESCALATION_TIMEOUT_MS)
}

function startPolling() {
  if (state.pollInterval) clearInterval(state.pollInterval)
  let lastPollTime = new Date().toISOString()
  state.pollInterval = setInterval(async () => {
    if (!state.escalationId) return
    try {
      const res = await fetch(`${API_BASE}/api/poll/${state.escalationId}?since=${encodeURIComponent(lastPollTime)}`)
      if (!res.ok) return
      const data = await res.json()
      if (data.messages && Array.isArray(data.messages)) {
        const newAdminMsgs = data.messages.filter((msg) => msg.role === 'admin')
        newAdminMsgs.forEach((msg) => {
          addChatMessage('agent', msg.content || msg.text || '')
          // Got a reply -- clear the escalation timeout
          if (state.escalationTimer) {
            clearTimeout(state.escalationTimer)
            state.escalationTimer = null
          }
        })
      }
      lastPollTime = new Date().toISOString()
    } catch (err) {
      // Silent poll failure
    }
  }, POLL_INTERVAL_MS)
}

function showEmailForm() {
  dom.emailForm.classList.add('pd-visible')
  dom.emailInput.focus()
}

async function submitEmail() {
  const email = dom.emailInput.value.trim()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    dom.emailInput.focus()
    return
  }

  dom.emailSubmit.disabled = true

  try {
    await fetch(`${API_BASE}/api/escalate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: state.escalationId || state.conversationId,
        messages: state.chatHistory,
        language: state.language,
        email,
      }),
    })
    dom.emailForm.innerHTML = `<p style="color:var(--pa-accent);font-weight:600;padding:4px 0;">${t('emailSent', state.language)}</p>`
  } catch (err) {
    dom.emailSubmit.disabled = false
    addSystemMessage(t('error', state.language))
  }
}

// ---------------------------------------------------------------------------
// Open / close panel
// ---------------------------------------------------------------------------

function openPanel() {
  state.isOpen = true
  dom.panel.classList.add('pd-open')
  dom.bubble.classList.add('pd-open')
  dom.panel.setAttribute('aria-hidden', 'false')
  dom.textInput.focus()

  // Clear unread
  state.unread = 0
  updateBadge()

  // First open: show welcome
  if (dom.messages.childElementCount === 0) {
    applyLanguage(state.language)
    const welcome = getWelcomeMessage(state.language)
    addChatMessage('agent', welcome)
    setStatus('online', t('connected', state.language))
  }
}

function closePanel() {
  state.isOpen = false
  dom.panel.classList.remove('pd-open')
  dom.bubble.classList.remove('pd-open')
  dom.panel.setAttribute('aria-hidden', 'true')
}

// ---------------------------------------------------------------------------
// Textarea auto-resize
// ---------------------------------------------------------------------------

function autoResizeTextarea() {
  dom.textInput.style.height = 'auto'
  dom.textInput.style.height = Math.min(dom.textInput.scrollHeight, 100) + 'px'
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------

function wireEvents() {
  dom.bubble.addEventListener('click', () => {
    state.isOpen ? closePanel() : openPanel()
  })

  dom.closeBtn.addEventListener('click', closePanel)

  // Click outside to close (desktop)
  document.addEventListener('click', (e) => {
    if (
      state.isOpen &&
      !dom.panel.contains(e.target) &&
      !dom.bubble.contains(e.target) &&
      window.innerWidth > 768
    ) {
      closePanel()
    }
  })

  // Keyboard: Escape closes
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.isOpen) closePanel()
  })

  // Send button
  dom.sendBtn.addEventListener('click', sendTextMessage)

  // Text input: Enter sends, Shift+Enter newline
  dom.textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendTextMessage()
    }
  })

  // Enable/disable send button
  dom.textInput.addEventListener('input', () => {
    dom.sendBtn.disabled = !dom.textInput.value.trim()
    autoResizeTextarea()
  })

  // Talk to human -> show contact form first
  dom.humanBtn.addEventListener('click', () => {
    dom.humanLink.classList.remove('pd-visible')
    dom.contactForm.classList.add('pd-visible')
    dom.phoneInput.focus()
  })

  // Contact form submit -> validate phone, then escalate
  dom.contactSubmit.addEventListener('click', submitContactForm)
  dom.phoneInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); dom.contactEmail.focus() }
  })
  dom.contactEmail.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submitContactForm() }
  })

  // Email form (fallback after timeout)
  dom.emailSubmit.addEventListener('click', submitEmail)
  dom.emailInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitEmail()
  })
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

function init() {
  // Avoid double-init
  if (document.getElementById('pa-bubble')) return

  state.language = detectLanguage()

  injectStyles()
  buildWidget()
  wireEvents()

  // Set initial ARIA hidden
  dom.panel.setAttribute('aria-hidden', 'true')

  console.log('[PrimAutomationWidget] Initialized. Language:', state.language, 'API:', API_BASE)
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
