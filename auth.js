// auth.js — Signup and Login page renderers
function renderSignup() {
  let role = 'student';
  document.getElementById('app').innerHTML = `
    <div class="auth-wrap">
      <div class="auth-card">
        <div class="logo"><div class="logo-icon">S</div><div class="logo-text">Study<span>Buddy</span></div></div>
        <h2 class="auth-title">Create your account</h2>
        <p class="auth-sub">Join your academic community on StudyBuddy</p>
        <div class="role-pick">
          <div class="role-btn active" id="role-student" onclick="selectRole('student')">
            <span class="role-icon">🎓</span>Student
          </div>
          <div class="role-btn" id="role-mentor" onclick="selectRole('mentor')">
            <span class="role-icon">👨‍🏫</span>Mentor
          </div>
        </div>
        <div class="form-group"><label>Full Name</label><input id="s-name" type="text" placeholder="Your full name"/></div>
        <div class="form-group"><label>Email Address</label><input id="s-email" type="email" placeholder="you@example.com"/></div>
        <div class="form-group"><label>University / Organization</label><input id="s-org" type="text" placeholder="e.g. Delhi University"/></div>
        <div class="form-group"><label>Password</label><input id="s-pass" type="password" placeholder="Min 6 characters"/></div>
        <div id="s-err" class="error-msg hidden"></div>
        <button class="btn-primary" id="s-btn" onclick="doSignup()">Create Account</button>
        <div class="auth-link">Already have an account? <a onclick="renderLogin()">Sign in</a></div>
      </div>
    </div>`;

  window.selectRole = (r) => {
    role = r;
    document.getElementById('role-student').classList.toggle('active', r === 'student');
    document.getElementById('role-mentor').classList.toggle('active', r === 'mentor');
  };

  window.doSignup = async () => {
    const name = document.getElementById('s-name').value.trim();
    const email = document.getElementById('s-email').value.trim();
    const org = document.getElementById('s-org').value.trim();
    const password = document.getElementById('s-pass').value;
    const errEl = document.getElementById('s-err');
    const btn = document.getElementById('s-btn');
    const res = await API.login({ email, password });
    console.log("LOGIN RESPONSE:", res);

    if (!name || !email || !org || !password) {
      errEl.textContent = 'All fields are required.';
      errEl.classList.remove('hidden');
      return;
    }
    btn.textContent = 'Creating account...';
    btn.disabled = true;
    errEl.classList.add('hidden');
    try {
      await API.signup({ name, email, password, role, org });
      showToast('Account created! Please log in.');
      renderLogin();
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('hidden');
      btn.textContent = 'Create Account';
      btn.disabled = false;
    }
  };
}

function renderLogin() {
  document.getElementById('app').innerHTML = `
    <div class="auth-wrap">
      <div class="auth-card">
        <div class="logo"><div class="logo-icon">S</div><div class="logo-text">Study<span>Buddy</span></div></div>
        <h2 class="auth-title">Welcome back</h2>
        <p class="auth-sub">Log in to your StudyBuddy account</p>
        <div class="form-group"><label>Email Address</label><input id="l-email" type="email" placeholder="you@example.com"/></div>
        <div class="form-group"><label>Password</label><input id="l-pass" type="password" placeholder="Your password" onkeydown="if(event.key==='Enter')doLogin()"/></div>
        <div id="l-err" class="error-msg hidden"></div>
        <button class="btn-primary" id="l-btn" onclick="doLogin()">Sign In</button>
        <div class="auth-link">Don't have an account? <a onclick="renderSignup()">Sign up</a></div>
      </div>
    </div>`;

  window.doLogin = async () => {
    const email = document.getElementById('l-email').value.trim();
    const password = document.getElementById('l-pass').value;
    const errEl = document.getElementById('l-err');
    const btn = document.getElementById('l-btn');
    btn.textContent = 'Signing in...'; btn.disabled = true;
    errEl.classList.add('hidden');
    try {
      const res = await API.login({ email, password });
      console.log("LOGIN RESPONSE:", res);
      localStorage.setItem('sb_token', res.token);
      localStorage.setItem('sb_user', JSON.stringify(res.user));
      renderDashboard(res.user);
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('hidden');
      btn.textContent = 'Sign In'; btn.disabled = false;
    }
  };
}
