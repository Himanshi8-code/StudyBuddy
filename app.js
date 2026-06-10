// app.js — Entry point
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('sb_token');
  const user  = localStorage.getItem('sb_user');

  if (token && user) {
    try {
      renderDashboard(JSON.parse(user));
    } catch {
      renderLogin();
    }
  } else {
    renderSignup();
  }
});
