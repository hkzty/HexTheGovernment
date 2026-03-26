const body = document.body;
const menuToggle = document.querySelector('.menu-toggle');
const mobileMenu = document.querySelector('.mobile-menu');
const navLinks = document.querySelectorAll('a[href^="#"]');
const sideLinks = document.querySelectorAll('.side-link');
const sections = document.querySelectorAll('[data-section]');
const reveals = document.querySelectorAll('.reveal');
const counters = document.querySelectorAll('[data-counter]');
const backToTop = document.querySelector('.back-to-top');
const scrollBar = document.querySelector('.scroll-meter-bar');
const parallaxItems = document.querySelectorAll('.parallax');
const galleryItems = document.querySelectorAll('.gallery-item');
const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightboxImage');
const lightboxClose = document.querySelector('.lightbox-close');
const contactForm = document.getElementById('contactForm');
const formFeedback = document.getElementById('formFeedback');

if (menuToggle && mobileMenu) {
  menuToggle.addEventListener('click', () => {
    const isOpen = menuToggle.classList.toggle('is-open');
    mobileMenu.classList.toggle('is-open', isOpen);
    body.classList.toggle('menu-open', isOpen);
    menuToggle.setAttribute('aria-expanded', String(isOpen));
  });

  mobileMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      menuToggle.classList.remove('is-open');
      mobileMenu.classList.remove('is-open');
      body.classList.remove('menu-open');
      menuToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

navLinks.forEach((link) => {
  link.addEventListener('click', (event) => {
    const href = link.getAttribute('href');
    if (!href || href === '#') return;

    const target = document.querySelector(href);
    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in-view');
      revealObserver.unobserve(entry.target);
    });
  },
  { threshold: 0.14 }
);

reveals.forEach((item) => revealObserver.observe(item));

const counterObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      const el = entry.target;
      const target = Number(el.dataset.counter || 0);
      let frame = 0;
      const totalFrames = 60;

      const tick = () => {
        frame += 1;
        const progress = frame / totalFrames;
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = Math.round(target * eased);
        el.textContent = value;

        if (frame < totalFrames) {
          requestAnimationFrame(tick);
        } else {
          el.textContent = target;
        }
      };

      requestAnimationFrame(tick);
      counterObserver.unobserve(el);
    });
  },
  { threshold: 0.45 }
);

counters.forEach((counter) => counterObserver.observe(counter));

const setActiveSection = () => {
  const midpoint = window.scrollY + window.innerHeight * 0.35;

  sections.forEach((section) => {
    const top = section.offsetTop;
    const bottom = top + section.offsetHeight;
    const isActive = midpoint >= top && midpoint < bottom;

    if (isActive) {
      sideLinks.forEach((link) => {
        link.classList.toggle('active', link.getAttribute('href') === `#${section.id}`);
      });
    }
  });
};

const updateScrollUI = () => {
  const doc = document.documentElement;
  const scrollable = doc.scrollHeight - window.innerHeight;
  const progress = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;

  if (scrollBar) {
    scrollBar.style.width = `${Math.min(progress, 100)}%`;
  }

  if (backToTop) {
    backToTop.classList.toggle('visible', window.scrollY > 500);
  }

  setActiveSection();
};

const updateParallax = () => {
  const y = window.scrollY;
  parallaxItems.forEach((item) => {
    const speed = Number(item.dataset.speed || 0);
    item.style.transform = `translate3d(0, ${y * speed}px, 0)`;
  });
};

window.addEventListener('scroll', () => {
  updateScrollUI();
  updateParallax();
}, { passive: true });

window.addEventListener('load', () => {
  updateScrollUI();
  updateParallax();
});

if (backToTop) {
  backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

const finePointer = window.matchMedia('(pointer: fine)').matches;
if (finePointer) {
  const cursorDot = document.querySelector('.cursor-dot');
  const cursorRing = document.querySelector('.cursor-ring');

  let ringX = window.innerWidth / 2;
  let ringY = window.innerHeight / 2;
  let mouseX = ringX;
  let mouseY = ringY;

  const animateCursor = () => {
    ringX += (mouseX - ringX) * 0.18;
    ringY += (mouseY - ringY) * 0.18;

    if (cursorDot) cursorDot.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(-50%, -50%)`;
    if (cursorRing) cursorRing.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%, -50%)`;

    requestAnimationFrame(animateCursor);
  };

  window.addEventListener('mousemove', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
  });

  document.querySelectorAll('a, button, input, textarea, label').forEach((interactive) => {
    interactive.addEventListener('mouseenter', () => body.classList.add('cursor-hover'));
    interactive.addEventListener('mouseleave', () => body.classList.remove('cursor-hover'));
  });

  animateCursor();
}

const openLightbox = (src, alt) => {
  if (!lightbox || !lightboxImage) return;
  lightboxImage.src = src;
  lightboxImage.alt = alt || 'Expanded gallery image';
  lightbox.classList.add('is-open');
  lightbox.setAttribute('aria-hidden', 'false');
  body.classList.add('lightbox-open');
};

const closeLightbox = () => {
  if (!lightbox || !lightboxImage) return;
  lightbox.classList.remove('is-open');
  lightbox.setAttribute('aria-hidden', 'true');
  lightboxImage.src = '';
  body.classList.remove('lightbox-open');
};

galleryItems.forEach((item) => {
  item.addEventListener('click', () => {
    const src = item.dataset.lightboxSrc;
    const img = item.querySelector('img');
    openLightbox(src, img ? img.alt : 'Expanded gallery image');
  });
});

if (lightboxClose) {
  lightboxClose.addEventListener('click', closeLightbox);
}

if (lightbox) {
  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) closeLightbox();
  });
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeLightbox();
});

const isEmailValid = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

if (contactForm && formFeedback) {
  contactForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const fields = [...contactForm.querySelectorAll('input[required], textarea[required]')];
    let isValid = true;

    fields.forEach((field) => {
      const value = field.value.trim();
      field.classList.remove('invalid');

      if (!value) {
        field.classList.add('invalid');
        isValid = false;
        return;
      }

      if (field.type === 'email' && !isEmailValid(value)) {
        field.classList.add('invalid');
        isValid = false;
        return;
      }

      if (field.minLength > 0 && value.length < field.minLength) {
        field.classList.add('invalid');
        isValid = false;
      }
    });

    if (!isValid) {
      formFeedback.textContent = 'Validation failed. Check the highlighted fields and try again.';
      formFeedback.style.color = 'var(--danger)';
      return;
    }

    formFeedback.textContent = 'Transmission accepted. Front-end demo passed. Connect a form endpoint to receive real submissions.';
    formFeedback.style.color = 'var(--accent)';
    contactForm.reset();
  });
}
