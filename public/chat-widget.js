(function () {
  'use strict';

  // ── Inject HTML ──────────────────────────────────────
  const widgetHTML = `
    <button id="dtd-chat-trigger" aria-label="Open Style Advisor">
      <span class="icon-chat">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
             xmlns="http://www.w3.org/2000/svg">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                fill="#fffdf7"/>
        </svg>
      </span>
      <span class="icon-close">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
             stroke="#fffdf7" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </span>
    </button>

    <div id="dtd-chat-window" role="dialog" aria-label="Style Advisor">
      <div class="dtd-header">
        <div class="dtd-header-avatar">✨</div>
        <div>
          <div class="dtd-header-name">Style Advisor</div>
          <div class="dtd-header-status">Online · DressTheDay AI</div>
        </div>
      </div>

      <div class="dtd-messages" id="dtd-messages"></div>

      <div class="dtd-divider"></div>

      <div class="dtd-input-area">
        <textarea
          class="dtd-input"
          id="dtd-input"
          placeholder="Ask me anything about outfits…"
          rows="1"
          aria-label="Type your message"
        ></textarea>
        <button class="dtd-send" id="dtd-send" aria-label="Send">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="#fffdf7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
      <div class="dtd-footer">Powered by DressTheDay AI · Style advice only</div>
    </div>
  `;

  const container = document.createElement('div');
  container.innerHTML = widgetHTML;
  document.body.appendChild(container);

  // ── State ─────────────────────────────────────────────
  const history = [];   // { role: 'user'|'assistant', content: string }
  let isOpen = false;
  let isLoading = false;

  // ── Elements ──────────────────────────────────────────
  const trigger  = document.getElementById('dtd-chat-trigger');
  const window_  = document.getElementById('dtd-chat-window');
  const messages = document.getElementById('dtd-messages');
  const input    = document.getElementById('dtd-input');
  const sendBtn  = document.getElementById('dtd-send');

  // ── Quick reply presets ────────────────────────────────
  const PRESETS = [
    { label: '🎉 I need a wedding outfit', text: 'I need an outfit for a wedding. Can you recommend something elegant?' },
    { label: '🌸 Date night look ideas', text: 'What would you suggest for a spring date night look?' },
    { label: '🎭 Attending a formal gala', text: 'I have a formal gala fundraiser to attend. What style works best?' },
    { label: '🧧 Cultural celebration outfit', text: 'I am attending a traditional cultural celebration. What outfits do you carry?' },
    { label: '👗 How does sizing work?', text: 'How does your sizing work? Do you offer backup sizes?' },
    { label: '📦 How does renting work?', text: 'Can you explain how the rental process works from start to finish?' },
  ];

  // ── Toggle open/close ──────────────────────────────────
  function toggleChat() {
    isOpen = !isOpen;
    trigger.classList.toggle('open', isOpen);
    window_.classList.toggle('open', isOpen);

    if (isOpen && messages.children.length === 0) {
      showWelcome();
    }
    if (isOpen) {
      setTimeout(() => input.focus(), 300);
    }
  }

  // ── Welcome message + chips ────────────────────────────
  function showWelcome() {
    addMessage('ai',
      'Hi there! 👗 I\'m your DressTheDay Style Advisor. I can help you find the perfect outfit for any occasion — weddings, galas, cultural celebrations, and more. What are you dressing for today?'
    );
    addChips();
  }

  // ── Add a message bubble ───────────────────────────────
  function addMessage(role, text) {
    const wrap = document.createElement('div');
    wrap.className = `dtd-msg ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'dtd-msg-avatar';
    avatar.textContent = role === 'ai' ? '✨' : '👤';

    const bubble = document.createElement('div');
    bubble.className = 'dtd-msg-bubble';
    bubble.textContent = text;

    wrap.appendChild(avatar);
    wrap.appendChild(bubble);
    messages.appendChild(wrap);
    scrollBottom();
  }

  // ── Quick reply chips ──────────────────────────────────
  function addChips() {
    const wrap = document.createElement('div');
    wrap.className = 'dtd-msg ai';

    const avatar = document.createElement('div');
    avatar.className = 'dtd-msg-avatar';
    avatar.textContent = '✨';

    const chipsDiv = document.createElement('div');
    chipsDiv.className = 'dtd-chips';

    PRESETS.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'dtd-chip';
      btn.textContent = p.label;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        chipsDiv.closest('.dtd-msg')?.remove();
        sendMessage(p.text);
      });
      chipsDiv.appendChild(btn);
    });

    wrap.appendChild(avatar);
    wrap.appendChild(chipsDiv);
    messages.appendChild(wrap);
    scrollBottom();
  }

  // ── Typing indicator ───────────────────────────────────
  function showTyping() {
    const wrap = document.createElement('div');
    wrap.className = 'dtd-msg ai';
    wrap.id = 'dtd-typing-row';

    const avatar = document.createElement('div');
    avatar.className = 'dtd-msg-avatar';
    avatar.textContent = '✨';

    const typing = document.createElement('div');
    typing.className = 'dtd-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';

    wrap.appendChild(avatar);
    wrap.appendChild(typing);
    messages.appendChild(wrap);
    scrollBottom();
  }

  function hideTyping() {
    document.getElementById('dtd-typing-row')?.remove();
  }

  function scrollBottom() {
    messages.scrollTop = messages.scrollHeight;
  }

  // ── Send a message ─────────────────────────────────────
  async function sendMessage(text) {
    text = text.trim();
    if (!text || isLoading) return;

    // Show user bubble
    addMessage('user', text);
    history.push({ role: 'user', content: text });

    // Clear input
    input.value = '';
    input.style.height = 'auto';

    // Loading state
    isLoading = true;
    sendBtn.disabled = true;
    showTyping();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });

      hideTyping();

      if (!res.ok) {
        addMessage('ai', 'Sorry, I\'m having trouble connecting right now. Please try again in a moment! 💌');
        return;
      }

      const data = await res.json();
      const reply = data.reply || 'I\'m here to help! Could you tell me more about the occasion?';
      addMessage('ai', reply);
      history.push({ role: 'assistant', content: reply });

    } catch (err) {
      hideTyping();
      addMessage('ai', 'Oops, something went wrong. Please try again! 💌');
    } finally {
      isLoading = false;
      sendBtn.disabled = false;
    }
  }

  // ── Event listeners ────────────────────────────────────
  trigger.addEventListener('click', toggleChat);

  sendBtn.addEventListener('click', () => sendMessage(input.value));

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input.value);
    }
  });

  // Auto-resize textarea
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 90) + 'px';
  });

  // Close on outside click
  document.addEventListener('click', e => {
    if (isOpen && !window_.contains(e.target) && e.target !== trigger && !trigger.contains(e.target)) {
      toggleChat();
    }
  });

})();
