(() => {
 'use strict';
 const bank = window.DungeonSfxBank;
 const AudioContext = window.AudioContext || window.webkitAudioContext;
 if (!bank || !AudioContext) return;

 const bankUrl = new URL('assets/audio/shadowbound-sfx.mp3?v=1', document.currentScript.src);
 const maxVoices = 14;
 const heldRequests = [];
 const voices = new Set();
 const lastStarts = new Map();
 const lastVariants = new Map();
 let context, master, world, buffer, download, decoding;
 let retryAfter = 0, volume = .8, paused = true;

 function prefetch() {
  if (download || buffer || performance.now() < retryAfter) return;
  download = fetch(bankUrl)
   .then(response => {
    if (!response.ok) throw Error('Audio-Bank: ' + response.status);
    return response.arrayBuffer();
   })
   .catch(() => {
    download = null;
    retryAfter = performance.now() + 4000;
    return null;
   });
 }

 function ramp(param, value) {
  const now = context.currentTime;
  param.cancelScheduledValues(now);
  param.setTargetAtTime(value, now, .022);
 }

 function decode() {
  prefetch();
  if (!download || buffer || decoding) return;
  decoding = download.then(bytes => {
   if (bytes) return new Promise((resolve, reject) => context.decodeAudioData(bytes, resolve, reject));
   return null;
  }).then(decoded => {
   buffer = decoded;
   flushRequests();
  }).catch(() => {
   heldRequests.length = 0;
   download = null;
   retryAfter = performance.now() + 4000;
  }).finally(() => {
   decoding = null;
  });
 }

 function flushRequests() {
  if (!buffer || context.state !== 'running') return;
  for (const request of heldRequests.splice(0)) {
   if (performance.now() - request.time < 240) play(request.id, request.options);
  }
 }

 function unlock() {
  if (!volume || document.hidden) return;
  if (!context) {
   try {
    context = new AudioContext();
   } catch {
    return;
   }
   const limiter = context.createDynamicsCompressor();
   limiter.threshold.value = -10;
   limiter.knee.value = 8;
   limiter.ratio.value = 12;
   limiter.attack.value = .004;
   limiter.release.value = .13;
   master = context.createGain();
   world = context.createGain();
   master.gain.value = volume * volume;
   world.gain.value = paused ? .52 : 1;
   world.connect(master);
   master.connect(limiter).connect(context.destination);
   context.addEventListener('statechange', flushRequests);
  }
  if (context.state !== 'running') context.resume().catch(() => {});
  decode();
 }

 function setVolume(value) {
  volume = Math.max(0, Math.min(1, value));
  if (volume) prefetch();
  else heldRequests.length = 0;
  if (master) ramp(master.gain, document.hidden ? 0 : volume * volume);
 }

 function setPaused(value) {
  paused = value;
  if (world) ramp(world.gain, value ? .52 : 1);
  if (value) {
   for (let i = heldRequests.length - 1; i >= 0; i--) {
    if (heldRequests[i].options.scene === 'world') heldRequests.splice(i, 1);
   }
  }
 }

 function play(id, options = {}) {
  const clips = bank[id];
  if (!clips || !context || !volume || document.hidden) return false;
  if (!buffer || context.state !== 'running') {
   while (heldRequests.length && performance.now() - heldRequests[0].time >= 240) heldRequests.shift();
   if ((decoding || buffer) && heldRequests.length < 8) {
    heldRequests.push({id, options, time: performance.now()});
   }
   return false;
  }
  const { scene, gain = 1, pan = 0, priority = 1, cooldown = .045,
          group = id, rate = 1, variation = .033 } = options;
  if (gain <= .015) return false;
  const now = context.currentTime;
  if (now - (lastStarts.get(group) ?? -Infinity) < cooldown) return false;

  if (voices.size >= maxVoices) {
   let oldestQuiet = null;
   for (const voice of voices) {
    if (!oldestQuiet || voice.priority < oldestQuiet.priority) oldestQuiet = voice;
   }
   if (oldestQuiet.priority >= priority) return false;
   const stopAt = now + .012;
   oldestQuiet.gain.gain.setTargetAtTime(0, now, .003);
   oldestQuiet.source.stop(stopAt);
   voices.delete(oldestQuiet);
  }

  const previous = lastVariants.get(id);
  const index = clips.length < 2 ? 0 : (Math.floor(Math.random() * (clips.length - 1)) + (previous ?? -1) + 1) % clips.length;
  const [offset, duration] = clips[index];
  const speed = rate * (1 + (Math.random() * 2 - 1) * variation);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = speed;
  const fader = context.createGain();
  fader.gain.value = gain * (.96 + Math.random() * .08);
  source.connect(fader);
  const bus = scene === 'world' ? world : master;
  const panner = pan && context.createStereoPanner ? context.createStereoPanner() : null;
  if (panner) {
   panner.pan.value = pan;
   fader.connect(panner).connect(bus);
  } else {
   fader.connect(bus);
  }
  const voice = { source, gain: fader, priority, group };
  source.onended = () => {
   voices.delete(voice);
   source.disconnect();
   fader.disconnect();
   panner?.disconnect();
  };
  source.start(now, offset, duration);
  lastStarts.set(group, now);
  lastVariants.set(id, index);
  voices.add(voice);
  return true;
 }

 function stop(group) {
  const now = context?.currentTime ?? 0;
  for (let i = heldRequests.length - 1; i >= 0; i--) {
   const {id, options} = heldRequests[i];
   if ((options.group ?? id) === group) heldRequests.splice(i, 1);
  }
  for (const voice of voices) {
   if (voice.group !== group) continue;
   voice.gain.gain.setTargetAtTime(0, now, .008);
   voice.source.stop(now + .03);
   voices.delete(voice);
  }
 }

 document.addEventListener('visibilitychange', () => {
  if (!master) return;
  ramp(master.gain, document.hidden ? 0 : volume * volume);
  if (document.hidden) {
   heldRequests.length = 0;
   for (const voice of voices) voice.source.stop(context.currentTime + .04);
   voices.clear();
  }
 });
 for (const type of ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click']) {
  document.addEventListener(type, event => {
   if (event.isTrusted && !event.repeat) unlock();
  }, {capture: true, passive: true});
 }
 window.DungeonAudio = { play, setVolume, setPaused, unlock, stop };
})();
