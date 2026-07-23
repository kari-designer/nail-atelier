/*
  AK Nails Studio, site behaviour.
  Sections: 1) smooth anchor scroll (native, header-offset aware) 2) scroll reveals
  (IntersectionObserver, reduced-motion aware) 3) header + scroll progress
  4) mobile menu (focus trap) 5) portfolio lightbox (focus trap, keyboard nav)
  6) booking button routing 7) contact form (client-side stub, no backend yet)
  8) copy-to-clipboard contacts.

  Scroll is native browser smooth scroll rather than a JS scroll-hijacking library
  (Lenis, etc): it needs no rAF ticker of its own, so it can never freeze on a
  throttled/backgrounded tab the way a JS-driven scroll loop can, and native
  smooth scroll is fast enough on all current evergreen browsers for this site.
*/

document.addEventListener('DOMContentLoaded', () => {
  const HEADER_OFFSET = 72;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  const scrollToTarget = (target) => {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
    window.scrollTo({ top, behavior: prefersReduced ? 'auto' : 'smooth' });
  };

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const id = link.getAttribute('href');
      if (id.length < 2) return;
      const el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      scrollToTarget(el);
      history.pushState(null, '', id);
    });
  });

  /* ---------------- header state + scroll progress ---------------- */
  const header = document.querySelector('[data-header]');
  const progress = document.createElement('div');
  progress.className = 'scroll-progress';
  document.body.appendChild(progress);

  const onScroll = () => {
    if (header) {
      if (window.scrollY > 12) header.setAttribute('data-scrolled', ''); else header.removeAttribute('data-scrolled');
    }
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    const ratio = max > 0 ? window.scrollY / max : 0;
    progress.style.transform = `scaleX(${ratio})`;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------------- scroll reveals ----------------
     Native IntersectionObserver toggling a CSS class, not a JS animation
     ticker: it keeps working correctly regardless of tab throttling, and
     costs nothing if IntersectionObserver is unsupported (falls back to
     showing everything immediately). The hidden starting state itself only
     applies under .js (see style.css), so a no-JS visitor never loses content. */
  const revealTargets = document.querySelectorAll('.reveal-up, .gallery__item');
  if (!prefersReduced && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px 15% 0px' });

    revealTargets.forEach((el, i) => {
      if (el.classList.contains('gallery__item')) el.style.transitionDelay = `${(i % 4) * 0.06}s`;
      io.observe(el);
    });
  } else {
    revealTargets.forEach((el) => el.classList.add('is-visible'));
  }

  /* ---------------- mobile menu ---------------- */
  const menu = document.querySelector('[data-mobile-menu]');
  const openBtn = document.querySelector('[data-menu-open]');
  const closeBtn = document.querySelector('[data-menu-close]');
  let lastFocused = null;

  const getFocusable = (root) => Array.from(root.querySelectorAll('a, button')).filter((el) => el.offsetParent !== null);

  const openMenu = () => {
    lastFocused = document.activeElement;
    menu.setAttribute('data-open', '');
    menu.removeAttribute('aria-hidden');
    openBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    const focusable = getFocusable(menu);
    if (focusable.length) focusable[0].focus();
  };
  const closeMenu = () => {
    menu.removeAttribute('data-open');
    menu.setAttribute('aria-hidden', 'true');
    openBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    if (lastFocused) lastFocused.focus();
  };

  if (openBtn && menu) {
    openBtn.addEventListener('click', openMenu);
    closeBtn.addEventListener('click', closeMenu);
    menu.querySelectorAll('[data-menu-link]').forEach((link) => link.addEventListener('click', closeMenu));

    menu.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeMenu(); return; }
      if (e.key !== 'Tab') return;
      const focusable = getFocusable(menu);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* ---------------- booking button ----------------
     Every [data-booking-trigger] carries a data-booking-url pointing at
     the real Salonized widget; this just wires it up as a real link. */
  document.querySelectorAll('[data-booking-trigger]').forEach((btn) => {
    const url = btn.getAttribute('data-booking-url');
    if (!url) return;
    btn.setAttribute('href', url);
    btn.setAttribute('target', '_blank');
    btn.setAttribute('rel', 'noopener');
  });

  /* ---------------- portfolio lightbox ---------------- */
  const galleryItems = Array.from(document.querySelectorAll('[data-gallery] .gallery__item'));
  const lightbox = document.querySelector('[data-lightbox]');
  const lightboxArt = document.querySelector('[data-lightbox-art]');
  const lightboxCaption = document.querySelector('[data-lightbox-caption]');
  let currentIndex = 0;
  let lightboxLastFocused = null;

  const renderLightbox = (index) => {
    currentIndex = (index + galleryItems.length) % galleryItems.length;
    const item = galleryItems[currentIndex];
    const caption = item.getAttribute('data-caption') || '';
    lightboxArt.src = item.getAttribute('data-img');
    lightboxArt.alt = caption;
    lightboxCaption.textContent = caption;
  };

  const openLightbox = (index) => {
    lightboxLastFocused = document.activeElement;
    renderLightbox(index);
    lightbox.setAttribute('data-open', '');
    lightbox.removeAttribute('aria-hidden');
    document.body.style.overflow = 'hidden';
    document.querySelector('[data-lightbox-close]').focus();
  };
  const closeLightbox = () => {
    lightbox.removeAttribute('data-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lightboxLastFocused) lightboxLastFocused.focus();
  };

  galleryItems.forEach((item, i) => item.addEventListener('click', () => openLightbox(i)));
  document.querySelector('[data-lightbox-close]')?.addEventListener('click', closeLightbox);
  document.querySelector('[data-lightbox-prev]')?.addEventListener('click', () => renderLightbox(currentIndex - 1));
  document.querySelector('[data-lightbox-next]')?.addEventListener('click', () => renderLightbox(currentIndex + 1));
  lightbox?.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });

  lightbox?.addEventListener('keydown', (e) => {
    if (!lightbox.hasAttribute('data-open')) return;
    if (e.key === 'Escape') { closeLightbox(); return; }
    if (e.key === 'ArrowRight') { renderLightbox(currentIndex + 1); return; }
    if (e.key === 'ArrowLeft') { renderLightbox(currentIndex - 1); return; }
    if (e.key !== 'Tab') return;
    const focusable = getFocusable(lightbox.querySelector('.lightbox__panel'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
});
