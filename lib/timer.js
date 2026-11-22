// Floating countdown timer with fixed end timestamps, Screen Wake Lock, WebAudio chime, and visibility sync.

const stamp = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export function createTimer({
  barSelector = '#timer-bar',
  timeSelector = '#timer-time',
  labelSelector = '#timer-label',
  fillSelector = '#timer-fill',
  chimeHz = 784,
} = {}) {
  const bar = document.querySelector(barSelector);
  const timeEl = document.querySelector(timeSelector);
  const titleEl = document.querySelector(labelSelector);
  const fillEl = document.querySelector(fillSelector);

  let end = 0;
  let total = 0;
  let startedAt = 0;
  let ticker = null;
  let audio = null;
  let beepOn = true;
  let wake = null;
  let finishCb = null;

  async function keepAwake(on) {
    try {
      if (on && !wake && navigator.wakeLock) {
        wake = await navigator.wakeLock.request('screen');
        wake.addEventListener?.('release', () => { wake = null; });
      }
      if (!on && wake) { await wake.release(); wake = null; }
    } catch { wake = null; }
  }

  function beep() {
    if (!beepOn || !audio) return;
    [0, 0.25].forEach(at => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.frequency.value = chimeHz;
      gain.gain.value = 0.14;
      osc.connect(gain).connect(audio.destination);
      osc.start(audio.currentTime + at);
      osc.stop(audio.currentTime + at + 0.16);
    });
  }

  function update() {
    const rem = end - Date.now();
    const left = Math.ceil(rem / 1000);
    if (left <= 0) {
      const elapsed = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      const cb = finishCb;
      stop();
      if (rem > -3000) {
        beep();
        navigator.vibrate?.([180, 90, 180]);
      }
      cb?.(elapsed);
      return;
    }
    if (timeEl) timeEl.textContent = stamp(left);
    if (fillEl && total > 0) fillEl.style.width = `${Math.max(0, Math.min(100, (rem / total) * 100))}%`;
  }

  function stop() {
    const elapsed = startedAt ? Math.max(0, Math.round((Date.now() - startedAt) / 1000)) : 0;
    clearInterval(ticker);
    ticker = null;
    startedAt = 0;
    finishCb = null;
    if (bar) bar.hidden = true;
    keepAwake(false);
    return elapsed;
  }

  function start(seconds, { beep: wantBeep = true, label = 'Timer', onFinish = null } = {}) {
    beepOn = wantBeep;
    finishCb = onFinish;
    if (titleEl) titleEl.textContent = label;
    if (wantBeep) {
      try {
        audio ||= new AudioContext();
        audio.resume();
      } catch { audio = null; }
    }
    total = seconds * 1000;
    startedAt = Date.now();
    end = startedAt + total;
    if (bar) bar.hidden = false;
    update();
    clearInterval(ticker);
    ticker = setInterval(update, 250);
    keepAwake(true);
  }

  bar?.addEventListener('click', e => {
    const action = e.target.closest('[data-timer]')?.dataset.timer;
    if (!action) return;
    if (action === 'stop') {
      const cb = finishCb;
      const elapsed = stop();
      if (elapsed >= 5) cb?.(elapsed);
      return;
    }
    const delta = Number(action) * 1000;
    end = Math.max(Date.now() + 1000, end + delta);
    total = Math.max(total, end - Date.now());
    update();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ticker) {
      update();
      if (ticker) keepAwake(true);
    }
  });

  return { start, stop, isRunning: () => Boolean(ticker) };
}
