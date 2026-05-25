// GameHub Launcher — interactivity for the mockup

document.addEventListener('DOMContentLoaded', () => {
  // Nav item selection
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
    });
  });

  // View toggle (grid/list)
  const toggleBtns = document.querySelectorAll('.toggle-btn');
  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      toggleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Section chip selection
  document.querySelectorAll('.section-actions').forEach(group => {
    const chips = group.querySelectorAll('.chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('chip-active'));
        chip.classList.add('chip-active');
      });
    });
  });

  // Favorite toggle
  document.querySelectorAll('.card-fav').forEach(fav => {
    fav.addEventListener('click', (e) => {
      e.stopPropagation();
      fav.classList.toggle('active');
      const svg = fav.querySelector('svg');
      if (fav.classList.contains('active')) {
        svg.setAttribute('fill', 'currentColor');
        svg.innerHTML = '<path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/>';
      } else {
        svg.setAttribute('fill', 'none');
        svg.innerHTML = '<path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" stroke="currentColor" stroke-width="1.7"/>';
      }
    });
  });

  // Animate stat / chart bars on load
  const bars = document.querySelectorAll('.chart-bar');
  bars.forEach((bar, i) => {
    const h = bar.style.height;
    bar.style.height = '0%';
    setTimeout(() => { bar.style.height = h; }, 100 + i * 60);
  });

  // Ambient glow follows hover on hero
  const hero = document.querySelector('.hero');
  if (hero) {
    hero.addEventListener('mousemove', (e) => {
      const rect = hero.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      const noise = hero.querySelector('.hero-bg-noise');
      if (noise) {
        noise.style.background = `
          radial-gradient(circle at ${x}% ${y}%, rgba(139, 92, 246, 0.5), transparent 50%),
          radial-gradient(circle at ${100 - x}% ${100 - y}%, rgba(59, 130, 246, 0.35), transparent 50%)
        `;
      }
    });
  }

  // Search keyboard shortcut
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      const input = document.querySelector('.search input');
      if (input) input.focus();
    }
  });

  // Launcher hover effect
  document.querySelectorAll('.launcher-item').forEach(item => {
    item.addEventListener('click', () => {
      item.style.transform = 'scale(0.97)';
      setTimeout(() => { item.style.transform = ''; }, 140);
    });
  });

  // Run-backup button feedback
  const backupBtn = document.querySelector('.btn-backup');
  if (backupBtn) {
    backupBtn.addEventListener('click', () => {
      const orig = backupBtn.innerHTML;
      backupBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" style="animation: spin 1s linear infinite;">
          <path d="M21 12a9 9 0 1 1-9-9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        Backing up...`;
      backupBtn.style.opacity = '0.85';
      setTimeout(() => {
        backupBtn.innerHTML = orig;
        backupBtn.style.opacity = '1';
      }, 2200);
    });
  }
});

// Spin keyframe for backup loader (inject)
const style = document.createElement('style');
style.textContent = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
document.head.appendChild(style);
