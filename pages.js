// pages.js — All page renderers

// ─── UPLOAD ──────────────────────────────────────────────────────────────────
function renderUpload() {
  const pc = document.getElementById('page-content');
  pc.innerHTML = `
    <h2 style="margin-bottom:1.5rem;font-size:22px">📤 Upload Study Material</h2>
    <div class="upload-zone" id="drop-zone" onclick="document.getElementById('file-input').click()">
      <div class="uz-icon">☁️</div>
      <h3>Drop files here or click to browse</h3>
      <p>Supports PDF, DOCX, TXT, Markdown · Max 20MB</p>
      <input type="file" id="file-input" multiple accept=".pdf,.docx,.txt,.md" style="display:none"/>
    </div>
    <div style="display:flex;align-items:center;gap:.5rem;margin:1rem 0;font-size:13px">
      <input type="checkbox" id="shared-cb" style="width:auto"/>
      <label for="shared-cb" style="cursor:pointer;margin-bottom:0">Share with all students in my organization</label>
    </div>
    <div id="file-list-wrap"></div>`;

  const dz = document.getElementById('drop-zone');
  const fi = document.getElementById('file-input');

  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('drag'); handleUpload(e.dataTransfer.files); });
  fi.addEventListener('change', e => handleUpload(e.target.files));

  loadFileList();

  async function handleUpload(files) {
    if (!files.length) return;
    dz.querySelector('h3').textContent = 'Uploading & parsing...';
    const fd = new FormData();
    Array.from(files).forEach(f => fd.append('files', f));
    fd.append('isShared', document.getElementById('shared-cb').checked);
    try {
      const res = await API.uploadFiles(fd);
      showToast(`✅ ${res.files.length} file(s) uploaded! ${res.files.filter(f=>f.parsed).length} parsed for AI.`);
      loadFileList();
    } catch (e) { showToast('❌ ' + e.message); }
    dz.querySelector('h3').textContent = 'Drop files here or click to browse';
  }

  async function loadFileList() {
    try {
      const d = await API.getFiles();
      const wrap = document.getElementById('file-list-wrap');
      if (!d.files.length) { wrap.innerHTML = '<div class="empty-state"><div class="es-icon">📂</div><p>No files yet. Upload your study materials above.</p></div>'; return; }
      wrap.innerHTML = `<div class="section-title">Uploaded Files (${d.files.length})</div>
        <div class="file-list">${d.files.map(f => `
          <div class="file-item">
            <span>📄</span>
            <span class="fi-name">${f.original}</span>
            <span class="fi-size">${fmtSize(f.size)}</span>
            <span class="fi-parsed ${f.has_content ? 'parsed-yes':'parsed-no'}">${f.has_content ? `✓ Parsed (${Math.round(f.char_count/1000)}k chars)` : '⚠ Not parsed'}</span>
            ${f.is_shared ? '<span class="shared-tag">🌐 Shared</span>' : ''}
            <span class="text-muted">${fmtDate(f.uploaded_at)}</span>
            <span class="text-muted">${f.uploader_name}</span>
            <button class="btn btn-danger" onclick="removeFile('${f.id}')">✕</button>
          </div>`).join('')}
        </div>`;
    } catch(e) {}
  }

  window.removeFile = async (id) => {
    try { await API.deleteFile(id); showToast('File removed.'); loadFileList(); }
    catch(e) { showToast('❌ ' + e.message); }
  };
}

// ─── CHAT ────────────────────────────────────────────────────────────────────
function renderChat(user) {
  const pc = document.getElementById('page-content');
  pc.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
      <div><h2 style="font-size:22px">🤖 AI Study Bot</h2>
      <p class="text-muted">Answers only from your uploaded study materials</p></div>
      <button class="btn" onclick="clearChatHistory()">🗑 Clear</button>
    </div>
    <div id="no-files-warn" class="info-banner hidden">⚠️ Upload study materials first for context-aware answers.</div>
    <div class="chat-wrap">
      <div class="chat-messages" id="chat-msgs"></div>
      <div class="chat-input-row">
        <textarea id="chat-in" rows="2" placeholder="Ask something... (Enter to send, Shift+Enter for new line)"></textarea>
        <button class="send-btn" id="send-btn" onclick="sendChat()">➤</button>
      </div>
    </div>`;

  document.getElementById('chat-in').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
  });

  API.getContext().then(d => {
    if (d.fileCount === 0) document.getElementById('no-files-warn').classList.remove('hidden');
  }).catch(() => {});

  API.getChatHistory().then(d => {
    if (d.messages.length) {
      d.messages.forEach(m => appendMsg(m.role === 'assistant' ? 'bot' : 'user', m.content));
    } else {
      appendMsg('bot', `Hi ${user.name.split(' ')[0]}! 👋 Ask me anything from your uploaded study materials.`);
    }
  }).catch(() => { appendMsg('bot', `Hi ${user.name.split(' ')[0]}! 👋 Ask me anything from your study materials.`); });

  function appendMsg(role, text) {
    const msgs = document.getElementById('chat-msgs');
    if (!msgs) return;
    const div = document.createElement('div');
    div.className = `msg ${role}`;
    div.innerHTML = `<div class="msg-avatar">${role==='user'?'👤':'🤖'}</div><div class="bubble">${text.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  function showTyping() {
    const msgs = document.getElementById('chat-msgs');
    const div = document.createElement('div');
    div.className = 'msg bot'; div.id = 'typing';
    div.innerHTML = `<div class="msg-avatar">🤖</div><div class="bubble"><div class="typing-dot"><span></span><span></span><span></span></div></div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  window.sendChat = async () => {
    const inp = document.getElementById('chat-in');
    const msg = inp.value.trim();
    if (!msg) return;
    inp.value = '';
    document.getElementById('send-btn').disabled = true;
    appendMsg('user', msg);
    showTyping();
    try {
      const res = await API.chat(msg);
      document.getElementById('typing')?.remove();
      appendMsg('bot', res.reply);
    } catch(e) {
      document.getElementById('typing')?.remove();
      appendMsg('bot', '⚠️ ' + e.message);
    }
    document.getElementById('send-btn').disabled = false;
  };

  window.clearChatHistory = async () => {
    await API.clearChat().catch(() => {});
    document.getElementById('chat-msgs').innerHTML = '';
    appendMsg('bot', 'Chat cleared! Ask me anything from your study materials.');
    showToast('Chat history cleared.');
  };
}

// ─── QUIZ ────────────────────────────────────────────────────────────────────
function renderQuiz() {
  let questions = null, cur = 0, score = 0, selected = null, topic = '';
  const pc = document.getElementById('page-content');

  function showSetup() {
    pc.innerHTML = `
      <h2 style="margin-bottom:1.5rem;font-size:22px">🧪 Personalized Quiz</h2>
      <div class="quiz-card">
        <h3 style="margin-bottom:1rem">Generate a Quiz</h3>
        <div class="form-group"><label>Topic</label>
          <input id="q-topic" placeholder="e.g. Newton's Laws, Photosynthesis..." onkeydown="if(event.key==='Enter')startQuiz()"/></div>
        <div class="form-group"><label>Number of Questions</label>
          <select id="q-count"><option value="3">3</option><option value="5" selected>5</option><option value="8">8</option><option value="10">10</option></select></div>
        <div id="q-err" class="error-msg hidden"></div>
        <button class="btn-primary" id="q-btn" onclick="startQuiz()" style="margin-top:.5rem">🧪 Generate Quiz</button>
      </div>`;

    window.startQuiz = async () => {
      topic = document.getElementById('q-topic').value.trim();
      const count = document.getElementById('q-count').value;
      if (!topic) { showToast('Enter a topic first.'); return; }
      const btn = document.getElementById('q-btn');
      btn.textContent = '⏳ Generating...'; btn.disabled = true;
      try {
        const res = await API.generateQuiz(topic, count);
        questions = res.questions; cur = 0; score = 0; selected = null;
        showQuestion();
      } catch(e) { showToast('❌ ' + e.message); btn.textContent = '🧪 Generate Quiz'; btn.disabled = false; }
    };
  }

  function showQuestion() {
    const q = questions[cur];
    pc.innerHTML = `
      <h2 style="margin-bottom:1.5rem;font-size:22px">🧪 Quiz: ${topic}</h2>
      <div class="quiz-card">
        <div class="quiz-bar-wrap">
          <span class="text-muted">Q ${cur+1}/${questions.length}</span>
          <div class="quiz-bar"><div class="quiz-bar-fill" style="width:${(cur+1)/questions.length*100}%"></div></div>
          <span style="color:var(--accent);font-weight:600">${score} pts</span>
        </div>
        <div class="quiz-q">${q.q}</div>
        <div class="quiz-options">
          ${q.opts.map((o,i) => `<button class="quiz-opt" id="opt-${i}" onclick="pickOpt(${i})">
            <strong style="color:var(--muted);margin-right:.5rem">${['A','B','C','D'][i]}.</strong>${o}
          </button>`).join('')}
        </div>
        <div id="explanation" class="hidden"></div>
        <div id="next-wrap" class="hidden" style="display:none;justify-content:flex-end;margin-top:1rem">
          <button class="btn btn-accent" onclick="nextQuestion()">${cur+1>=questions.length?'See Results →':'Next →'}</button>
        </div>
      </div>`;

    window.pickOpt = (i) => {
      if (selected !== null) return;
      selected = i;
      if (i === q.ans) score++;
      document.querySelectorAll('.quiz-opt').forEach((b, idx) => {
        b.disabled = true;
        if (idx === q.ans) b.classList.add('correct');
        else if (idx === i) b.classList.add('wrong');
      });
      if (q.explanation) {
        const el = document.getElementById('explanation');
        el.className = 'explanation-box';
        el.innerHTML = `💡 <strong>Explanation:</strong> ${q.explanation}`;
      }
      const nw = document.getElementById('next-wrap');
      nw.style.display = 'flex'; nw.classList.remove('hidden');
    };

    window.nextQuestion = async () => {
      if (cur + 1 >= questions.length) {
        await API.saveQuiz(topic, score, questions.length).catch(() => {});
        showResult();
      } else { cur++; selected = null; showQuestion(); }
    };
  }

  function showResult() {
    const pct = Math.round(score/questions.length*100);
    pc.innerHTML = `
      <h2 style="margin-bottom:1.5rem;font-size:22px">🧪 Quiz Complete!</h2>
      <div class="quiz-card" style="text-align:center;max-width:480px">
        <div style="font-size:64px;margin-bottom:1rem">${pct>=80?'🏆':pct>=50?'👍':'📚'}</div>
        <h2 style="margin-bottom:.4rem">Score: ${score}/${questions.length}</h2>
        <p class="text-muted" style="margin-bottom:.5rem">${pct}% accuracy on <strong>${topic}</strong></p>
        <p class="text-muted" style="margin-bottom:1.5rem">${pct===100?'🌟 Perfect!':pct>=80?'Excellent work!':pct>=50?'Good effort! Review missed questions.':'More practice needed.'}</p>
        <button class="btn btn-accent" onclick="renderQuiz()">Try Another Quiz</button>
      </div>`;
  }

  showSetup();
}

// ─── NOTES ───────────────────────────────────────────────────────────────────
function renderNotes() {
  const pc = document.getElementById('page-content');

  // Colour palette for note cards
  const CARD_COLORS = [
    { bg:'#e8f5e9', border:'#a5d6a7', icon:'#2d6a4f' },
    { bg:'#e3f2fd', border:'#90caf9', icon:'#1565c0' },
    { bg:'#fff8e1', border:'#ffe082', icon:'#f57f17' },
    { bg:'#f3e5f5', border:'#ce93d8', icon:'#6a1b9a' },
    { bg:'#fce4ec', border:'#f48fb1', icon:'#880e4f' },
    { bg:'#e0f2f1', border:'#80cbc4', icon:'#004d40' },
  ];

  function showList(notes) {
    pc.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem">
        <div>
          <h2 style="font-size:22px">📝 Summarized Notes</h2>
          <p class="text-muted" style="margin-top:.2rem">AI-generated key points, terms & exam tips from your materials</p>
        </div>
        <div style="display:flex;gap:.6rem;align-items:center">
          <span class="text-muted" style="font-size:13px">${notes.length} note${notes.length!==1?'s':''}</span>
        </div>
      </div>

      <!-- Generate bar -->
      <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius-lg);padding:1.2rem 1.5rem;margin-bottom:1.8rem;display:flex;gap:.6rem;align-items:center">
        <span style="font-size:22px">✨</span>
        <input id="notes-topic" style="flex:1;border:1.5px solid var(--border);border-radius:var(--radius);padding:.6rem .9rem;font-size:14px;background:var(--paper);outline:none" 
          placeholder="Enter a topic to generate notes… e.g. Cloud Computing, Photosynthesis"
          onkeydown="if(event.key==='Enter')genNotes()"
          onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'"/>
        <button class="btn btn-accent" id="notes-btn" onclick="genNotes()" style="white-space:nowrap;padding:.6rem 1.2rem">
          ✨ Generate Notes
        </button>
      </div>

      <!-- Notes grid -->
      <div id="notes-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1rem">
        ${notes.length === 0
          ? `<div class="empty-state" style="grid-column:1/-1">
               <div class="es-icon">📝</div>
               <p>No notes yet.<br/>Enter a topic above to generate your first set of notes.</p>
             </div>`
          : notes.map((n, i) => {
              const c = CARD_COLORS[i % CARD_COLORS.length];
              const kpCount  = (n.content.keyPoints||[]).length;
              const termCount= (n.content.importantTerms||[]).length;
              const tipCount = (n.content.examTips||[]).length;
              const summary  = (n.content.summary||'').substring(0, 100);
              return `
              <div class="note-grid-card" data-id="${n.id}" style="background:${c.bg};border:1.5px solid ${c.border};border-radius:var(--radius-lg);padding:1.3rem;cursor:pointer;transition:all .2s;display:flex;flex-direction:column;gap:.7rem;position:relative">
                <!-- Header -->
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem">
                  <div style="width:40px;height:40px;border-radius:10px;background:rgba(255,255,255,.6);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">📝</div>
                  <button class="note-del-btn" onclick="event.stopPropagation();delNote('${n.id}')" 
                    style="background:rgba(255,255,255,.5);border:1px solid rgba(0,0,0,.1);border-radius:8px;padding:.2rem .5rem;font-size:13px;cursor:pointer;opacity:0;transition:opacity .2s">🗑</button>
                </div>

                <!-- Title -->
                <div>
                  <h4 style="font-size:15px;font-weight:700;color:${c.icon};line-height:1.3;margin-bottom:.3rem">${n.content.title||n.topic}</h4>
                  <p style="font-size:12px;color:#555;line-height:1.5">${summary}${summary.length>=100?'…':''}</p>
                </div>

                <!-- Stats row -->
                <div style="display:flex;gap:.4rem;flex-wrap:wrap">
                  ${kpCount  ? `<span style="font-size:11px;padding:.15rem .5rem;background:rgba(255,255,255,.6);border-radius:6px;font-weight:600;color:${c.icon}">🔑 ${kpCount} points</span>` : ''}
                  ${termCount? `<span style="font-size:11px;padding:.15rem .5rem;background:rgba(255,255,255,.6);border-radius:6px;font-weight:600;color:${c.icon}">📖 ${termCount} terms</span>` : ''}
                  ${tipCount ? `<span style="font-size:11px;padding:.15rem .5rem;background:rgba(255,255,255,.6);border-radius:6px;font-weight:600;color:${c.icon}">🎯 ${tipCount} tips</span>` : ''}
                </div>

                <!-- Footer -->
                <div style="display:flex;align-items:center;justify-content:space-between;margin-top:auto;padding-top:.5rem;border-top:1px solid rgba(0,0,0,.08)">
                  <span style="font-size:11px;color:#666">${fmtDate(n.created_at)}</span>
                  <button onclick="event.stopPropagation();openNoteModal(${JSON.stringify(JSON.stringify(n))})"
                    style="background:rgba(255,255,255,.7);border:1px solid rgba(0,0,0,.12);border-radius:8px;padding:.3rem .75rem;font-size:12px;font-weight:600;cursor:pointer;color:${c.icon};transition:all .2s">
                    Open →
                  </button>
                </div>
              </div>`;
            }).join('')}
      </div>

      <!-- Note Viewer Modal -->
      <div id="note-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:500;padding:1rem;overflow-y:auto;backdrop-filter:blur(3px)" onclick="if(event.target===this)closeNoteModal()">
        <div id="note-modal-box" style="background:var(--card);border-radius:var(--radius-lg);max-width:720px;margin:2rem auto;padding:0;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.2)">
          <!-- Modal Header -->
          <div id="note-modal-header" style="padding:1.5rem 1.8rem;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:1rem">
            <div style="display:flex;align-items:center;gap:.8rem">
              <span style="font-size:26px">📝</span>
              <div>
                <h3 id="note-modal-title" style="font-size:19px;font-weight:800"></h3>
                <p id="note-modal-date" class="text-muted" style="font-size:12px;margin-top:.1rem"></p>
              </div>
            </div>
            <button onclick="closeNoteModal()" style="background:var(--paper);border:1px solid var(--border);border-radius:10px;padding:.4rem .9rem;font-size:20px;cursor:pointer;line-height:1">×</button>
          </div>

          <!-- Modal Body -->
          <div id="note-modal-body" style="padding:1.8rem;display:flex;flex-direction:column;gap:1.4rem;max-height:75vh;overflow-y:auto"></div>
        </div>
      </div>`;

    // Hover effect for delete button on cards
    document.querySelectorAll('.note-grid-card').forEach(card => {
      const delBtn = card.querySelector('.note-del-btn');
      card.addEventListener('mouseenter', () => delBtn.style.opacity = '1');
      card.addEventListener('mouseleave', () => delBtn.style.opacity = '0');
      card.addEventListener('click', function() {
        const id = this.dataset.id;
        const note = notes.find(n => n.id === id);
        if (note) openNoteModal(JSON.stringify(note));
      });
    });

    // ── Generate notes ──
    window.genNotes = async () => {
      const t = document.getElementById('notes-topic').value.trim();
      if (!t) { showToast('Enter a topic first.'); return; }
      const btn = document.getElementById('notes-btn');
      btn.innerHTML = '<span style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle;margin-right:.4rem"></span>Generating…';
      btn.disabled = true;
      try {
        await API.generateNotes(t);
        showToast('✅ Notes generated!');
        loadNotes();
      } catch(e) { showToast('❌ ' + e.message); btn.innerHTML = '✨ Generate Notes'; btn.disabled = false; }
    };

    // ── Delete note ──
    window.delNote = async (id) => {
      if (!confirm('Delete this note?')) return;
      try { await API.deleteNote(id); showToast('Note deleted.'); loadNotes(); }
      catch(e) { showToast('❌ ' + e.message); }
    };

    // ── Open note modal ──
    window.openNoteModal = (nStr) => {
      const n = typeof nStr === 'string' ? JSON.parse(nStr) : nStr;
      const c = n.content;

      document.getElementById('note-modal-title').textContent = c.title || n.topic;
      document.getElementById('note-modal-date').textContent = `Generated on ${fmtDate(n.created_at)}`;

      const body = document.getElementById('note-modal-body');
      body.innerHTML = `
        <!-- Summary -->
        ${c.summary ? `
        <div style="background:var(--accent-light);border-left:4px solid var(--accent2);border-radius:0 var(--radius) var(--radius) 0;padding:1rem 1.2rem">
          <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--accent);margin-bottom:.4rem">📌 Overview</div>
          <p style="font-size:14px;line-height:1.75;color:var(--ink)">${c.summary}</p>
        </div>` : ''}

        <!-- Key Points -->
        ${c.keyPoints?.length ? `
        <div>
          <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:.75rem">🔑 Key Points</div>
          <div style="display:flex;flex-direction:column;gap:.5rem">
            ${c.keyPoints.map((p,i) => `
            <div style="display:flex;gap:.75rem;align-items:flex-start;padding:.65rem .9rem;background:var(--paper);border-radius:var(--radius);border:1px solid var(--border)">
              <span style="background:var(--accent);color:#fff;border-radius:6px;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;margin-top:.05rem">${i+1}</span>
              <span style="font-size:14px;line-height:1.6">${p}</span>
            </div>`).join('')}
          </div>
        </div>` : ''}

        <!-- Important Terms -->
        ${c.importantTerms?.length ? `
        <div>
          <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:.75rem">📖 Important Terms</div>
          <div style="display:grid;gap:.45rem">
            ${c.importantTerms.map(t => `
            <div style="display:flex;gap:.75rem;padding:.6rem .9rem;background:var(--paper);border-radius:var(--radius);border:1px solid var(--border);align-items:flex-start">
              <span style="font-weight:700;color:var(--accent);min-width:120px;font-size:13px;padding-top:.05rem">${t.term}</span>
              <span style="color:var(--muted);font-size:13px;line-height:1.5;flex:1">${t.def}</span>
            </div>`).join('')}
          </div>
        </div>` : ''}

        <!-- Exam Tips -->
        ${c.examTips?.length ? `
        <div>
          <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:.75rem">🎯 Exam Tips</div>
          <div style="display:flex;flex-direction:column;gap:.45rem">
            ${c.examTips.map(tip => `
            <div style="display:flex;gap:.75rem;align-items:flex-start;padding:.65rem .9rem;background:#fff8e1;border-radius:var(--radius);border:1px solid #ffe082">
              <span style="font-size:16px;flex-shrink:0">💡</span>
              <span style="font-size:13px;line-height:1.6">${tip}</span>
            </div>`).join('')}
          </div>
        </div>` : ''}

        <!-- Action buttons -->
        <div style="display:flex;gap:.6rem;padding-top:.5rem;border-top:1px solid var(--border)">
          <button onclick="closeNoteModal()" class="btn" style="flex:1">Close</button>
          <button onclick="delNote('${n.id}');closeNoteModal();" class="btn btn-danger">🗑 Delete Note</button>
        </div>`;

      document.getElementById('note-modal').style.display = 'block';
      document.body.style.overflow = 'hidden';
    };

    window.closeNoteModal = () => {
      document.getElementById('note-modal').style.display = 'none';
      document.body.style.overflow = '';
    };
  }

  function loadNotes() {
    pc.innerHTML = '<div class="empty-state" style="margin-top:4rem"><div class="loading-spinner"></div><p style="margin-top:1rem">Loading notes…</p></div>';
    API.getNotes().then(d => showList(d.notes)).catch(() => showList([]));
  }

  loadNotes();
}

// ─── PROGRESS ────────────────────────────────────────────────────────────────
function renderProgress(user) {
  const pc = document.getElementById('page-content');
  pc.innerHTML = '<div class="empty-state"><div class="loading-spinner"></div></div>';
  const COLORS = ['#2d6a4f','#3b82f6','#f59e0b','#7c3aed','#ec4899'];

  API.getProgress().then(d => {
    pc.innerHTML = `
      <h2 style="margin-bottom:1.5rem;font-size:22px">📊 Progress Report</h2>
      <div class="stat-row">
        ${[{v:d.fileCount,l:'📄 Files Uploaded'},{v:d.quizCount,l:'🧪 Quizzes Taken'},{v:d.noteCount,l:'📝 Notes Generated'},{v:d.chatCount,l:'💬 AI Questions'},{v:d.avgScore?d.avgScore+'%':'—',l:'🏆 Avg Score'}]
          .map(s=>`<div class="stat-card"><div class="stat-val">${s.v}</div><div class="stat-label">${s.l}</div></div>`).join('')}
      </div>
      ${d.quizResults.length ? `
        <div class="card-box" style="margin-bottom:1.5rem">
          <h3 style="font-size:16px;margin-bottom:1.2rem">Recent Quiz Performance</h3>
          ${d.quizResults.map((r,i) => {
            const pct = Math.round(r.score/r.total*100);
            return `<div class="prog-bar-wrap">
              <div class="prog-bar-label"><span>${r.topic}</span><span>${r.score}/${r.total} · ${pct}%</span></div>
              <div class="prog-bar"><div class="prog-bar-fill" style="width:${pct}%;background:${COLORS[i%COLORS.length]}"></div></div>
              <div class="text-muted" style="font-size:11px;margin-top:.2rem">${fmtDate(r.taken_at)}</div>
            </div>`;}).join('')}
        </div>` : ''}
      <div class="card-box">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
          <h3 style="font-size:16px">📚 AI Summary of Materials</h3>
          <button class="btn btn-accent" id="sum-btn" onclick="genSummary()">✨ Generate</button>
        </div>
        <div id="summary-out" class="text-muted" style="font-size:13px">Click "Generate" for an AI overview of all uploaded files.</div>
      </div>`;

    window.genSummary = async () => {
      const btn = document.getElementById('sum-btn');
      btn.textContent = '⏳ Summarizing...'; btn.disabled = true;
      try {
        const d = await API.summarize();
        document.getElementById('summary-out').style.cssText = 'font-size:14px;line-height:1.8;white-space:pre-wrap';
        document.getElementById('summary-out').textContent = d.summary;
      } catch(e) { document.getElementById('summary-out').textContent = '❌ ' + e.message; }
      btn.textContent = '✨ Generate'; btn.disabled = false;
    };
  }).catch(() => { pc.innerHTML = '<div class="empty-state"><p>Failed to load progress.</p></div>'; });
}

// ─── ROUTINE ─────────────────────────────────────────────────────────────────
function renderRoutine() {
  const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const SLOTS = ['6–7am','7–8am','8–9am','9–10am','10–11am','11–12pm','12–1pm','2–3pm','3–4pm','4–5pm','5–6pm','7–8pm','8–9pm'];
  let routine = {};
  const pc = document.getElementById('page-content');

  function buildGrid() {
    const filled = Object.keys(routine).length;
    pc.innerHTML = `
      <h2 style="margin-bottom:1rem;font-size:22px">📅 Study Routine</h2>
      <p class="text-muted" style="margin-bottom:1.5rem">Click any slot to add. Click a filled slot to remove.</p>
      <div class="stat-row" style="margin-bottom:1.5rem">
        <div class="stat-card"><div class="stat-val">${filled}</div><div class="stat-label">⏰ Slots Planned</div></div>
        <div class="stat-card"><div class="stat-val">${filled}h</div><div class="stat-label">📚 Hours/Week</div></div>
        <div class="stat-card"><div class="stat-val">${Math.round(filled/(DAYS.length*SLOTS.length)*100)}%</div><div class="stat-label">📊 Filled</div></div>
      </div>
      <div class="routine-wrap">
        <div class="routine-grid">
          <div class="time-col">${SLOTS.map(s=>`<div class="time-label">${s}</div>`).join('')}</div>
          ${DAYS.map(d => `<div class="day-col">
            <div class="day-header">${d}</div>
            ${SLOTS.map(s => {
              const key = `${d}|${s}`;
              const sub = routine[key];
              return `<div class="time-slot ${sub?'filled':''}" onclick="toggleSlot('${d}','${s}')" title="${sub||s}">
                ${sub ? sub.substring(0,8) : '<span style="color:var(--border);font-size:14px">+</span>'}
              </div>`;
            }).join('')}
          </div>`).join('')}
        </div>
      </div>
      <div id="routine-modal" class="modal-overlay hidden">
        <div class="modal">
          <h3>📌 Add Study Session</h3>
          <p class="text-muted" id="modal-slot-label" style="margin-bottom:1rem"></p>
          <div class="form-group"><label>Subject or Topic</label>
            <input id="modal-subject" placeholder="e.g. Mathematics, Physics Chapter 3..." onkeydown="if(event.key==='Enter')confirmSlot()"/></div>
          <div class="chip-row">
            ${['Maths','Physics','Chemistry','Biology','History','English','CS','Economics'].map(s=>`<div class="chip" onclick="document.getElementById('modal-subject').value='${s}'">${s}</div>`).join('')}
          </div>
          <div class="modal-actions">
            <button class="btn" onclick="document.getElementById('routine-modal').classList.add('hidden')">Cancel</button>
            <button class="btn btn-accent" onclick="confirmSlot()">Add Session</button>
          </div>
        </div>
      </div>`;

    let pendingDay, pendingSlot;
    window.toggleSlot = (day, slot) => {
      const key = `${day}|${slot}`;
      if (routine[key]) {
        API.delRoutine(day, slot).then(() => { delete routine[key]; buildGrid(); }).catch(() => {});
      } else {
        pendingDay = day; pendingSlot = slot;
        document.getElementById('modal-slot-label').textContent = `${day} · ${slot}`;
        document.getElementById('modal-subject').value = '';
        document.getElementById('routine-modal').classList.remove('hidden');
        setTimeout(() => document.getElementById('modal-subject').focus(), 100);
      }
    };

    window.confirmSlot = async () => {
      const sub = document.getElementById('modal-subject').value.trim();
      if (!sub) return;
      await API.saveRoutine(pendingDay, pendingSlot, sub).catch(() => {});
      routine[`${pendingDay}|${pendingSlot}`] = sub;
      document.getElementById('routine-modal').classList.add('hidden');
      buildGrid();
      showToast(`✅ Added ${sub} to ${pendingDay} ${pendingSlot}`);
    };
  }

  pc.innerHTML = '<div class="empty-state"><div class="loading-spinner"></div></div>';
  API.getRoutine().then(d => {
    d.sessions.forEach(s => { routine[`${s.day}|${s.slot}`] = s.subject; });
    buildGrid();
  }).catch(() => buildGrid());
}

// ─── FIND ────────────────────────────────────────────────────────────────────
function renderFind(user) {
  const pc = document.getElementById('page-content');
  const BG = ['#e8f5e9','#e3f2fd','#fff3e0','#f3e5f5','#fce4ec','#e0f2f1'];
  const FG = ['#2d6a4f','#1565c0','#e65100','#6a1b9a','#880e4f','#00695c'];
  let people = [], connected = new Set(), filter = 'All';

  pc.innerHTML = '<div class="empty-state"><div class="loading-spinner"></div></div>';

  API.getOrgUsers().then(d => {
    people = d.users;
    render();
  }).catch(() => { people = []; render(); });

  function render() {
    const search = document.getElementById('find-search')?.value.toLowerCase() || '';
    const filtered = people.filter(p =>
      (filter === 'All' || p.role === filter) &&
      p.name.toLowerCase().includes(search));

    pc.innerHTML = `
      <h2 style="margin-bottom:1.5rem;font-size:22px">🔍 Find Mentors & Friends</h2>
      <p class="text-muted" style="margin-bottom:1rem">Everyone from <strong>${user.org}</strong></p>
      <div class="search-bar"><span>🔍</span><input id="find-search" placeholder="Search by name..." oninput="renderFindList()" value="${search}"/></div>
      <div class="chip-row">
        ${['All','mentor','student'].map(f=>`<div class="chip ${filter===f?'active':''}" onclick="setFindFilter('${f}')">${f==='mentor'?'👨‍🏫 Mentors':f==='student'?'🎓 Students':'All'}</div>`).join('')}
      </div>
      <div id="find-list">
        ${filtered.length === 0 ? `<div class="empty-state"><div class="es-icon">${people.length===0?'🏫':'🔍'}</div><p>${people.length===0?'No other users from your org yet.':'No results found.'}</p></div>` :
          filtered.map((p,i) => `
            <div class="person-card">
              <div class="person-avatar" style="background:${BG[i%BG.length]};color:${FG[i%FG.length]}">${p.name[0].toUpperCase()}</div>
              <div class="person-info">
                <h4>${p.name}<span class="role-tag ${p.role==='mentor'?'role-mentor':'role-student'}">${p.role==='mentor'?'👨‍🏫 Mentor':'🎓 Student'}</span></h4>
                <p>${p.org}</p>
              </div>
              <button class="btn ${connected.has(p.id)?'':'btn-accent'}" onclick="connectPerson('${p.id}')" ${connected.has(p.id)?'disabled':''}>
                ${connected.has(p.id)?'✓ Requested':p.role==='mentor'?'📩 Request Mentor':'🤝 Add Friend'}
              </button>
            </div>`).join('')}
      </div>`;
  }

  window.renderFindList = render;
  window.setFindFilter = (f) => { filter = f; render(); };
  window.connectPerson = (id) => { connected.add(id); showToast('✅ Request sent!'); render(); };
}

// ─── QUESTIONS ───────────────────────────────────────────────────────────────
function renderQuestions() {
  const pc = document.getElementById('page-content');
  const diffClass = d => d==='easy'?'diff-easy':d==='medium'?'diff-medium':'diff-hard';
  const diffIcon  = d => d==='easy'?'🟢':d==='medium'?'🟡':'🔴';

  // ── List view ──────────────────────────────────────────────────────────────
  function showList(history) {
    pc.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem">
        <div>
          <h2 style="font-size:22px">❓ Generate Questions</h2>
          <p class="text-muted" style="margin-top:.2rem">Write answers, get AI feedback, and check model answers</p>
        </div>
      </div>

      <!-- Generate bar -->
      <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius-lg);padding:1.2rem 1.5rem;margin-bottom:1.8rem">
        <h3 style="font-size:15px;margin-bottom:.9rem">Generate New Questions</h3>
        <div style="display:flex;gap:.6rem;flex-wrap:wrap">
          <input id="q-topic" style="flex:1;min-width:200px;border:1.5px solid var(--border);border-radius:var(--radius);padding:.6rem .9rem;font-size:14px;background:var(--paper);outline:none"
            placeholder="Enter topic… e.g. Cloud Computing, Cell Biology"
            onkeydown="if(event.key==='Enter')genQs()"
            onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'"/>
          <button class="btn btn-accent" id="q-btn" onclick="genQs()" style="white-space:nowrap">❓ Generate</button>
        </div>
        <p class="text-muted" style="margin-top:.5rem;font-size:12px">Generates 10 questions: short answer, long answer & application-type</p>
      </div>

      <!-- History list -->
      ${history.length === 0
        ? `<div class="empty-state"><div class="es-icon">❓</div><p>No questions yet.<br/>Enter a topic above to generate your first set.</p></div>`
        : `<div class="section-title">Previously Generated (${history.length})</div>
           <div style="display:flex;flex-direction:column;gap:.6rem">
             ${history.map((h,i) => {
               const easy   = h.questions.filter(q=>q.difficulty==='easy').length;
               const medium = h.questions.filter(q=>q.difficulty==='medium').length;
               const hard   = h.questions.filter(q=>q.difficulty==='hard').length;
               return `
               <div onclick="openQsSession(${JSON.stringify(JSON.stringify(h))})"
                 style="background:var(--card);border:1.5px solid var(--border);border-radius:var(--radius-lg);padding:1rem 1.3rem;display:flex;align-items:center;gap:1rem;cursor:pointer;transition:all .2s"
                 onmouseover="this.style.borderColor='var(--accent2)';this.style.boxShadow='0 2px 12px rgba(0,0,0,.06)'"
                 onmouseout="this.style.borderColor='var(--border)';this.style.boxShadow='none'">
                 <div style="width:46px;height:46px;background:var(--accent-light);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">❓</div>
                 <div style="flex:1">
                   <div style="font-weight:700;font-size:15px;margin-bottom:.3rem">${h.topic}</div>
                   <div style="display:flex;gap:.4rem;flex-wrap:wrap">
                     <span class="text-muted" style="font-size:12px">${h.questions.length} questions · ${fmtDate(h.created_at)}</span>
                     ${easy   ? `<span class="q-badge diff-easy"  >🟢 ${easy} easy</span>`   : ''}
                     ${medium ? `<span class="q-badge diff-medium">🟡 ${medium} medium</span>`: ''}
                     ${hard   ? `<span class="q-badge diff-hard"  >🔴 ${hard} hard</span>`   : ''}
                   </div>
                 </div>
                 <div style="display:flex;align-items:center;gap:.5rem">
                   <span style="font-size:12px;color:var(--accent);font-weight:600;background:var(--accent-light);padding:.2rem .6rem;border-radius:6px">Open →</span>
                 </div>
               </div>`;
             }).join('')}
           </div>`}`;

    // ── Generate ──
    window.genQs = async () => {
      const t = document.getElementById('q-topic').value.trim();
      if (!t) { showToast('Enter a topic first.'); return; }
      const btn = document.getElementById('q-btn');
      btn.innerHTML = '⏳ Generating…'; btn.disabled = true;
      try {
        const d = await API.generateQs(t);
        showToast(`✅ ${d.questions.length} questions generated!`);
        loadQs();
      } catch(e) { showToast('❌ ' + e.message); }
      btn.innerHTML = '❓ Generate'; btn.disabled = false;
    };

    // ── Open a session ──
    window.openQsSession = (str) => {
      const h = JSON.parse(str);
      showSession(h);
    };
  }

  // ── Session view — write answers, check, get AI feedback ──────────────────
  function showSession(h) {
    // State: per-question answers + feedback
    const state = h.questions.map(() => ({ answer: '', checked: false, feedback: '', modelAnswer: '', expanded: true }));

    function renderSession() {
      pc.innerHTML = `
        <!-- Header -->
        <div style="display:flex;align-items:center;gap:.8rem;margin-bottom:.5rem;flex-wrap:wrap">
          <button class="btn" onclick="loadQs()">← Back</button>
          <div>
            <h2 style="font-size:20px">❓ ${h.topic}</h2>
            <p class="text-muted" style="font-size:13px">${h.questions.length} questions · ${fmtDate(h.created_at)}</p>
          </div>
        </div>

        <!-- Progress bar -->
        <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:.75rem 1.2rem;margin-bottom:1.5rem;display:flex;align-items:center;gap:1rem">
          <span style="font-size:13px;font-weight:600;white-space:nowrap">Progress:</span>
          <div style="flex:1;height:8px;background:var(--border);border-radius:4px;overflow:hidden">
            <div id="qs-prog-bar" style="height:100%;background:var(--accent2);border-radius:4px;transition:width .4s;width:${Math.round(state.filter(s=>s.checked).length/h.questions.length*100)}%"></div>
          </div>
          <span id="qs-prog-txt" style="font-size:13px;color:var(--accent);font-weight:600;white-space:nowrap">${state.filter(s=>s.checked).length}/${h.questions.length} checked</span>
        </div>

        <!-- Questions -->
        <div id="qs-list" style="display:flex;flex-direction:column;gap:1rem"></div>

        <!-- Check all button -->
        <div style="margin-top:1.5rem;display:flex;gap:.6rem;justify-content:flex-end">
          <button class="btn" onclick="loadQs()">← Back to list</button>
          <button class="btn btn-accent" onclick="checkAllAnswers()">✅ Check All Unanswered</button>
        </div>`;

      renderQsList();
    }

    function updateProgress() {
      const done = state.filter(s => s.checked).length;
      const pct  = Math.round(done / h.questions.length * 100);
      const bar  = document.getElementById('qs-prog-bar');
      const txt  = document.getElementById('qs-prog-txt');
      if (bar) bar.style.width = pct + '%';
      if (txt) txt.textContent = `${done}/${h.questions.length} checked`;
    }

    function renderQsList() {
      const list = document.getElementById('qs-list');
      if (!list) return;
      list.innerHTML = h.questions.map((q, i) => {
        const s = state[i];
        const isChecked = s.checked;
        return `
        <div style="background:var(--card);border:1.5px solid ${isChecked ? 'var(--accent2)' : 'var(--border)'};border-radius:var(--radius-lg);overflow:hidden;transition:border .3s">

          <!-- Question header (clickable to collapse) -->
          <div onclick="toggleQ(${i})" style="padding:1rem 1.2rem;display:flex;align-items:flex-start;gap:.8rem;cursor:pointer;background:${isChecked?'rgba(82,183,136,.04)':'var(--card)'}">
            <div style="width:28px;height:28px;border-radius:8px;background:${isChecked?'var(--accent2)':'var(--accent-light)'};color:${isChecked?'#fff':'var(--accent)'};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">${isChecked?'✓':i+1}</div>
            <div style="flex:1">
              <div style="font-size:14px;font-weight:600;line-height:1.5">${q.question}</div>
              <div style="display:flex;gap:.4rem;margin-top:.35rem;flex-wrap:wrap">
                ${q.difficulty ? `<span class="q-badge ${diffClass(q.difficulty)}">${diffIcon(q.difficulty)} ${q.difficulty}</span>` : ''}
                ${q.type       ? `<span class="q-badge type-badge">${q.type.replace('_',' ')}</span>` : ''}
                ${isChecked    ? `<span style="font-size:11px;padding:.1rem .45rem;border-radius:6px;background:rgba(82,183,136,.15);color:#1e4d38;font-weight:600">✅ Answered</span>` : ''}
              </div>
            </div>
            <span style="color:var(--muted);font-size:18px;flex-shrink:0">${s.expanded ? '▲' : '▼'}</span>
          </div>

          <!-- Expandable body -->
          ${s.expanded ? `
          <div style="padding:0 1.2rem 1.2rem;border-top:1px solid var(--border)">

            <!-- Answer textarea -->
            <div style="margin-top:1rem">
              <label style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);display:block;margin-bottom:.4rem">✏️ Your Answer</label>
              <textarea id="ans-${i}" rows="4"
                style="width:100%;padding:.75rem 1rem;border:1.5px solid var(--border);border-radius:var(--radius);font-size:14px;background:var(--paper);outline:none;resize:vertical;line-height:1.6;transition:border .2s"
                onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'"
                placeholder="Type your answer here…"
                ${isChecked ? '' : ''}
              >${s.answer}</textarea>
            </div>

            <!-- Action buttons -->
            <div style="display:flex;gap:.5rem;margin-top:.75rem;flex-wrap:wrap">
              <button onclick="checkAnswer(${i})" class="btn btn-accent" ${isChecked?'style="opacity:.6"':''}>
                ${isChecked ? '🔄 Re-check' : '✅ Check Answer'}
              </button>
              <button onclick="getModelAnswer(${i})" class="btn">
                💡 ${s.modelAnswer ? 'Show Model Answer' : 'Get Model Answer'}
              </button>
              ${isChecked ? `<button onclick="resetAnswer(${i})" class="btn">↩ Reset</button>` : ''}
            </div>

            <!-- AI Feedback box -->
            ${s.feedback ? `
            <div style="margin-top:1rem;padding:1rem 1.2rem;background:${s.feedback.startsWith('❌')?'#fef2f2':'rgba(45,106,79,.05)'};border:1px solid ${s.feedback.startsWith('❌')?'#fecaca':'var(--accent2)'};border-radius:var(--radius);border-left:4px solid ${s.feedback.startsWith('❌')?'var(--danger)':'var(--accent2)'}">
              <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:.4rem">🤖 AI Feedback</div>
              <div style="font-size:14px;line-height:1.7;white-space:pre-wrap">${s.feedback}</div>
            </div>` : ''}

            <!-- Model Answer box -->
            ${s.modelAnswer ? `
            <div style="margin-top:.75rem;padding:1rem 1.2rem;background:#fff8e1;border:1px solid #ffe082;border-radius:var(--radius);border-left:4px solid #f59e0b">
              <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#92400e;margin-bottom:.4rem">💡 Model Answer</div>
              <div style="font-size:14px;line-height:1.7;white-space:pre-wrap;color:var(--ink)">${s.modelAnswer}</div>
            </div>` : ''}

            <!-- Loading indicator -->
            <div id="loading-${i}" style="display:none;margin-top:.75rem;padding:.75rem 1rem;background:var(--paper);border-radius:var(--radius);font-size:13px;color:var(--muted);display:none;align-items:center;gap:.5rem">
              <div class="loading-spinner" style="width:16px;height:16px;border-width:2px"></div>
              <span>AI is thinking…</span>
            </div>

          </div>` : ''}
        </div>`;
      }).join('');

      // Wire up functions
      window.toggleQ = (i) => {
        state[i].expanded = !state[i].expanded;
        renderQsList();
      };

      window.checkAnswer = async (i) => {
        const ta = document.getElementById(`ans-${i}`);
        const answer = ta ? ta.value.trim() : state[i].answer;
        if (!answer) { showToast('Write your answer first.'); return; }
        state[i].answer = answer;

        // Show loading
        showQLoading(i, true);
        try {
          const res = await API.chat(
            `Question: "${h.questions[i].question}"\n\nStudent's Answer: "${answer}"\n\nPlease evaluate this answer. Be encouraging but honest. Point out what's correct, what's missing or wrong, and give a score out of 10. Keep it under 150 words.`
          );
          state[i].feedback = res.reply;
          state[i].checked  = true;
          updateProgress();
        } catch(e) {
          state[i].feedback = '❌ Could not get feedback: ' + e.message;
        }
        showQLoading(i, false);
        renderQsList();
      };

      window.getModelAnswer = async (i) => {
        if (state[i].modelAnswer) {
          // toggle visibility — just re-render
          renderQsList();
          return;
        }
        showQLoading(i, true);
        try {
          const res = await API.chat(
            `Please provide a comprehensive model answer for this question:\n\n"${h.questions[i].question}"\n\nTopic: ${h.topic}\n\nProvide a clear, well-structured answer that a student can learn from. Use bullet points where appropriate.`
          );
          state[i].modelAnswer = res.reply;
        } catch(e) {
          state[i].modelAnswer = '❌ Could not get model answer: ' + e.message;
        }
        showQLoading(i, false);
        renderQsList();
      };

      window.resetAnswer = (i) => {
        state[i].answer = '';
        state[i].checked = false;
        state[i].feedback = '';
        state[i].modelAnswer = '';
        state[i].expanded = true;
        updateProgress();
        renderQsList();
      };

      window.checkAllAnswers = async () => {
        const unanswered = state.map((s,i) => i).filter(i => !state[i].checked);
        if (!unanswered.length) { showToast('All questions already checked!'); return; }
        showToast(`Checking ${unanswered.length} answer(s)…`);
        for (const i of unanswered) {
          const ta = document.getElementById(`ans-${i}`);
          const answer = ta ? ta.value.trim() : '';
          if (!answer) continue;
          state[i].answer = answer;
          try {
            const res = await API.chat(
              `Question: "${h.questions[i].question}"\n\nStudent's Answer: "${answer}"\n\nEvaluate briefly (under 100 words), score out of 10.`
            );
            state[i].feedback = res.reply;
            state[i].checked  = true;
          } catch(e) {}
        }
        updateProgress();
        renderQsList();
      };
    }

    function showQLoading(i, show) {
      const el = document.getElementById(`loading-${i}`);
      if (el) el.style.display = show ? 'flex' : 'none';
    }

    renderSession();
  }

  // ── Load from API ──────────────────────────────────────────────────────────
  function loadQs() {
    pc.innerHTML = '<div class="empty-state" style="margin-top:4rem"><div class="loading-spinner"></div><p style="margin-top:1rem">Loading questions…</p></div>';
    API.getQs().then(d => showList(d.questions)).catch(() => showList([]));
  }

  loadQs();
}

// ─── ABOUT ───────────────────────────────────────────────────────────────────
function renderAbout() {
  document.getElementById('page-content').innerHTML = `
    <h2 style="margin-bottom:1.5rem;font-size:22px">ℹ️ About StudyBuddy</h2>
    <div class="card-box" style="max-width:640px">
      <div class="logo" style="margin-bottom:1.2rem"><div class="logo-icon">S</div><div class="logo-text">Study<span>Buddy</span></div></div>
      <p style="line-height:1.8;color:var(--muted);margin-bottom:1.5rem">
        StudyBuddy is an AI-powered academic platform built with Python (Flask) + HTML/CSS/JS + SQLite.
        Our AI works <strong>exclusively on your uploaded materials</strong> — ensuring personalized, relevant answers scoped to your university.
      </p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin-bottom:1.5rem">
        ${['🐍 Python Flask backend','🗄️ SQLite database','📄 Real PDF & DOCX parsing','🔐 JWT authentication','🤖 Claude AI (Anthropic)','🏫 University-scoped access','📊 Progress tracking','📅 Study routine planner']
          .map(f=>`<div style="display:flex;align-items:center;gap:.5rem;padding:.6rem .8rem;background:var(--paper);border-radius:var(--radius);font-size:13px">${f}</div>`).join('')}
      </div>
      <p class="text-muted">Version 1.0.0 · Built for students everywhere 🌍</p>
    </div>`;
}

// ─── HELP ────────────────────────────────────────────────────────────────────
function renderHelp() {
  const FAQS = [
    {q:'How do I upload study materials?', a:'Go to "Upload Material" in the sidebar. Drag & drop or click to browse. Supports PDF, DOCX, TXT, Markdown up to 20MB.'},
    {q:'How does the AI bot work?', a:'The AI reads your uploaded files and only answers based on that content — not from the internet.'},
    {q:"Can I access my mentor's materials?", a:'Yes! Mentors mark files as "shared" when uploading. All students from the same university see those files.'},
    {q:'How is my progress tracked?', a:'StudyBuddy tracks quiz results, notes generated, files uploaded, and AI conversations automatically.'},
    {q:'What file types are supported?', a:'PDF, DOCX, TXT, and Markdown (.md) are fully supported and parsed for AI features.'},
    {q:'Is my data secure?', a:'Yes. Passwords are hashed with bcrypt and all requests require a signed JWT token.'},
  ];

  document.getElementById('page-content').innerHTML = `
    <h2 style="margin-bottom:1.5rem;font-size:22px">🆘 Help & Support</h2>
    <div style="max-width:640px">
      <h3 style="font-size:16px;margin-bottom:1rem">Frequently Asked Questions</h3>
      ${FAQS.map((f,i)=>`<div class="faq-item">
        <div class="faq-q" onclick="toggleFaq(${i})">
          ${f.q}<span style="color:var(--muted);font-weight:400;font-size:18px" id="faq-icon-${i}">▼</span>
        </div>
        <div class="faq-a" id="faq-a-${i}">${f.a}</div>
      </div>`).join('')}
      <div class="card-box" style="margin-top:1.5rem">
        <h3 style="font-size:16px;margin-bottom:.5rem">📬 Contact Support</h3>
        <p class="text-muted" style="margin-bottom:1rem">Still stuck? Send us a message.</p>
        <textarea id="help-msg" rows="4" placeholder="Describe your issue..."></textarea>
        <button class="btn btn-accent" style="margin-top:.75rem" onclick="sendHelp()">Send Message</button>
      </div>
    </div>`;

  window.toggleFaq = (i) => {
    const a = document.getElementById(`faq-a-${i}`);
    const ico = document.getElementById(`faq-icon-${i}`);
    a.classList.toggle('open');
    ico.textContent = a.classList.contains('open') ? '▲' : '▼';
  };

  window.sendHelp = () => {
    const msg = document.getElementById('help-msg').value.trim();
    if (msg) { showToast('✅ Message sent! We\'ll get back to you.'); document.getElementById('help-msg').value = ''; }
  };
}
