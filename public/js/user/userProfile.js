// const multer = require('multer');
// const path = require('path');


// function toggleSidebar() {
//   const sidebar = document.getElementById('sidebar');
//   sidebar.classList.toggle('open');
// }

document.addEventListener('click', function(event) {
  const sidebar = document.getElementById('sidebar');
  const menuBtn = document.querySelector('.mobile-menu-btn');
  
  if (
    window.innerWidth <= 1024 &&
    !sidebar.contains(event.target) &&
    !menuBtn.contains(event.target) &&
    sidebar.classList.contains('open')
  ) {
    sidebar.classList.remove('open');
  }
});

window.addEventListener('resize', function() {
  const sidebar = document.getElementById('sidebar');
  const menuBtn = document.querySelector('.mobile-menu-btn');
  
  if (window.innerWidth > 1024) {
    sidebar.classList.remove('open');
    menuBtn.style.display = 'none';
  } else {
    menuBtn.style.display = 'block';
  }
});

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

function closeModal() {
  const modal = document.getElementById('editProfileModal');
  modal.classList.remove('show');
  modal.classList.add('hidden');
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.style.visibility = 'visible';
  toast.style.opacity = '1';

  setTimeout(() => {
    toast.style.visibility = 'hidden';
    toast.style.opacity = '0';
  }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
  const editBtn = document.querySelector('.edit-profile-btn');
  console.log('Edit button found:', editBtn);
  editBtn.addEventListener('click', () => {
    console.log('Edit button clicked');
    const modal = document.getElementById('editProfileModal');
    modal.classList.remove('hidden');
    modal.classList.add('show');
  });

  const urlParams = new URLSearchParams(window.location.search);
  const msg = urlParams.get('msg');
  if (msg) {
    showToast(msg);
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  const modal = document.getElementById('editProfileModal');
modal.addEventListener('click', (e) => {
  if (e.target === modal) {
    closeModal();
  }
});

});