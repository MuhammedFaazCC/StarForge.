function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('open');
}

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
  editBtn.addEventListener('click', () => {
    const modal = document.getElementById('editProfileModal');
    modal.classList.remove('hidden');
    modal.classList.add('show');
  });

  const editForm = document.getElementById('editProfileForm');
  if (editForm) {
    // editForm.addEventListener('submit', async (e) => {
    //   e.preventDefault();

    //   const formData = new FormData(editForm);
    //   const payload = {
    //     fullName: formData.get('fullName'),
    //     email: formData.get('email'),
    //     mobile: formData.get('mobile')
    //   };

    //   try {
    //     const res = await fetch('/profile/request-otp', {
    //       method: 'POST',
    //       headers: { 'Content-Type': 'application/json' },
    //       body: JSON.stringify(payload)
    //     });

    //     const data = await res.json();

    //     if (data.success) {
    //       closeModal();
    //       document.querySelector('.profile-details .detail-group:nth-child(1) .detail-value').textContent = payload.fullName;
    //       document.querySelector('.profile-details .detail-group:nth-child(2) .detail-value').textContent = payload.email;
    //       document.querySelector('.profile-details .detail-group:nth-child(3) .detail-value').textContent = payload.mobile;

    //       showToast('Profile updated successfully!');
    //     } else {
    //       showToast(data.message || 'Failed to save changes.');
    //     }
    //   } catch (err) {
    //     console.error('Error saving profile:', err);
    //     showToast('Something went wrong.');
    //   }
    // });
  }

  const urlParams = new URLSearchParams(window.location.search);
  const msg = urlParams.get('msg');
  if (msg) {
    showToast(msg);
    window.history.replaceState({}, document.title, window.location.pathname);
  }
});