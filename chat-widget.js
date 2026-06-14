(function () {
    var SYSTEM_PROMPT = "You are an AI car-buying assistant for DirectDrive, a platform that connects consumers directly with car manufacturers. Help users with questions about vehicle comparisons, features, financing, trims, EV range, towing capacity, and anything else related to buying a new car. Be concise, friendly, and specific. If a user asks about a brand or model available on DirectDrive (Ford, Tesla, General Motors, Rivian, Lucid, Polestar), use your knowledge to give accurate, helpful advice. Always recommend they use the DirectDrive platform to configure and order their chosen vehicle.";

    function getApiKey() {
        return localStorage.getItem('dd-api-key') || '';
    }

    // ── Inject styles ──────────────────────────────────────────────
    var style = document.createElement('style');
    style.textContent = [
        '#dd-chat-btn{position:fixed;top:1.25rem;right:1.25rem;width:52px;height:52px;border-radius:50%;background:#2563eb;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(37,99,235,.45);z-index:9999;transition:transform .2s,box-shadow .2s;}',
        '#dd-chat-btn:hover{transform:scale(1.08);box-shadow:0 6px 20px rgba(37,99,235,.55);}',
        '#dd-chat-btn svg{width:26px;height:26px;fill:white;}',
        '#dd-chat-panel{position:fixed;top:4.75rem;right:1.25rem;width:360px;max-height:520px;background:white;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.18);z-index:9998;display:flex;flex-direction:column;overflow:hidden;transform:scale(.92) translateY(-8px);opacity:0;pointer-events:none;transition:transform .22s ease,opacity .22s ease;}',
        '#dd-chat-panel.open{transform:scale(1) translateY(0);opacity:1;pointer-events:all;}',
        '#dd-chat-header{background:#2563eb;color:white;padding:.9rem 1.1rem;display:flex;align-items:center;gap:.6rem;flex-shrink:0;}',
        '#dd-chat-header span{font-weight:700;font-size:.97rem;flex:1;}',
        '#dd-chat-close{background:none;border:none;color:white;font-size:1.3rem;cursor:pointer;line-height:1;padding:0 .25rem;}',
        '#dd-chat-messages{flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:.75rem;min-height:200px;}',
        '.dd-msg{max-width:82%;padding:.6rem .85rem;border-radius:12px;font-size:.88rem;line-height:1.5;word-wrap:break-word;}',
        '.dd-msg.user{align-self:flex-end;background:#2563eb;color:white;border-bottom-right-radius:3px;}',
        '.dd-msg.assistant{align-self:flex-start;background:#f3f4f6;color:#1a1a1a;border-bottom-left-radius:3px;}',
        '.dd-msg.error{background:#fef2f2;color:#dc2626;}',
        '.dd-typing{align-self:flex-start;background:#f3f4f6;border-radius:12px;padding:.6rem .85rem;display:flex;gap:4px;align-items:center;}',
        '.dd-typing span{width:7px;height:7px;border-radius:50%;background:#9ca3af;animation:dd-bounce .9s infinite;}',
        '.dd-typing span:nth-child(2){animation-delay:.15s;}',
        '.dd-typing span:nth-child(3){animation-delay:.3s;}',
        '@keyframes dd-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}',
        '#dd-chat-input-row{display:flex;gap:.5rem;padding:.75rem;border-top:1px solid #e5e7eb;flex-shrink:0;}',
        '#dd-chat-input{flex:1;border:2px solid #e5e7eb;border-radius:8px;padding:.55rem .75rem;font-size:.88rem;outline:none;resize:none;font-family:inherit;line-height:1.4;max-height:90px;}',
        '#dd-chat-input:focus{border-color:#2563eb;}',
        '#dd-chat-send{background:#2563eb;color:white;border:none;border-radius:8px;padding:.55rem .85rem;cursor:pointer;font-weight:600;font-size:.88rem;flex-shrink:0;transition:background .2s;}',
        '#dd-chat-send:hover{background:#1d4ed8;}',
        '#dd-chat-send:disabled{background:#93c5fd;cursor:not-allowed;}',
        '#dd-no-key{padding:1rem;font-size:.85rem;color:#dc2626;text-align:center;}',
        '@media(max-width:420px){#dd-chat-panel{width:calc(100vw - 2rem);right:1rem;}}'
    ].join('');
    document.head.appendChild(style);

    // ── Build DOM ──────────────────────────────────────────────────
    var btn = document.createElement('button');
    btn.id = 'dd-chat-btn';
    btn.title = 'AI Car Assistant';
    btn.innerHTML = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 2H4a2 2 0 00-2 2v18l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2zm-2 10H6V10h12v2zm0-4H6V6h12v2z"/></svg>';

    var panel = document.createElement('div');
    panel.id = 'dd-chat-panel';
    panel.innerHTML =
        '<div id="dd-chat-header">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M12 2a10 10 0 110 20A10 10 0 0112 2zm0 5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm0 6c-2.33 0-4.31 1.46-5.11 3.5h10.22C16.31 14.46 14.33 13 12 13z"/></svg>' +
            '<span>DirectDrive AI Assistant</span>' +
            '<button id="dd-chat-close" title="Close">&times;</button>' +
        '</div>' +
        '<div id="dd-chat-messages">' +
            '<div class="dd-msg assistant">Hi! I\'m your DirectDrive car-buying assistant. Ask me anything — comparisons, features, financing, EV range, and more. \uD83D\uDE97</div>' +
        '</div>' +
        '<div id="dd-chat-input-row">' +
            '<textarea id="dd-chat-input" placeholder="Ask about any vehicle..." rows="1"></textarea>' +
            '<button id="dd-chat-send">Send</button>' +
        '</div>';

    document.body.appendChild(btn);
    document.body.appendChild(panel);

    // ── State & helpers ────────────────────────────────────────────
    var history = [];
    var open = false;
    var busy = false;

    function togglePanel() {
        open = !open;
        panel.classList.toggle('open', open);
        if (open) {
            checkApiKey();
            document.getElementById('dd-chat-input').focus();
        }
    }

    function checkApiKey() {
        var msgs = document.getElementById('dd-chat-messages');
        var existing = document.getElementById('dd-no-key');
        if (!getApiKey()) {
            if (!existing) {
                var warn = document.createElement('div');
                warn.id = 'dd-no-key';
                warn.textContent = 'No API key set. Add your Anthropic API key in the Admin panel to enable the assistant.';
                msgs.appendChild(warn);
                scrollBottom();
            }
            document.getElementById('dd-chat-send').disabled = true;
            document.getElementById('dd-chat-input').disabled = true;
        } else {
            if (existing) existing.remove();
            document.getElementById('dd-chat-send').disabled = false;
            document.getElementById('dd-chat-input').disabled = false;
        }
    }

    function scrollBottom() {
        var msgs = document.getElementById('dd-chat-messages');
        msgs.scrollTop = msgs.scrollHeight;
    }

    function addMessage(role, text) {
        var msgs = document.getElementById('dd-chat-messages');
        var div = document.createElement('div');
        div.className = 'dd-msg ' + role;
        div.textContent = text;
        msgs.appendChild(div);
        scrollBottom();
        return div;
    }

    function showTyping() {
        var msgs = document.getElementById('dd-chat-messages');
        var el = document.createElement('div');
        el.className = 'dd-typing';
        el.id = 'dd-typing';
        el.innerHTML = '<span></span><span></span><span></span>';
        msgs.appendChild(el);
        scrollBottom();
    }

    function removeTyping() {
        var el = document.getElementById('dd-typing');
        if (el) el.remove();
    }

    async function sendMessage() {
        if (busy) return;
        var input = document.getElementById('dd-chat-input');
        var text = input.value.trim();
        if (!text) return;
        var key = getApiKey();
        if (!key) return;

        input.value = '';
        input.style.height = 'auto';
        addMessage('user', text);
        history.push({ role: 'user', content: text });

        busy = true;
        document.getElementById('dd-chat-send').disabled = true;
        showTyping();

        try {
            var res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': key,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                },
                body: JSON.stringify({
                    model: 'claude-sonnet-4-6',
                    max_tokens: 1024,
                    system: SYSTEM_PROMPT,
                    messages: history
                })
            });

            var data = await res.json();

            if (!res.ok) {
                throw new Error(data.error ? data.error.message : 'API error ' + res.status);
            }

            var reply = data.content[0].text;
            history.push({ role: 'assistant', content: reply });
            removeTyping();
            addMessage('assistant', reply);
        } catch (err) {
            removeTyping();
            addMessage('error', 'Error: ' + err.message);
        } finally {
            busy = false;
            document.getElementById('dd-chat-send').disabled = false;
            input.focus();
        }
    }

    // ── Events ─────────────────────────────────────────────────────
    btn.addEventListener('click', togglePanel);
    document.getElementById('dd-chat-close').addEventListener('click', togglePanel);

    document.getElementById('dd-chat-send').addEventListener('click', sendMessage);

    document.getElementById('dd-chat-input').addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    document.getElementById('dd-chat-input').addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 90) + 'px';
    });
})();
