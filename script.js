const media = document.querySelector('.paper-media');
const video = media.querySelector('video');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function playVideo() {
  video.play().then(() => {
    if (video.paused) return;
    media.classList.add('is-playing');
    media.setAttribute('aria-pressed', 'true');
  }).catch(() => {});
}

function stopVideo() {
  video.pause();
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
