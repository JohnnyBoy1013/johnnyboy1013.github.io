const media = document.querySelector('.paper-media');
const video = media.querySelector('video');
const canvas = media.querySelector('canvas');
const context = canvas.getContext('2d');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let frameId;

function drawFrame() {
  if (video.paused) return;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  frameId = requestAnimationFrame(drawFrame);
}

function playVideo() {
  video.play().then(() => {
    if (video.paused) return;
    drawFrame();
    media.classList.add('is-playing');
    media.setAttribute('aria-pressed', 'true');
  }).catch(() => {});
}

function stopVideo() {
  video.pause();
  cancelAnimationFrame(frameId);
  video.currentTime = 0;
  media.classList.remove('is-playing');
  media.setAttribute('aria-pressed', 'false');
}

media.addEventListener('pointerenter', event => {
  if (event.pointerType === 'mouse' && !reducedMotion.matches) playVideo();
});
media.addEventListener('pointerleave', event => {
  if (event.pointerType === 'mouse') stopVideo();
});
media.addEventListener('blur', stopVideo);
media.addEventListener('click', () => video.paused ? playVideo() : stopVideo());
media.addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    video.paused ? playVideo() : stopVideo();
  }
});
document.querySelector('#year').textContent = new Date().getFullYear();

const visitorDetails = document.querySelector('.visitors-section details');
visitorDetails.addEventListener('toggle', () => {
  const widget = visitorDetails.querySelector('script[data-src]');
  if (visitorDetails.open && widget) {
    const script = document.createElement('script');
    for (const [key, value] of Object.entries(widget.dataset)) {
      if (key !== 'src') script.dataset[key] = value;
    }
    script.src = widget.dataset.src;
    widget.replaceWith(script);
  }
});
