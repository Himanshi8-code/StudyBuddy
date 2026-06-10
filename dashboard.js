// dashboard.js — Layout, sidebar, toast
function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.getElementById('toast-container').appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function fmtSize(b) { return b > 1048576 ? (b/1048576).toFixed(1)+' MB' : (b/1024).toFixed(0)+' KB'; }
function fmtDate(ts) { return new Date(ts * 1000).toLocaleDateString(); }

function renderDashboard(user) {
  const NAV_MAIN = [
    { v:'home',      icon:'🏠', label:'Dashboard' },
    { v:'upload',    icon:'📤', label:'Upload Material' },
    { v:'chat',      icon:'🤖', label:'AI Study Bot' },
    { v:'quiz',      icon:'🧪', label:'Personalized Quiz' },
    { v:'notes',     icon:'📝', label:'Summarized Notes' },
    { v:'progress',  icon:'📊', label:'Progress Report' },
    { v:'routine',   icon:'📅', label:'Study Routine' },
    { v:'find',      icon:'🔍', label:'Find Mentors / Friends' },
    { v:'questions', icon:'❓', label:'Generate Questions' },
  ];
  const NAV_OTHER = [
    { v:'about', icon:'ℹ️', label:'About' },
    { v:'help',  icon:'🆘', label:'Help & Support' },
  ];

  let currentView = 'home';

  function navItem(it) {
    return `<div class="nav-item ${currentView===it.v?'active':''}" id="nav-${it.v}" onclick="switchView('${it.v}')">
      <span class="ni">${it.icon}</span>${it.label}
    </div>`;
  }

  function buildSidebar() {
    return `<div class="sidebar">
      <div class="logo" style="margin-bottom:1.5rem;padding:0 .4rem">
        <div class="logo-icon">S</div><div class="logo-text">Study<span>Buddy</span></div>
      </div>
      <div class="user-pill">
        <div class="avatar">${user.name[0].toUpperCase()}</div>
        <div><div class="user-pill-name">${user.name}</div>
        <div class="user-pill-role">${user.role} · ${user.org}</div></div>
      </div>
      <div class="sidebar-section">Main</div>
      ${NAV_MAIN.map(navItem).join('')}
      <div class="sidebar-bottom">
        <div class="sidebar-section">Other</div>
        ${NAV_OTHER.map(navItem).join('')}
        <div class="nav-item" style="color:var(--danger)" onclick="doLogout()">
          <span class="ni">🚪</span>Logout
        </div>
      </div>
    </div>`;
  }

  function render() {
    document.getElementById('app').innerHTML = `
      <div class="app-layout">
        ${buildSidebar()}
        <main class="main-content" id="page-content"></main>
      </div>`;
    loadPage(currentView);
  }

  window.switchView = (v) => {
    currentView = v;
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const el = document.getElementById('nav-' + v);
    if (el) el.classList.add('active');
    loadPage(v);
  };

  window.doLogout = () => {
    localStorage.removeItem('sb_token');
    localStorage.removeItem('sb_user');
    renderLogin();
  };

  window.loadPage = (v) => {
    const pc = document.getElementById('page-content');
    if (!pc) return;
    const pages = {
      home:      () => renderHome(user, window.switchView),
      upload:    () => renderUpload(),
      chat:      () => renderChat(user),
      quiz:      () => renderQuiz(),
      notes:     () => renderNotes(),
      progress:  () => renderProgress(user),
      routine:   () => renderRoutine(),
      find:      () => renderFind(user),
      questions: () => renderQuestions(),
      about:     () => renderAbout(),
      help:      () => renderHelp(),
    };
    (pages[v] || pages.home)();
  };

  render();
}

function renderHome(user, setView) {
  const actions = [
    { icon:'📤', label:'Upload Material',    sub:'PDF, DOCX, notes, papers',        color:'#e8f5e9', v:'upload' },
    { icon:'🤖', label:'AI Study Bot',       sub:'Chat from your materials',         color:'#e3f2fd', v:'chat' },
    { icon:'🧪', label:'Take a Quiz',        sub:'Personalized from your files',     color:'#f3e5f5', v:'quiz' },
    { icon:'📝', label:'Generate Notes',     sub:'Key points & exam tips',           color:'#fff8e1', v:'notes' },
    { icon:'📅', label:'Study Routine',      sub:'Plan your week smartly',           color:'#e0f7fa', v:'routine' },
    { icon:'📊', label:'Progress Report',    sub:'Track what you\'ve learned',       color:'#fce4ec', v:'progress' },
    { icon:'🔍', label:'Find Mentors',       sub:'Connect within your university',   color:'#e8eaf6', v:'find' },
    { icon:'❓', label:'Generate Questions', sub:'Exam prep question bank',          color:'#fff3e0', v:'questions' },
  ];

  document.getElementById('page-content').innerHTML = `
    <div class="topbar">
      <div>
        <h1>Good day, ${user.name.split(' ')[0]} 👋</h1>
        <div class="topbar-sub">${user.role === 'mentor' ? '👨‍🏫 Mentor' : '🎓 Student'} · ${user.org}</div>
      </div>
      <div class="user-chip">
        <div class="avatar" style="width:30px;height:30px;font-size:12px">${user.name[0].toUpperCase()}</div>
        ${user.name.split(' ')[0]}
      </div>
    </div>
    <div class="stat-row" id="home-stats">
      <div class="stat-card"><div class="stat-val">—</div><div class="stat-label">📄 Files Uploaded</div></div>
      <div class="stat-card"><div class="stat-val">—</div><div class="stat-label">🧪 Quizzes Taken</div></div>
      <div class="stat-card"><div class="stat-val">—</div><div class="stat-label">📝 Notes Generated</div></div>
      <div class="stat-card"><div class="stat-val">—</div><div class="stat-label">🏆 Avg Quiz Score</div></div>
    </div>
    <div class="section-title">What do you want to do today?</div>
    <div class="card-grid">
      ${actions.map(a => `
        <div class="action-card" onclick="switchView('${a.v}')">
          <div class="ac-icon" style="background:${a.color}">${a.icon}</div>
          <h4>${a.label}</h4>
          <p>${a.sub}</p>
        </div>`).join('')}
    </div>`;

  API.getProgress().then(d => {
    const stats = document.querySelectorAll('#home-stats .stat-val');
    if (stats[0]) stats[0].textContent = d.fileCount;
    if (stats[1]) stats[1].textContent = d.quizCount;
    if (stats[2]) stats[2].textContent = d.noteCount;
    if (stats[3]) stats[3].textContent = d.avgScore ? d.avgScore + '%' : '—';
  }).catch(() => {});
}
