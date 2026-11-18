(() => {
 'use strict';
 const bank = window.DungeonSfxBank;
 const foley = window.DungeonFoleyBank;
 const packages = window.DungeonPackageBank;
 const AudioContext = window.AudioContext || window.webkitAudioContext;
 if (!bank || !AudioContext) return;

 const scriptUrl = document.currentScript.src;
 const audioAsset = name => ({url: new URL('assets/audio/' + name + '.mp3?v=1', scriptUrl)});
 const effects = audioAsset('shadowbound-sfx');
 const stone = foley && audioAsset('stone-steps');
 const packSfx = packages && audioAsset('pack-sfx');
 const ambient = Object.fromEntries(['jungle','waterfall','river'].map(name => [name,audioAsset(name)]));
 for (const name of ['amb_dungeon','amb_rain']) {
  ambient[name] = {...audioAsset(name), start: 0, end: 30, overlap: .8};
 }
 const musicTracks = {
  title: {...audioAsset('01_main_theme'), start: .54, end: 232, overlap: 5.5},
  creator: {...audioAsset('02_character_creation'), start: .18, end: 196.6, overlap: 5.2}
 };
 const maxVoices = 14;
 const heldRequests = [];
 const voices = new Set();
 const lastStarts = new Map();
 const lastVariants = new Map();
 let context, master, world, music;
 let volume = .8, paused = true;
 let musicVolume = .65, musicScene = null, musicVoice = null;

 function prefetch(asset) {
  if (!asset || asset.buffer || performance.now() < (asset.retryAfter ?? 0)) return;
  if (asset.download) return asset.download;
  return asset.download = fetch(asset.url)
   .then(response => {
    if (!response.ok) throw Error('Audio: ' + response.status);
    return response.arrayBuffer();
   })
   .catch(() => {
    asset.download = null;
    asset.retryAfter = performance.now() + 4000;
    return null;
   });
 }

 function ramp(param, value, seconds = .022) {
  const now = context.currentTime;
  if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(now);
  else param.cancelScheduledValues(now);
  param.setTargetAtTime(value, now, seconds);
 }

 function decode(asset, decoder = context) {
  if (!asset || asset.buffer) return;
  if (asset.decoding) return asset.decoding;
  prefetch(asset);
  if (!asset.download) return;
  return asset.decoding = asset.download.then(bytes => {
   if (bytes) return new Promise((resolve, reject) => decoder.decodeAudioData(bytes, resolve, reject));
   return null;
  }).then(decoded => {
   if (decoded) {
    asset.buffer = decoded;
    if (asset.overlap) {
     blendLoop(asset);
     syncMusic();
    }
   }
   if (context) flushRequests();
  }).catch(() => {
   asset.retryAfter = performance.now() + 4000;
  }).finally(() => {
   asset.download = null;
   asset.decoding = null;
  });
 }

 function assetFor(id) {
  return packages?.[id] ? packSfx : foley?.[id] ? stone : effects;
 }

 function flushRequests() {
  if (context.state !== 'running') return;
  for (const request of heldRequests.splice(0)) {
   if (performance.now() - request.time >= 240) continue;
   if (assetFor(request.id).buffer) play(request.id, request.options);
   else heldRequests.push(request);
  }
 }

 function unlock() {
  if ((!volume && !musicVolume) || document.hidden) return;
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
   music = context.createGain();
   master.gain.value = volume * volume;
   world.gain.value = paused ? .52 : 1;
   music.gain.value = musicLevel();
   world.connect(master);
   music.connect(limiter);
   master.connect(limiter).connect(context.destination);
   context.addEventListener('statechange', () => {
    flushRequests();
    syncMusic();
   });
  }
  if (context.state !== 'running') context.resume().catch(() => {});
  if (volume) {
   decode(effects);
   decode(stone);
   decode(packSfx);
  }
  syncMusic();
 }

 function setVolume(value) {
  volume = Math.max(0, Math.min(1, value));
  if (volume) {
   prefetch(effects);
   prefetch(stone);
   prefetch(packSfx);
  } else {
   heldRequests.length = 0;
   stopAmbience();
  }
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

 function musicLevel() {
  return document.hidden ? 0 : .75 * musicVolume * musicVolume;
 }

 function setMusicVolume(value) {
  musicVolume = Math.max(0, Math.min(1, value));
  if (music) ramp(music.gain, musicLevel());
  if (musicVolume) prefetch(musicTracks[musicScene]);
  syncMusic();
 }

 function prepareMusic(scene) {
  const asset = musicTracks[scene];
  const OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (asset?.buffer || asset?.decoding) return asset.decoding;
  try {
   if (OfflineContext) return decode(asset, new OfflineContext(2, 1, 44100));
  } catch {}
  return prefetch(asset);
 }

 function setMusicScene(scene) {
  musicScene = scene;
  if (musicVolume) prefetch(musicTracks[scene]);
  syncMusic();
 }

 function blendLoop(asset) {
  const buffer = asset.buffer;
  const rate = buffer.sampleRate;
  const start = Math.min(buffer.length - 1, Math.round(asset.start * rate));
  const end = Math.min(buffer.length, Math.round(asset.end * rate));
  const count = Math.min(Math.round(asset.overlap * rate), Math.floor((end - start) / 2));
  const channels = Array.from({length: buffer.numberOfChannels}, (_, channel) => buffer.getChannelData(channel));
  // Finish the tail with the opening samples, then wrap to the next sample of the intro.
  for (let i = 0; count > 1 && i < count; i++) {
   const angle = Math.PI / 2 * i / (count - 1);
   const out = Math.cos(angle), incoming = Math.sin(angle);
   for (const samples of channels) {
    const tail = end - count + i;
    samples[tail] = samples[tail] * out + samples[start + i] * incoming;
   }
  }
  asset.offset = start / rate;
  asset.loopStart = (start + (count > 1 ? count : 0)) / rate;
  asset.loopEnd = end / rate;
 }

 function syncMusic() {
  const asset = musicVolume ? musicTracks[musicScene] : null;
  if (musicVoice && musicVoice.asset !== asset) {
   ramp(musicVoice.fader.gain, 0, .16);
   musicVoice.source.stop(context.currentTime + .85);
   musicVoice = null;
  }
  if (!asset || musicVoice || document.hidden || context?.state !== 'running') return;
  if (!asset.buffer) {
   decode(asset);
   return;
  }
  const source = context.createBufferSource();
  const fader = context.createGain();
  source.buffer = asset.buffer;
  source.loop = true;
  source.loopStart = asset.loopStart;
  source.loopEnd = asset.loopEnd;
  fader.gain.value = 0;
  source.connect(fader).connect(music);
  source.onended = () => {
   source.disconnect();
   fader.disconnect();
  };
  musicVoice = {asset,source,fader};
  source.start(0, asset.offset);
  ramp(fader.gain, 1, .16);
 }

 function play(id, options = {}) {
  const clips = packages?.[id] ?? foley?.[id] ?? bank[id];
  if (!clips || !context || !volume || document.hidden) return false;
  const asset = assetFor(id);
  const buffer = asset.buffer;
  if (!buffer || context.state !== 'running') {
   decode(asset);
   while (heldRequests.length && performance.now() - heldRequests[0].time >= 240) heldRequests.shift();
   if ((asset.decoding || buffer) && heldRequests.length < 8) {
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
  const avoidsRepeat = clips.length > 1 && previous !== undefined;
  const draw = Math.floor(Math.random() * (clips.length - Number(avoidsRepeat)));
  const index = avoidsRepeat && draw >= previous ? draw + 1 : draw;
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

 function startLoop(asset) {
  const source = context.createBufferSource();
  source.buffer = asset.buffer;
  source.loop = true;
  if (asset.loopEnd) {source.loopStart = asset.loopStart;source.loopEnd = asset.loopEnd;}
  const fader = context.createGain();
  fader.gain.value = 0;
  source.connect(fader);
  const panner = context.createStereoPanner ? context.createStereoPanner() : null;
  if (panner) fader.connect(panner).connect(world);
  else fader.connect(world);
  source.onended = () => {
   source.disconnect();
   fader.disconnect();
   panner?.disconnect();
  };
  source.start(0, asset.offset ?? 0);
  asset.voice = {source,fader,panner,gain:0,pan:0};
 }

 function stopLoop(asset) {
  const voice = asset.voice;
  if (!voice) return;
  ramp(voice.fader.gain, 0, .025);
  voice.source.stop(context.currentTime + .14);
  asset.voice = null;
 }

 function stopAmbience() {
  for (const asset of Object.values(ambient)) stopLoop(asset);
 }

 function setAmbience(mix) {
  if (!context || !volume || context.state !== 'running' || document.hidden) return;
  for (const [name,asset] of Object.entries(ambient)) {
   const {gain = 0, pan = 0} = mix[name] ?? {};
   const target = gain > .004 ? gain : 0;
   if (target && !asset.voice) {
    if (!asset.buffer) {
     decode(asset);
     continue;
    }
    startLoop(asset);
   }
   const voice = asset.voice;
   if (!voice) continue;
   if (voice.gain !== target) {
    ramp(voice.fader.gain, target, target ? .19 : .23);
    voice.gain = target;
    voice.silentSince = target ? null : context.currentTime;
   }
   if (voice.panner && voice.pan !== pan) {
    ramp(voice.panner.pan, pan, .15);
    voice.pan = pan;
   }
   if (voice.silentSince != null && context.currentTime - voice.silentSince > 1.2) stopLoop(asset);
  }
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
  ramp(music.gain, musicLevel());
  if (document.hidden) {
   heldRequests.length = 0;
   stopAmbience();
   for (const voice of voices) voice.source.stop(context.currentTime + .04);
   voices.clear();
  } else {
   syncMusic();
  }
 });
 for (const type of ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click']) {
  document.addEventListener(type, event => {
   if (event.isTrusted && !event.repeat) unlock();
  }, {capture: true, passive: true});
 }
 window.DungeonAudio = {play,setVolume,setPaused,setAmbience,setMusicVolume,setMusicScene,prepareMusic,unlock,stop};
})();
