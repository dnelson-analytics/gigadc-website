// Mobile menu
const toggle = document.querySelector('.nav-toggle');
const nav = document.getElementById('nav');
toggle.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(open));
});
nav.addEventListener('click', (e) => {
  if (e.target.tagName === 'A') {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }
});

// Demo form: front-end validation only. Nothing is sent anywhere.
const form = document.querySelector('.demo-form');
const status = form.querySelector('.form-status');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = form.elements.name;
  const email = form.elements.email;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value);
  name.setAttribute('aria-invalid', String(!name.value.trim()));
  email.setAttribute('aria-invalid', String(!emailOk));
  if (!name.value.trim() || !emailOk) {
    status.textContent = 'Please enter your name and a valid work email.';
    return;
  }
  status.textContent = 'Thanks. This is a demo site, so nothing was sent.';
  form.reset();
});
