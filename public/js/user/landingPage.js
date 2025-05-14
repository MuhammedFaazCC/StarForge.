document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.querySelector('.navbar .fa-bars');
  const sidebar = document.querySelector('.sidebar');

  if (!hamburger || !sidebar) {
    console.error('Hamburger menu or sidebar not found in the DOM');
    return;
  }

  hamburger.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    const isOpen = sidebar.classList.contains('open');
    sidebar.setAttribute('aria-hidden', !isOpen);
  });
});