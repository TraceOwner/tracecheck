'use strict';
(() => {
  const {Spring, Motion, Lens, Morph, reduced, clamp, smooth, easing, duration, ticker, curves, followers, morphHeight} = window.TraceMotion;
  const root = document.documentElement;
  const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

  /* ───── Motion preference: kept in page memory only ───── */
  const toggles = [], motionListeners = new Set();
  let paused = false;
  const motionStopped = () => paused || reduceQuery.matches;
  function setPaused(value) {
    paused = value;
    root.classList.toggle('motion-paused', paused);
    toggles.forEach(button => {
      button.setAttribute('aria-pressed', String(motionStopped()));
      button.textContent = reduceQuery.matches ? 'Движение уменьшено' : paused ? 'Продолжить движение' : 'Пауза движения';
      button.disabled = reduceQuery.matches;
    });
    motionListeners.forEach(listener => listener(motionStopped()));
    onScroll();
  }
  document.querySelectorAll('.hero-floor, .menu-tail').forEach(parent => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'motion-toggle';
    button.addEventListener('click', () => setPaused(!paused));
    parent.append(button); toggles.push(button);
  });
  reduceQuery.addEventListener('change', () => setPaused(paused));

  /* ───── Header material and hero depth follow the scroll position ───── */
  const header = document.querySelector('.site-header');
  const hero = document.querySelector('.cinema-hero');
  // Scroll-driven animations (trace.css) move the hero on the compositor; without them the offset is written to the two layers that use it.
  const parallax = hero && !CSS.supports('animation-timeline', 'scroll()') ? [hero.querySelector('.cinema-copy'), hero.querySelector('.cinema-word')].filter(Boolean) : [];
  /* One scroll listener for the whole page. It only marks the frame; subscribers (TraceUI.onScroll) run once per
     frame on the shared ticker with the current scrollY. */
  const scrollJobs = new Set();
  let scrollQueued = false;
  const runScroll = () => { scrollQueued = false; const y = scrollY; scrollJobs.forEach(job => job(y)); return false; };
  function onScroll() { if (!scrollQueued) { scrollQueued = true; ticker.add(runScroll); } }
  const onScrollFrame = job => { scrollJobs.add(job); return () => scrollJobs.delete(job); };
  addEventListener('scroll', onScroll, {passive: true});
  let headerScrolled = null;
  // Home without scroll timelines: the header logo settles in as the hero scrolls away (trace.css: --brand-p).
  const homeBrand = document.body.dataset.page === 'home' && !CSS.supports('animation-timeline', 'scroll()') ? header?.querySelector('.brand-lockup') : null;
  const settleBrand = y => homeBrand.style.setProperty('--brand-p', motionStopped() ? '1' : clamp((y / innerHeight - .08) / .54).toFixed(3));
  if (homeBrand) { onScrollFrame(settleBrand); settleBrand(scrollY); }
  onScrollFrame(y => {
    const scrolled = y > 8;
    if (scrolled !== headerScrolled) { headerScrolled = scrolled; header?.toggleAttribute('data-scrolled', scrolled); }
    if (parallax.length) {
      const scene = motionStopped() ? '0' : clamp(y / Math.max(1, hero.offsetHeight)).toFixed(4);
      parallax.forEach(layer => layer.style.setProperty('--scene', scene));
    }
  });

  /* ───── Navigation hover lens ───── */
  const nav = document.querySelector('.desktop-nav');
  const navLensElement = nav?.querySelector('.nav-lens');
  if (nav && navLensElement) {
    const lens = new Lens(nav, navLensElement, {duration: .44, bounce: .2});
    nav.querySelectorAll('a').forEach(link => link.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse') lens.moveTo(link);
    }));
    nav.addEventListener('pointerleave', () => lens.hide());
  }

  /* ───── Dialogs zoom out of the control that opened them ───── */
  const menuTrigger = document.getElementById('menu-trigger');
  const menu = document.getElementById('site-menu');
  const triggers = new WeakMap(), closeTimers = new WeakMap(), settleTimers = new WeakMap();
  function placeOrigin(dialog, trigger) {
    const box = {x: dialog.offsetLeft, y: dialog.offsetTop, w: dialog.offsetWidth, h: dialog.offsetHeight};
    const source = trigger?.getBoundingClientRect();
    if (!source || !source.width) {
      dialog.style.setProperty('--from-x', '0px'); dialog.style.setProperty('--from-y', '24px'); dialog.style.setProperty('--from-scale', '.92');
      return;
    }
    const cx = source.left + source.width / 2, cy = source.top + source.height / 2;
    if (dialog === menu) {
      // The menu grows from the round trigger, anchored at its centre.
      dialog.style.setProperty('--origin-x', `${cx - box.x}px`);
      dialog.style.setProperty('--origin-y', `${cy - box.y}px`);
      dialog.style.setProperty('--from-x', '0px'); dialog.style.setProperty('--from-y', '0px');
      dialog.style.setProperty('--from-scale', '.3');
    } else {
      dialog.style.setProperty('--from-x', `${cx - (box.x + box.w / 2)}px`);
      dialog.style.setProperty('--from-y', `${cy - (box.y + box.h / 2)}px`);
      dialog.style.setProperty('--from-scale', String(clamp(source.width / box.w, .18, .5)));
    }
  }
  /* The round trigger opens into the menu, iOS-style: the button's glass
     grows into the panel, its two bars become the cross of the close button
     that sits exactly where the trigger was, and rows surface as the glass
     reaches them. Closing flows the panel back into the button. */
  const menuBody = menu?.querySelector('.menu-body'), menuContent = menu?.querySelector('.menu-content');
  // The panel's shadow is a separate layer sized to the open panel and scaled to the current shape with transform:
  // a filter on the clipped glass would have to be recomputed on every frame of the opening.
  const menuShadow = menu?.querySelector('.menu-shadow');
  const menuClose = menuContent?.querySelector('.menu-head [data-close-dialog]');
  let menuRows = [];
  const menuMorph = menuBody && new Morph({body: menuBody, content: menuContent,
    onFrame: ({l, t, w, h, b, c, p}) => {
      const target = menuMorph.target;
      if (menuShadow && target) menuShadow.style.transform = `translate3d(${(l - target.x).toFixed(2)}px,${(t - target.y).toFixed(2)}px,0) scale(${(w / target.w).toFixed(4)},${(h / target.h).toFixed(4)})`;
      // Rows use the individual translate property and hand back to the stylesheet once revealed, so hover and press states (transform) are never overridden.
      menuRows.forEach(({node, top}) => {
        const reveal = Math.min(smooth(top + 4, top + 40, b), smooth(170, 40, l), c), style = node.style;
        if (reveal > .995) { style.opacity = style.translate = ''; return; }
        style.opacity = reveal.toFixed(3);
        style.translate = `0 ${((1 - reveal) * -8).toFixed(2)}px`;
      });
      // One blur on the whole content pulls focus instead of a filter surface per row.
      menuContent.style.filter = c < .98 ? `blur(${((1 - c) * 2.6).toFixed(2)}px)` : '';
      // The panel gains its backdrop blur once it has nearly finished opening, and loses it as soon as it starts closing.
      if (menuMorph.open) { if (p > .97) menu.classList.add('is-settled'); } else menu.classList.remove('is-settled');
    },
    onRest: open => { if (!open && menu.dataset.closing) finishClose(menu); }
  });
  function layoutMenu() {
    const width = Math.min(380, innerWidth - 24);
    menu.style.width = `${width}px`;
    menuContent.style.width = `${width}px`;
    menuContent.style.transform = 'none';
    const height = menuContent.offsetHeight;
    menu.style.height = `${height}px`;
    // Place the frame so its close button sits exactly on the trigger.
    const t = menuTrigger.getBoundingClientRect(), base = menuContent.getBoundingClientRect(), close = menuClose.getBoundingClientRect();
    const cx = close.left - base.left + close.width / 2, cy = close.top - base.top + close.height / 2;
    const left = Math.max(12, Math.min(innerWidth - width - 12, t.left + t.width / 2 - cx));
    const top = Math.max(4, t.top + t.height / 2 - cy);
    Object.assign(menu.style, {left: `${left}px`, top: `${top}px`, right: 'auto'});
    menuRows = [...menuContent.querySelectorAll('.menu-head .mini-label, .menu-links a, .menu-tail')].map(node => ({node, top: node.getBoundingClientRect().top - base.top}));
    menuMorph.layout({x: t.left - left, y: t.top - top, w: t.width, h: t.height, r: t.height / 2}, {x: 0, y: 0, w: width, h: height, r: 26});
    if (menuShadow) Object.assign(menuShadow.style, {width: `${width}px`, height: `${height}px`});
  }
  function finishClose(dialog) {
    if (!dialog.dataset.closing) return;
    clearTimeout(closeTimers.get(dialog));
    delete dialog.dataset.closing;
    dialog.close();
    triggers.get(dialog)?.focus({preventScroll: true});
  }
  function openDialog(dialog, trigger) {
    if (!dialog) return;
    if (dialog.open) {
      if (!dialog.dataset.closing) return;
      clearTimeout(closeTimers.get(dialog)); delete dialog.dataset.closing;
    } else {
      triggers.set(dialog, trigger);
      dialog.showModal();
      if (dialog === menu && menuMorph) { layoutMenu(); menuMorph.snap(false); }
      else placeOrigin(dialog, trigger);
      dialog.getBoundingClientRect();
    }
    if (dialog === menu && menuMorph) menuMorph.set(true);
    requestAnimationFrame(() => dialog.classList.add('is-open'));
    if (dialog !== menu) settleTimers.set(dialog, setTimeout(() => dialog.classList.add('is-settled'), 520));
    if (dialog === menu) menuTrigger?.setAttribute('aria-expanded', 'true');
    dialog.querySelector('[data-close-dialog]')?.focus({preventScroll: true});
  }
  function closeDialog(dialog) {
    if (!dialog?.open || dialog.dataset.closing) return;
    dialog.dataset.closing = 'true';
    dialog.classList.remove('is-open', 'is-settled');
    clearTimeout(settleTimers.get(dialog));
    if (dialog === menu) menuTrigger?.setAttribute('aria-expanded', 'false');
    if (dialog === menu && menuMorph) {
      if (reduced()) { finishClose(dialog); return; }
      menuMorph.set(false);
      closeTimers.set(dialog, setTimeout(() => finishClose(dialog), 1400));
      return;
    }
    placeOrigin(dialog, triggers.get(dialog));
    const finish = () => {
      if (!dialog.dataset.closing) return;
      clearTimeout(closeTimers.get(dialog));
      dialog.removeEventListener('transitionend', onEnd);
      delete dialog.dataset.closing;
      dialog.close();
      triggers.get(dialog)?.focus({preventScroll: true});
    };
    const onEnd = event => { if (event.target === dialog && event.propertyName === 'transform') finish(); };
    if (reduced()) { finish(); return; }
    dialog.addEventListener('transitionend', onEnd);
    closeTimers.set(dialog, setTimeout(finish, 420));
  }
  menuTrigger?.addEventListener('click', () => menu.open && !menu.dataset.closing ? closeDialog(menu) : openDialog(menu, menuTrigger));
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(dialog); });
    dialog.addEventListener('click', event => {
      const box = dialog.getBoundingClientRect();
      const outside = event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
      if (event.target === dialog && outside) closeDialog(dialog);
    });
    dialog.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => closeDialog(dialog)));
  });

  /* ───── Notification island: fixed to the window, never to the page ───── */
  const liveRegion = document.getElementById('toast');
  let island;
  function createIsland() {
    const host = document.createElement('div');
    host.className = 'island'; host.setAttribute('aria-hidden', 'true'); host.hidden = true;
    host.innerHTML = '<div class="island-glass"><div class="island-content"><span class="island-icon"><svg viewBox="0 0 20 20" fill="none"><path d="m5.6 10.3 3 3 5.9-6.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="island-text"><strong></strong><small></small></span></div></div>';
    document.body.append(host);
    const glass = host.firstElementChild, content = glass.firstElementChild;
    const icon = content.querySelector('.island-icon'), text = content.querySelector('.island-text');
    const title = text.querySelector('strong'), detail = text.querySelector('small');
    const base = 58, timers = [];
    let fullWidth = base;
    const motion = new Motion({
      presence: new Spring({duration: .52, bounce: .3}),
      width: new Spring({duration: .56, bounce: .22, precision: .1, value: base}),
      reveal: new Spring({duration: .5, bounce: 0})
    }, ({presence, width, reveal}) => {
      const p = Math.max(0, presence);
      // The pill is laid out at its full width once per message; frames only move the clip (--side in trace.css).
      const shown = Math.max(base * .6, width);
      glass.style.setProperty('--side', `${Math.max(0, (fullWidth - shown) / 2).toFixed(2)}px`);
      glass.style.transform = `scale(${(.45 + .55 * p).toFixed(4)})`;
      glass.style.opacity = clamp(p * 2.4).toFixed(3);
      glass.style.filter = p < .985 ? `blur(${((1 - clamp(p)) * 12).toFixed(2)}px)` : 'none';
      const i = smooth(0, .55, reveal), t = smooth(.18, .95, reveal);
      icon.style.opacity = i.toFixed(3);
      icon.style.transform = `scale(${(.55 + .45 * i).toFixed(4)}) rotate(${((1 - i) * -40).toFixed(2)}deg)`;
      icon.style.setProperty('--check', (20 * (1 - smooth(.25, 1, reveal))).toFixed(2));
      text.style.opacity = t.toFixed(3);
      text.style.transform = `translateX(${((1 - t) * -10).toFixed(2)}px)`;
      text.style.filter = t < .99 ? `blur(${((1 - t) * 5).toFixed(2)}px)` : 'none';
    }, {onRest: m => { if (m.springs.presence.target === 0) host.hidden = true; }});
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    return {
      show(heading, note) {
        timers.splice(0).forEach(clearTimeout);
        const wasHidden = host.hidden || motion.springs.presence.target === 0;
        host.hidden = false;
        title.textContent = heading; detail.textContent = note; detail.hidden = !note;
        const target = Math.ceil(content.scrollWidth);
        fullWidth = Math.max(base, target, fullWidth);
        glass.style.width = `${fullWidth}px`;
        if (reduced()) {
          motion.to({presence: 1, width: target, reveal: 1}, {immediate: true});
        } else if (wasHidden) {
          const {presence, width, reveal} = motion.springs;
          presence.x = presence.v = 0; width.x = width.target = base; width.v = 0; reveal.x = reveal.target = reveal.v = 0;
          motion.render(motion.values, motion);
          motion.to({presence: 1}, {config: {presence: [.52, .3]}});
          later(() => motion.to({width: target}, {config: {width: [.56, .22]}}), 90);
          later(() => motion.to({reveal: 1}, {config: {reveal: [.5, 0]}}), 170);
        } else {
          motion.springs.reveal.x = Math.min(motion.springs.reveal.x, .35);
          motion.to({width: target, reveal: 1});
        }
        later(() => this.hide(), 2800);
      },
      hide() {
        timers.splice(0).forEach(clearTimeout);
        if (reduced()) { motion.to({presence: 0, width: base, reveal: 0}, {immediate: true}); host.hidden = true; return; }
        motion.to({reveal: 0}, {config: {reveal: [.3, 0]}});
        later(() => motion.to({width: base}, {config: {width: [.38, 0]}}), 110);
        later(() => motion.to({presence: 0}, {config: {presence: [.34, 0]}}), 250);
      }
    };
  }
  function notify({title, detail = ''}) {
    if (liveRegion) {
      liveRegion.textContent = '';
      requestAnimationFrame(() => { liveRegion.textContent = detail ? `${title}. ${detail}` : title; });
    }
    island ??= createIsland();
    island.show(title, detail);
  }

  /* ───── Scroll reveals: one material, staggered within each group ───── */
  const autoReveal = [
    '.methods-head > .eyebrow', '.methods-head > p',
    '.night-statement .eyebrow', '.night-foot',
    '.ecosystem-heading > .eyebrow', '.ecosystem-heading > p', '.ecosystem-all',
    '.final-cta .button',
    '.check-game-copy', '.game-picker', '.check-rail', '.check-main', '.check-aside',
    '.method-aside', '.section-title > .eyebrow', '.scope-body > .button', '.faq-list > details',
    '.projects-intro', '.projects-end .eyebrow', '.projects-end > .button',
    '.tools-rail', '.tools-alert', '.tools-source', '.legal-sidebar',
    '.footer-top > *', '.footer-bottom'
  ].join(',');
  document.querySelectorAll(autoReveal).forEach(node => {
    if (!node.closest('dialog') && !node.parentElement.closest('[data-reveal]')) node.setAttribute('data-reveal', '');
  });
  const revealNodes = [...document.querySelectorAll('[data-reveal]')];
  const revealAll = () => revealNodes.forEach(node => node.classList.add('is-in'));
  if (!('IntersectionObserver' in window) || reduceQuery.matches) revealAll();
  else {
    const revealObserver = new IntersectionObserver(entries => {
      const batch = entries.filter(entry => entry.isIntersecting).map(entry => entry.target);
      const groups = new Map();
      batch.forEach(node => { const list = groups.get(node.parentElement) || []; list.push(node); groups.set(node.parentElement, list); });
      groups.forEach(list => list.forEach((node, index) => {
        node.style.setProperty('--reveal-delay', `${Math.min(index, 5) * 70}ms`);
        node.classList.add('is-in');
        revealObserver.unobserve(node);
        // Mono labels decode out of noise as their section arrives.
        if (node.matches('.eyebrow') && !node.children.length) {
          setTimeout(() => TraceMotion.scramble(node, node.textContent, {duration: 760, force: true}), Math.min(index, 5) * 70 + 80);
        }
      }));
    }, {threshold: .12, rootMargin: '0px 0px -6% 0px'});
    revealNodes.forEach(node => revealObserver.observe(node));
  }
  addEventListener('pageshow', event => { if (event.persisted) revealAll(); });

  // Section headings resolve line by line; lines keep native kerning.
  const headings = [...document.querySelectorAll('.methods-head h2, .ecosystem-heading h2, .section-title h2, .final-cta h2, .statement-title, .projects-end h2, .check-bottom h2')]
    .filter(heading => !heading.closest('[data-reveal]'));
  headings.forEach(heading => {
    if (heading.querySelector(':scope > .title-line')) {
      heading.querySelectorAll(':scope > .title-line').forEach((line, index) => line.style.setProperty('--line-delay', `${index * 95}ms`));
      heading.classList.add('title-ready');
      return;
    }
    const lines = [document.createElement('span')];
    for (const node of [...heading.childNodes]) {
      if (node.nodeName === 'BR') { node.remove(); lines.push(document.createElement('span')); }
      else lines[lines.length - 1].append(node);
    }
    lines.forEach((line, index) => { line.className = 'title-line'; line.style.setProperty('--line-delay', `${index * 95}ms`); heading.append(line); });
    heading.classList.add('title-ready');
  });
  if (!('IntersectionObserver' in window) || reduceQuery.matches) headings.forEach(h => h.classList.add('title-in'));
  else {
    const titleObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('title-in'); titleObserver.unobserve(entry.target);
    }), {threshold: .2});
    headings.forEach(heading => titleObserver.observe(heading));
  }

  /* ───── Specular light follows the pointer across useful surfaces ───── */
  // Surfaces get a rim of light (trace-surface); table rows only a soft spot under the pointer (CSS ::before).
  document.querySelectorAll('.button, .header-start, .tool-guide, .statement, .project-destinations > a:not(.project-check), .method-row, .game-row').forEach(surface => {
    if (!surface.matches('.method-row, .game-row')) surface.classList.add('trace-surface');
    let frame = 0, x = 50, y = 0;
    surface.addEventListener('pointermove', event => {
      if (motionStopped() || event.pointerType !== 'mouse') return;
      const box = surface.getBoundingClientRect();
      x = (event.clientX - box.left) / box.width * 100; y = (event.clientY - box.top) / box.height * 100;
      frame ||= requestAnimationFrame(() => {
        frame = 0;
        surface.style.setProperty('--light-x', `${x.toFixed(1)}%`);
        surface.style.setProperty('--light-y', `${y.toFixed(1)}%`);
      });
    }, {passive: true});
  });

  /* ───── FAQ: disclosure height follows a spring, content focuses in ───── */
  document.querySelectorAll('.faq-list details').forEach(details => {
    const summary = details.querySelector('summary'), body = details.querySelector('.faq-body');
    if (!summary || !body) return;
    let running = [];
    const stop = () => { running.forEach(a => a.cancel()); running = []; };
    summary.addEventListener('click', event => {
      if (reduced()) return;
      event.preventDefault();
      if (details.open && !details.dataset.closing) {
        // Close: the answer folds up and everything after it slides up by its height; then the layout collapses
        // in the same frame the slide ends, so nothing jumps.
        stop();
        details.dataset.closing = 'true';
        const h = body.getBoundingClientRect().height, options = {duration: 380, easing: curves.inout};
        const after = followers(details).filter(node => node.getBoundingClientRect().top < innerHeight * 1.5);
        running = [body.animate([{clipPath: 'inset(0 0 0 0)', opacity: 1}, {clipPath: `inset(0 0 ${h.toFixed(1)}px 0)`, opacity: 0}], {...options, fill: 'forwards'}),
          ...after.map(node => node.animate([{transform: 'none'}, {transform: `translateY(${(-h).toFixed(1)}px)`}], {...options, fill: 'forwards'}))];
        running[0].onfinish = () => { details.open = false; delete details.dataset.closing; stop(); };
      } else {
        stop();
        delete details.dataset.closing;
        morphHeight(details, () => { details.open = true; });
        running = [body.animate([{opacity: 0, filter: 'blur(6px)'}, {opacity: 1, filter: 'blur(0)'}], {duration: duration('snappy'), easing: easing('snappy')})];
      }
    });
  });

  /* ───── Tools rail tracks the section being read ───── */
  const railNav = document.querySelector('.tools-rail nav');
  if (railNav) {
    const lens = new Lens(railNav, railNav.querySelector('.rail-lens'), {duration: .5, bounce: .14});
    const links = [...railNav.querySelectorAll('a')];
    const sections = links.map(link => document.querySelector(link.hash));
    let current = null, spyFrame = 0;
    const spy = () => {
      spyFrame = 0;
      const line = innerHeight * .32;
      let active = null;
      sections.forEach((section, index) => { if (section && section.getBoundingClientRect().top - line <= 0) active = links[index]; });
      if (active === current) return;
      current?.classList.remove('is-current'); current?.removeAttribute('aria-current');
      current = active;
      if (current) { current.classList.add('is-current'); current.setAttribute('aria-current', 'location'); }
      lens.moveTo(current);
    };
    onScrollFrame(spy);
    spy();
  }

  /* ───── Legal documents: the current one is held by the lens ───── */
  const legalKey = new URLSearchParams(location.search).get('doc') || 'offer';
  const legalNav = document.querySelector('.legal-sidebar nav');
  if (legalNav) {
    const active = [...legalNav.querySelectorAll('a')].find(link => link.getAttribute('href') === `legal.html?doc=${legalKey}`);
    active?.setAttribute('aria-current', 'page');
    const lens = new Lens(legalNav, legalNav.querySelector('.rail-lens'), {duration: .5, bounce: .14});
    lens.moveTo(active, {immediate: true});
    legalNav.querySelectorAll('a').forEach(link => link.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') lens.moveTo(link); }));
    legalNav.addEventListener('pointerleave', () => lens.moveTo(active));
  }

  const methodList = document.querySelector('.methods-list');
  if (methodList && 'IntersectionObserver' in window) {
    new IntersectionObserver(entries => methodList.toggleAttribute('data-motion-active', entries[0].isIntersecting && !motionStopped()), {threshold: .06}).observe(methodList);
  }

  /* ───── Magnetic controls lean toward the pointer, then spring home ───── */
  const pointerLive = event => event.pointerType === 'mouse' && !motionStopped();
  document.querySelectorAll('.button-light, .header-start, .menu-trigger, .scroll-cue-icon, .copy-button, .faq-icon').forEach(control => {
    const pull = control.matches('.menu-trigger, .scroll-cue-icon, .faq-icon') ? .38 : .2;
    const spring = () => new Spring({duration: .55, bounce: .32, precision: .02});
    const motion = new Motion({x: spring(), y: spring()}, ({x, y}) => { control.style.translate = Math.abs(x) + Math.abs(y) < .05 ? '' : `${x.toFixed(2)}px ${y.toFixed(2)}px`; });
    const host = control.matches('.faq-icon') ? control.closest('summary') : control;
    host.addEventListener('pointermove', event => {
      if (!pointerLive(event)) return;
      const box = control.getBoundingClientRect(), {x, y} = motion.values;
      const dx = event.clientX - (box.left - x + box.width / 2), dy = event.clientY - (box.top - y + box.height / 2);
      motion.to({x: clamp(dx * pull, -14, 14), y: clamp(dy * pull * 1.2, -10, 10)});
    }, {passive: true});
    host.addEventListener('pointerleave', () => motion.to({x: 0, y: 0}));
  });

  /* ───── Tool icons: the tile leans toward the pointer, glyph layers part ───── */
  document.querySelectorAll('.tool-tab, .method-row').forEach(host => {
    const tile = host.querySelector('.tool-mini, .method-icon');
    if (!tile) return;
    const spring = () => new Spring({duration: .5, bounce: .28, precision: .002});
    const motion = new Motion({x: spring(), y: spring()}, ({x, y}) => {
      tile.style.setProperty('--px', x.toFixed(3));
      tile.style.setProperty('--py', y.toFixed(3));
    });
    host.addEventListener('pointermove', event => {
      if (!pointerLive(event)) return;
      const box = tile.getBoundingClientRect(), reach = Math.max(90, box.width * 2.4);
      motion.to({x: clamp((event.clientX - box.left - box.width / 2) / reach, -1, 1), y: clamp((event.clientY - box.top - box.height / 2) / reach, -1, 1)});
    }, {passive: true});
    host.addEventListener('pointerleave', () => motion.to({x: 0, y: 0}));
  });

  /* ───── Cards tilt in depth under the pointer ───── */
  document.querySelectorAll('.statement').forEach(card => {
    card.classList.add('tilt');
    const range = 2.2;
    const spring = () => new Spring({duration: .7, bounce: .18, precision: .005});
    const motion = new Motion({rx: spring(), ry: spring()}, ({rx, ry}) => {
      card.style.setProperty('--rx', `${rx.toFixed(3)}deg`);
      card.style.setProperty('--ry', `${ry.toFixed(3)}deg`);
    });
    card.addEventListener('pointermove', event => {
      if (!pointerLive(event)) return;
      const box = card.getBoundingClientRect();
      const px = (event.clientX - box.left) / box.width - .5, py = (event.clientY - box.top) / box.height - .5;
      motion.to({rx: -py * range * 1.4, ry: px * range});
    }, {passive: true});
    card.addEventListener('pointerleave', () => motion.to({rx: 0, ry: 0}));
  });

  /* ───── A press leaves a drop of light where the finger landed ───── */
  const rippleHosts = '.button, .header-start, .copy-button, .project-check, .tool-guide-source, .game-select-trigger, .tool-tab, .menu-links a, .depth-menu, .signal-name, .method-row, .motion-toggle';
  document.addEventListener('pointerdown', event => {
    const host = event.target.closest(rippleHosts);
    if (!host || event.button !== 0 || reduced()) return;
    const box = host.getBoundingClientRect();
    const size = Math.hypot(box.width, box.height) * 2.1;
    const clip = document.createElement('span');
    clip.className = 'press-ripple'; clip.setAttribute('aria-hidden', 'true');
    const drop = document.createElement('i');
    drop.style.cssText = `left:${event.clientX - box.left}px;top:${event.clientY - box.top}px;width:${size}px;height:${size}px`;
    if (host.matches('.button-light, .header-start')) drop.classList.add('is-dark');
    clip.append(drop); host.append(clip);
    const grow = drop.animate([{transform: 'translate(-50%,-50%) scale(0)', opacity: .9}, {transform: 'translate(-50%,-50%) scale(1)', opacity: .9}], {duration: 620, easing: curves.out, fill: 'forwards'});
    const release = () => {
      removeEventListener('pointerup', release); removeEventListener('pointercancel', release);
      drop.animate([{opacity: .9}, {opacity: 0}], {duration: 520, delay: Math.max(0, 180 - (grow.currentTime || 0)), easing: curves.out, fill: 'forwards'}).finished.then(() => clip.remove(), () => clip.remove());
    };
    addEventListener('pointerup', release); addEventListener('pointercancel', release);
  }, {passive: true});

  /* ───── A small glass companion names what a click will do ───── */
  if (finePointer.matches) {
    const tag = document.createElement('div');
    tag.className = 'cursor-tag'; tag.setAttribute('aria-hidden', 'true');
    tag.innerHTML = '<span></span><svg class="glyph" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 11 11 5"/><path d="M6.2 5H11v4.8"/></svg>';
    document.body.append(tag);
    const label = tag.firstElementChild;
    const follow = () => new Spring({duration: .42, bounce: .16, precision: .05});
    const motion = new Motion({x: follow(), y: follow(), p: new Spring({duration: .38, bounce: .28, precision: .002})}, ({x, y, p}, m) => {
      const lean = clamp(m?.springs?.x.v / 90 || 0, -8, 8);
      tag.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${lean.toFixed(2)}deg) scale(${(.4 + .6 * Math.max(0, p)).toFixed(3)})`;
      tag.style.opacity = clamp(p * 1.6).toFixed(3);
    });
    const targets = [['.game-row', 'Открыть проверку'], ['.project-destinations > a:not(.project-check)', 'Официальный сайт'], ['.signal-name', 'Скопировать имя'], ['.method-row', 'Открыть этот способ']];
    let current = null;
    document.addEventListener('pointermove', event => {
      if (event.pointerType !== 'mouse') return;
      const hit = targets.find(([selector]) => event.target.closest(selector));
      const host = hit && event.target.closest(hit[0]);
      const x = event.clientX + 18, y = event.clientY + 20;
      if (host && !motionStopped()) {
        if (current !== host) {
          label.textContent = hit[1];
          tag.classList.toggle('no-arrow', Boolean(hit[2]));
          if (!current) { motion.springs.x.x = x; motion.springs.y.x = y; }
          current = host;
        }
        motion.to({x, y, p: 1});
      } else if (current) { current = null; motion.to({x, y, p: 0}); }
    }, {passive: true});
    onScrollFrame(() => { if (current) { current = null; motion.to({p: 0}); } });
  }

  /* ───── A flashlight searches the metal of the hero word (plain-text fallback only) ───── */
  const heroWord = document.querySelector('.cinema-word > span');
  if (hero && heroWord) {
    const light = () => new Spring({duration: .8, bounce: .08, precision: .1});
    const motion = new Motion({x: light(), y: light(), a: new Spring({duration: .6, precision: .002})}, ({x, y, a}) => {
      heroWord.style.setProperty('--fx', `${x.toFixed(1)}px`);
      heroWord.style.setProperty('--fy', `${y.toFixed(1)}px`);
      heroWord.style.setProperty('--flash', a.toFixed(3));
    });
    hero.addEventListener('pointermove', event => {
      // Under the 3D scene or its poster (hero3d.js) this word is hidden and the flashlight has nothing to light.
      if (!pointerLive(event) || heroWord.parentElement.matches('.is-3d') || heroWord.previousElementSibling?.matches('.hero3d-poster')) return;
      const box = heroWord.getBoundingClientRect();
      const x = event.clientX - box.left, y = event.clientY - box.top;
      if (motion.springs.a.x < .02) { motion.springs.x.x = x; motion.springs.y.x = y; }
      const near = clamp(1.25 - Math.max(0, box.top - event.clientY) / 420);
      motion.to({x, y, a: near});
    }, {passive: true});
    hero.addEventListener('pointerleave', () => motion.to({a: 0}));
  }

  /* ───── The headline is metal: its highlight follows the pointer across, its horizon up and down ───── */
  const heroTitle = hero?.querySelector('.cinema-copy h1');
  if (heroTitle) {
    const plates = [...heroTitle.querySelectorAll('.title-line:first-child, em')];
    let spans = [];
    // At rest the highlight stands on the left third of the first line, the horizon in the middle.
    const rest = {x: .3, y: .5};
    const measure = () => {
      spans = plates.map(el => { const r = el.getBoundingClientRect(); return {left: r.left, width: Math.max(1, r.width)}; });
      rest.x = (spans[0].left + spans[0].width * .3) / innerWidth;
    };
    const glide = value => new Spring({duration: 1, bounce: 0, precision: .0005, value});
    // x is the pointer across the window (0..1), y down the hero (0..1). Each line turns x into a place on itself.
    const motion = new Motion({x: glide(rest.x), y: glide(rest.y)}, ({x, y}) => {
      const px = x * innerWidth, horizon = `${(28 + y * 44).toFixed(2)}%`;
      plates.forEach((el, i) => {
        const s = spans[i];
        if (s) el.style.setProperty('--sheen', `${(clamp((px - s.left) / s.width, -.2, 1.2) * 100).toFixed(2)}%`);
        el.style.setProperty('--horizon', horizon);
      });
    });
    hero.addEventListener('pointermove', event => {
      if (!pointerLive(event)) return;
      if (!spans.length) measure();
      const box = hero.getBoundingClientRect();
      motion.to({x: event.clientX / innerWidth, y: clamp((event.clientY - box.top) / box.height)});
    }, {passive: true});
    hero.addEventListener('pointerleave', () => motion.to({...rest}));
    const settle = () => { measure(); motion.to({...rest}, {immediate: true}); };
    let resizeFrame = 0;
    addEventListener('resize', () => { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(settle); }, {passive: true});
    (document.fonts?.ready || Promise.resolve()).then(settle);
  }

  /* ───── Warm-up: glass surfaces are drawn once, invisibly, before anyone needs them ─────
     The first draw of a blurred, shadowed surface makes the GPU build its shader programs. That costs tens of
     milliseconds and would land in the first frames of an opening menu, exactly where a spring moves fastest. */
  const warmers = [];
  let warmTimer = 0;
  function warm(build, {hold = 160} = {}) {
    warmers.push({build, hold});
    clearTimeout(warmTimer);
    warmTimer = setTimeout(() => window.requestIdleCallback ? window.requestIdleCallback(runWarm, {timeout: 3000}) : setTimeout(runWarm, 50), 2200);
  }
  function runWarm() {
    if (document.hidden) { document.addEventListener('visibilitychange', runWarm, {once: true}); return; }
    const layer = document.createElement('div');
    layer.className = 'gpu-warm'; layer.setAttribute('aria-hidden', 'true'); layer.inert = true;
    let hold = 160;
    warmers.splice(0).forEach(item => { try { const node = item.build(); if (node) { layer.append(node); hold = Math.max(hold, item.hold); } } catch {} });
    if (!layer.childElementCount) return;
    document.body.append(layer);
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => layer.remove(), hold)));
  }
  const ghost = (className, html, style = '') => {
    const node = document.createElement('div');
    node.className = className; node.innerHTML = html; node.style.cssText = style;
    node.querySelectorAll('[id]').forEach(child => child.removeAttribute('id'));
    return node;
  };
  if (menu) warm(() => {
    const veil = ghost('warm-veil', '');
    const panel = ghost('site-menu is-open is-settled', menu.innerHTML, 'left:24px;top:24px;width:380px;height:464px;display:block');
    Object.assign(panel.querySelector('.menu-body').style, {left: '0', top: '0', width: '380px', height: '464px'});
    // Rehearse the clipped, rounded glass of a half-open menu so its GPU programs exist before the first opening.
    panel.querySelector('.menu-body').style.clipPath = 'inset(40px 20px 120px 60px round 22px)';
    panel.querySelector('.menu-content').style.width = '380px';
    panel.querySelectorAll('.menu-links a').forEach(row => { row.style.opacity = '.6'; });
    panel.querySelector('.menu-content').style.filter = 'blur(1px)';
    const fragment = document.createDocumentFragment();
    fragment.append(veil, panel);
    const holder = document.createElement('div');
    holder.append(fragment);
    return holder;
  });
  warm(() => ghost('island', '<div class="island-glass" style="filter:blur(1px);transform:scale(.9)"><div class="island-content"><span class="island-icon"></span><span class="island-text"><strong>TRACE</strong><small>TRACE</small></span></div></div>', 'left:auto;right:24px;translate:none'));

  window.TraceUI = {openDialog, closeDialog, notify, warm, reducedMotion: reduceQuery, motionStopped, onMotion: listener => motionListeners.add(listener), onScroll: onScrollFrame, finePointer};
  window.TraceToast = message => notify({title: message});
  setPaused(false);
})();
