(() => {
  const trigger = document.getElementById('introVideoOpen');
  const dialog = document.getElementById('introVideoDialog');
  if (!trigger || !dialog) return;
  const host = document.getElementById('introVideoPlayer');
  const status = document.getElementById('introVideoStatus');
  let video = null;
  trigger.addEventListener('click', () => {
    if (dialog.open) return;
    const portrait = window.matchMedia('(max-width: 767px) and (orientation: portrait)').matches;
    dialog.classList.toggle('hb-intro-portrait', portrait);
    status.textContent = '';
    video = document.createElement('video');
    video.controls = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.setAttribute('aria-label', 'Cómo jugar Happy Bingo, con narración en español');
    video.src = portrait ? '/media/happy-bingo-intro-mobile-v2.mp4' : '/media/happy-bingo-intro-desktop-v2.mp4';
    video.addEventListener('error', () => {
      status.textContent = 'No se pudo cargar el video. Revisa tu conexión y vuelve a abrirlo. También puedes leer las instrucciones de la pantalla inicial.';
    });
    host.replaceChildren(video);
    dialog.showModal();
    const activeVideo = video;
    video.play().catch(() => {
      if (dialog.open && video === activeVideo) status.textContent = 'Pulsa reproducir para comenzar.';
    });
  });
  document.getElementById('introVideoClose').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
      video = null;
    }
    host.replaceChildren();
    status.textContent = '';
    trigger.focus({preventScroll: true});
  });
})();
