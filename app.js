/* Interfaz: bienvenida, contador, carta, recuerdos, ajustes. */
(() => {
  'use strict';

  const STORE = 'flores-amarillas:v1';
  const MAX_MEMORIES = 24;
  const PHRASES = [
    'Contigo todo florece', 'Eres mi razón de sonreír', 'Te elegiría en cada primavera',
    'Mi lugar favorito eres tú', 'Amarillo, como tu sonrisa', 'Gracias por existir',
    'Contigo me siento en casa', 'Tú haces brillar mis días', 'Eres mi sol', 'Te quiero más que ayer'
  ];
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = (s, r = document) => r.querySelector(s);
  const clone = o => JSON.parse(JSON.stringify(o));

  function h(tag, props = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else if (v !== false && v != null) el.setAttribute(k, v);
    }
    for (const kid of kids.flat()) if (kid != null) el.append(kid);
    return el;
  }

  /* ---------- Datos ---------- */
  const defaults = { nombre1: '', nombre2: '', fecha: '', carta: '', musica: '', recuerdos: [] };
  let data = load();

  function load() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (_) { /* sin almacenamiento */ }
    return { ...defaults, ...clone(window.FLORES_CONFIG || {}), ...saved };
  }
  function persist() {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        nombre1: data.nombre1, nombre2: data.nombre2, fecha: data.fecha, carta: data.carta, recuerdos: data.recuerdos
      }));
      return true;
    } catch (_) { return false; }
  }

  /* ---------- Modal ---------- */
  const modal = $('#modal'), modalBody = $('#modalBody');
  let lastFocus = null, typer = null;

  function openModal(node, variant = '') {
    if (!modal.classList.contains('is-open')) lastFocus = document.activeElement;
    stopTyping();
    modalBody.replaceChildren(node);
    modal.className = 'modal is-open' + (variant ? ' modal--' + variant : '');
    modal.setAttribute('aria-hidden', 'false'); modal.inert = false;
    $('.modal__close').focus({ preventScroll: true });
    if (node.start) node.start();
  }
  function closeModal() {
    if (!modal.classList.contains('is-open')) return;
    stopTyping();
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true'); modal.inert = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  modal.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  /* ---------- Piezas visuales ---------- */
  function flowerSVG(cls) {
    const wrap = h('div', { class: cls || 'flower-art', 'aria-hidden': 'true' });
    let petals = '';
    for (let i = 0; i < 14; i++) petals += `<ellipse cx="0" cy="-30" rx="9" ry="20" transform="rotate(${i * 360 / 14})" fill="${i % 2 ? '#ffd23a' : '#f7b500'}"/>`;
    wrap.innerHTML = `<svg viewBox="-50 -50 100 100">${petals}<circle r="15" fill="#6b3f12"/><circle r="9" fill="#4a2b0b"/></svg>`;
    return wrap;
  }

  // emblema de la bienvenida
  (() => {
    const g = $('#emblemPetals'); let s = '';
    for (let i = 0; i < 14; i++) s += `<ellipse cx="0" cy="-30" rx="9" ry="20" transform="rotate(${i * 360 / 14})" fill="${i % 2 ? '#ffd23a' : '#f7b500'}"/>`;
    g.innerHTML = s;
  })();

  /* ---------- Recuerdo ---------- */
  function memoryView(i) {
    const list = data.recuerdos, m = list[i];
    const art = m.foto
      ? h('figure', { class: 'polaroid' }, h('img', { src: m.foto, alt: m.titulo || 'Recuerdo' }))
      : flowerSVG('memory__flower');
    const nav = list.length > 1 ? h('div', { class: 'memory__nav' },
      h('button', { class: 'btn btn--ghost', type: 'button', 'aria-label': 'Recuerdo anterior', onclick: () => openModal(memoryView((i - 1 + list.length) % list.length)) }, '‹'),
      h('span', {}, `${i + 1} / ${list.length}`),
      h('button', { class: 'btn btn--ghost', type: 'button', 'aria-label': 'Recuerdo siguiente', onclick: () => openModal(memoryView((i + 1) % list.length)) }, '›')
    ) : null;
    return h('article', { class: 'memory' }, art,
      m.titulo ? h('h2', { class: 'memory__title' }, m.titulo) : null,
      m.texto ? h('p', { class: 'memory__text' }, m.texto) : null, nav);
  }

  function galleryView() {
    const list = data.recuerdos;
    if (!list.length) {
      return h('div', { class: 'empty' }, flowerSVG('memory__flower'),
        h('h2', { class: 'memory__title' }, 'Aún no hay recuerdos'),
        h('p', { class: 'memory__text' }, 'Agrégalos con fotos desde Ajustes y aparecerán aquí y en las flores que brillan.'),
        h('button', { class: 'btn btn--primary', type: 'button', onclick: () => openModal(settingsView(), 'wide') }, 'Ir a Ajustes'));
    }
    return h('div', {}, h('h2', { class: 'modal__title' }, 'Nuestros recuerdos'),
      h('div', { class: 'gallery' }, list.map((m, i) =>
        h('button', { class: 'polaroid polaroid--small', type: 'button', onclick: () => openModal(memoryView(i)) },
          m.foto ? h('img', { src: m.foto, alt: '', loading: 'lazy' }) : flowerSVG('polaroid__flower'),
          h('span', {}, m.titulo || 'Recuerdo')))));
  }

  /* ---------- Carta ---------- */
  function stopTyping() { if (typer) { clearInterval(typer); typer = null; } }

  function letterView() {
    const text = (data.carta || '').trim() || 'Aún no has escrito tu carta. Puedes hacerlo en Ajustes.';
    const typed = h('span', {}), rest = h('span', { class: 'letter__rest' }, text);
    const body = h('div', { class: 'letter__text' }, typed, rest);
    const sign = h('p', { class: 'letter__sign' }, data.nombre1 ? `Con todo mi amor, ${data.nombre1}` : 'Con todo mi amor');
    const article = h('article', { class: 'letter' },
      h('p', { class: 'letter__to' }, data.nombre2 ? `Para ${data.nombre2},` : 'Para ti,'), body, sign);
    let i = 0;
    const finish = () => { stopTyping(); typed.textContent = text; rest.textContent = ''; sign.classList.add('is-in'); };
    // la escritura arranca cuando la ventana ya está abierta (openModal llama a start)
    article.start = () => {
      if (reduced) { finish(); return; }
      typer = setInterval(() => {
        i += 2; typed.textContent = text.slice(0, i); rest.textContent = text.slice(i);
        if (i >= text.length) finish();
      }, 34);
    };
    body.addEventListener('click', finish);
    return article;
  }

  /* ---------- Ajustes ---------- */
  function fileToDataURL(file, max = 900) {
    return createImageBitmap(file).then(bmp => {
      const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.8);
    });
  }

  function settingsView() {
    const draft = clone(data);
    const field = (label, control) => h('label', { class: 'field' }, h('span', {}, label), control);
    const n1 = h('input', { type: 'text', value: draft.nombre1, maxlength: '30', placeholder: 'Tu nombre' });
    const n2 = h('input', { type: 'text', value: draft.nombre2, maxlength: '30', placeholder: 'El nombre de tu pareja' });
    const fecha = h('input', { type: 'date', value: draft.fecha });
    const carta = h('textarea', { rows: '8', placeholder: 'Escribe aquí tu carta…' }, draft.carta);
    const list = h('div', { class: 'mem-list' });
    const msg = h('p', { class: 'form__msg', role: 'status' });
    const picker = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });

    let replaceIndex = -1;
    function renderList() {
      list.replaceChildren(...draft.recuerdos.map((m, i) => {
        const thumb = h('button', { class: 'mem-row__thumb', type: 'button', 'aria-label': 'Cambiar foto', title: 'Cambiar foto',
          onclick: () => { replaceIndex = i; picker.click(); } },
          m.foto ? h('img', { src: m.foto, alt: '' }) : h('span', {}, '+ foto'));
        const title = h('input', { type: 'text', value: m.titulo || '', maxlength: '60', placeholder: 'Título', oninput: e => { m.titulo = e.target.value; } });
        const txt = h('textarea', { rows: '2', maxlength: '300', placeholder: 'Lo que quieres recordar…', oninput: e => { m.texto = e.target.value; } }, m.texto || '');
        const del = h('button', { class: 'mem-row__del', type: 'button', 'aria-label': 'Eliminar recuerdo', title: 'Eliminar',
          onclick: () => { draft.recuerdos.splice(i, 1); renderList(); } }, '×');
        return h('div', { class: 'mem-row' }, thumb, h('div', { class: 'mem-row__fields' }, title, txt), del);
      }));
    }

    picker.addEventListener('change', async () => {
      const files = [...picker.files]; picker.value = '';
      msg.textContent = files.length ? 'Preparando fotos…' : '';
      try {
        for (const file of files) {
          const url = await fileToDataURL(file);
          if (replaceIndex >= 0) { draft.recuerdos[replaceIndex].foto = url; replaceIndex = -1; }
          else if (draft.recuerdos.length < MAX_MEMORIES) draft.recuerdos.push({ foto: url, titulo: '', texto: '' });
        }
        msg.textContent = '';
      } catch (_) { msg.textContent = 'No pude leer una de las imágenes. Prueba con otra.'; }
      replaceIndex = -1; renderList();
    });

    const save = () => {
      data = { ...data, nombre1: n1.value.trim(), nombre2: n2.value.trim(), fecha: fecha.value, carta: carta.value,
        recuerdos: draft.recuerdos.filter(m => m.foto || m.titulo || m.texto) };
      if (!persist()) { msg.textContent = 'No se pudo guardar: las fotos pesan demasiado. Quita algunas e inténtalo de nuevo.'; return; }
      apply(); closeModal();
    };
    const reset = () => {
      if (!confirm('¿Borrar lo que guardaste en Ajustes y volver a lo que dice config.js?')) return;
      try { localStorage.removeItem(STORE); } catch (_) { /* nada */ }
      data = load(); apply(); closeModal();
    };

    renderList();
    return h('form', { class: 'form', onsubmit: e => { e.preventDefault(); save(); } },
      h('h2', { class: 'modal__title' }, 'Ajustes del jardín'),
      h('div', { class: 'form__row' }, field('Tu nombre', n1), field('Su nombre', n2)),
      field('Desde cuándo están juntos', fecha),
      field('Tu carta', carta),
      h('div', { class: 'form__mems' },
        h('div', { class: 'form__mems-head' }, h('span', {}, 'Recuerdos (cada uno vive en una flor)'),
          h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => { replaceIndex = -1; picker.click(); } }, '+ Añadir fotos'),
          h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => { draft.recuerdos.push({ foto: '', titulo: '', texto: '' }); renderList(); } }, '+ Sin foto')),
        list, picker),
      msg,
      h('div', { class: 'form__actions' },
        h('button', { class: 'btn btn--ghost', type: 'button', onclick: reset }, 'Restablecer'),
        h('button', { class: 'btn btn--primary', type: 'submit' }, 'Guardar y replantar')));
  }

  /* ---------- Contador ---------- */
  const counter = $('#counter'), cells = $('#counterCells');
  const UNITS = [['años', 'año'], ['meses', 'mes'], ['días', 'día'], ['horas', 'hora'], ['min', 'min'], ['seg', 'seg']];
  let cellEls = [], countdownTimer = null;

  function addMonths(d, k) {
    const r = new Date(d), day = r.getDate();
    r.setDate(1); r.setMonth(r.getMonth() + k);
    r.setDate(Math.min(day, new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate()));
    return r;
  }
  function diff(from, to) {
    let months = (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth();
    if (addMonths(from, months) > to) months--;
    let rest = to - addMonths(from, months);
    const days = Math.floor(rest / 864e5); rest %= 864e5;
    const hours = Math.floor(rest / 36e5); rest %= 36e5;
    const mins = Math.floor(rest / 6e4), secs = Math.floor((rest % 6e4) / 1e3);
    return [Math.floor(months / 12), months % 12, days, hours, mins, secs];
  }
  function parseDate(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }

  function setupCounter() {
    clearInterval(countdownTimer);
    const start = parseDate(data.fecha);
    counter.hidden = !start;
    if (!start) return;
    cellEls = UNITS.map(() => ({ wrap: h('div', { class: 'cell' }), num: h('strong', {}), lab: h('span', {}) }));
    cellEls.forEach(c => c.wrap.append(c.num, c.lab));
    cells.replaceChildren(...cellEls.map(c => c.wrap));
    const tick = () => {
      const now = new Date(), future = start > now;
      $('#counterLabel').textContent = future ? 'Faltan' : 'Juntos desde hace';
      const v = future ? diff(now, start) : diff(start, now);
      cellEls.forEach((c, i) => {
        c.num.textContent = v[i];
        c.lab.textContent = UNITS[i][v[i] === 1 ? 1 : 0];
        c.wrap.hidden = (i === 0 && v[0] === 0) || (i === 1 && v[0] === 0 && v[1] === 0);
      });
    };
    tick(); countdownTimer = setInterval(tick, 1000);
  }

  /* ---------- Música ---------- */
  let audio = null;
  const musicBtn = $('[data-action="music"]');
  function setupMusic() {
    if (audio) { audio.pause(); audio = null; }
    musicBtn.hidden = !data.musica;
    if (data.musica) { audio = new Audio(data.musica); audio.loop = true; audio.volume = 0.5; }
    musicBtn.setAttribute('aria-pressed', 'false');
  }

  /* ---------- Aplicar datos ---------- */
  function apply() {
    const a = data.nombre1, b = data.nombre2;
    $('#introFor').textContent = b || 'ti';
    $('#hudNames').textContent = a && b ? `${a} & ${b}` : (b || a || 'Nosotros');
    document.title = b ? `Flores amarillas para ${b}` : 'Flores amarillas';
    setupCounter(); setupMusic();
    Garden.setMemories(data.recuerdos.length);
  }

  /* ---------- Arranque ---------- */
  const hud = $('#hud'), intro = $('#intro'), hint = $('#hint'), floats = $('#floats');

  Garden.init($('#garden'), {
    onMemory: i => openModal(memoryView(i)),
    onPlant: (x, y) => {
      const el = h('div', { class: 'float' }, PHRASES[Math.floor(Math.random() * PHRASES.length)]);
      el.style.left = clamp(x, 90, window.innerWidth - 90) + 'px'; el.style.top = Math.max(y, 60) + 'px';
      el.addEventListener('animationend', () => el.remove());
      floats.append(el);
      hint.classList.add('is-gone');
    }
  });
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  apply();
  $('#garden').addEventListener('pointerdown', () => hint.classList.add('is-gone'), { once: true });

  $('#enter').addEventListener('click', () => {
    document.body.classList.add('entered');
    intro.inert = true; hud.inert = false;
    if (audio) { audio.play().then(() => musicBtn.setAttribute('aria-pressed', 'true')).catch(() => {}); }
  });

  let night = false;
  $('.dock').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]'); if (!btn) return;
    switch (btn.dataset.action) {
      case 'letter': openModal(letterView(), 'letter'); break;
      case 'memories': openModal(galleryView(), 'wide'); break;
      case 'settings': openModal(settingsView(), 'wide'); break;
      case 'rain': Garden.rain(); hint.classList.add('is-gone'); break;
      case 'theme':
        night = !night; Garden.setNight(night);
        document.body.classList.toggle('night', night);
        btn.setAttribute('aria-pressed', String(night));
        $('#themeLabel').textContent = night ? 'Día' : 'Noche';
        break;
      case 'music':
        if (!audio) break;
        if (audio.paused) audio.play().then(() => btn.setAttribute('aria-pressed', 'true')).catch(() => {});
        else { audio.pause(); btn.setAttribute('aria-pressed', 'false'); }
        break;
    }
  });
})();
