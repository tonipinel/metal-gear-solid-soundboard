import { Howl, Howler } from 'howler';

const STORED = {
  music: { volume: 'mgs-volume-music', muted: 'mgs-muted-music' },
  sound: { volume: 'mgs-volume-sfx', muted: 'mgs-muted-sfx' }
};

const MASTER_KEY = 'mgs-master-level';

const readVolume = (key, fallback) => {
  const stored = parseFloat(localStorage.getItem(key));
  return Number.isFinite(stored) ? stored : fallback;
};

// iOS keeps the audio level under the user's physical control: setting volume
// on an <audio> element does nothing and reading it always returns 1, so every
// track would play at full level and the music would bury the voices. Where
// that is the case we stream through Web Audio instead, which applies volume
// with a gain node. Feature detection, not user agent sniffing.
const canControlElementVolume = () => {
  try {
    const probe = new Audio();
    probe.volume = 0.5;
    return probe.volume === 0.5;
  } catch (error) {
    return false;
  }
};

// Recent WebKit accepts the assignment and reports the value back while still
// ignoring it during playback, so the probe above is not enough on its own:
// every iPhone and iPad goes through Web Audio regardless of what it claims.
const isAppleTouchDevice = () => {
  const ua = navigator.userAgent || '';
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(ua) || iPadOS;
};

// Escape hatch for debugging the Web Audio path on a desktop browser
const FORCED = localStorage.getItem('mgs-force-engine');

const USE_HTML5 = FORCED
  ? FORCED === 'html5'
  : canControlElementVolume() && !isAppleTouchDevice();

class AudioService {
  constructor() {
    this.usesHtml5 = USE_HTML5;
    this.sounds = {};
    this.currentStage = null;
    this.timeouts = [];
    this.intervals = [];
    this.activeOverride = null;
    this.loadRetries = {};
    this.lastError = null;
    this.primed = false;
    
    // Music and effects carry their own level, on top of each sound's base volume
    const legacyVolume = readVolume('mgs-master-volume', 1.0);

    // One dial over the mix: it scales both channels and leaves their balance alone
    this.master = readVolume(MASTER_KEY, 1.0);

    this.channels = {
      music: {
        volume: readVolume(STORED.music.volume, legacyVolume),
        muted: localStorage.getItem(STORED.music.muted) === 'true'
      },
      sound: {
        volume: readVolume(STORED.sound.volume, legacyVolume),
        muted: localStorage.getItem(STORED.sound.muted) === 'true'
      }
    };
    
    // For error handling
    this.errorListeners = [];
    
    // For playing override listeners
    this.overrideUpdateListeners = [];
  }

  // Error event subscription
  onError(listener) {
    this.errorListeners.push(listener);
    return () => {
      this.errorListeners = this.errorListeners.filter(l => l !== listener);
    };
  }

  onOverrideUpdate(listener) {
    this.overrideUpdateListeners.push(listener);
    return () => {
      this.overrideUpdateListeners = this.overrideUpdateListeners.filter(l => l !== listener);
    };
  }

  // Notify all listeners about an error
  emitError(error) {
    console.error(`Failed to load audio source '${error.id}' (error code ${error.code})`, error);
    this.errorListeners.forEach(listener => listener(error));
  }

  // iOS only wires the context to the speaker once a silent buffer has played
  // inside a user gesture. Howler does this on its own document listener, but
  // that runs after React's click handler, so the very first track of a
  // session plays inaudibly. Priming in the capture phase gets there first.
  // WebKit only routes audio to the speaker once something audible has played
  // inside a user gesture. A silent buffer does not count, which is why a
  // track that finishes downloading after the tap plays into the void. The
  // first gesture of a session therefore gets a short codec-style blip.
  isOpenerReady() {
    const opener = this.openerId ? this.sounds[this.openerId] : null;
    return !!opener && opener.state() === 'loaded';
  }

  // Called from the intro screen: a real sound played inside a real tap, which
  // is what makes iOS route audio to the speaker for the rest of the session
  startSession() {
    this.resumeContext();

    const opener = this.openerId ? this.sounds[this.openerId] : null;

    if (opener) {
      if (opener.state() === 'unloaded') opener.load();
      opener.play();
    }

    this.primed = true;

    // Now that the context is running, the queued preloads can decode safely
    (this.pendingPreload || []).forEach(id => {
      const sound = this.sounds[id];
      if (sound && sound.state() === 'unloaded') sound.load();
    });
  }

  // Fallback for gestures outside the intro screen
  primeAudio() {
    const ctx = Howler.ctx;
    if (!ctx) return;

    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      ctx.resume().catch(() => {});
    }

    if (this.primed) return;

    const opener = this.openerId ? this.sounds[this.openerId] : null;

    if (opener && opener.state() === 'loaded') {
      opener.play();
      this.primed = true;
      return;
    }

    // Not ready yet: keep the context awake and try again on the next gesture
    if (opener && opener.state() === 'unloaded') opener.load();
  }

  listenForGestures() {
    const prime = () => this.primeAudio();

    ['touchstart', 'touchend', 'mousedown', 'click', 'keydown'].forEach(event => {
      document.addEventListener(event, prime, { capture: true });
    });
  }

  // iOS starts the audio context suspended and only lets it resume inside a
  // user gesture, so every play path nudges it first
  resumeContext() {
    const ctx = Howler.ctx;

    if (ctx && ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      ctx.resume().catch(() => {});
    }
  }

  // Taps Howler's master gain to tell whether audio is actually flowing,
  // instead of trusting playing() which only reports intent
  measureSignal() {
    const ctx = Howler.ctx;
    if (!ctx || !Howler.masterGain) return null;

    if (!this.analyser) {
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyserData = new Uint8Array(this.analyser.fftSize);
      Howler.masterGain.connect(this.analyser);
    }

    this.analyser.getByteTimeDomainData(this.analyserData);

    let peak = 0;
    for (let i = 0; i < this.analyserData.length; i += 1) {
      peak = Math.max(peak, Math.abs(this.analyserData[i] - 128));
    }

    return peak;
  }

  getDiagnostics() {
    const ctx = Howler.ctx;
    const current = this.currentStage ? this.sounds[this.currentStage.music] : null;

    const music = this.channels.music;
    const sound = this.channels.sound;

    return {
      engine: this.usesHtml5 ? 'HTML5 audio' : 'Web Audio',
      context: ctx ? ctx.state : 'none',
      stage: this.currentStage ? this.currentStage.id : 'none',
      primed: this.primed ? 'yes' : 'no',
      track: current ? `${current.state()} / ${current.playing() ? 'playing' : 'silent'}` : 'none',
      master: this.master.toFixed(2),
      musicCh: `${music.volume.toFixed(2)}${music.muted ? ' MUTED' : ''}`,
      sfxCh: `${sound.volume.toFixed(2)}${sound.muted ? ' MUTED' : ''}`,
      trackGain: current ? current.volume().toFixed(3) : 'none',
      globalGain: typeof Howler.volume === 'function' ? String(Howler.volume()) : '?',
      signal: (() => { const p = this.measureSignal(); return p === null ? 'n/a' : String(p); })(),
      lastError: this.lastError || 'none'
    };
  }

  // Howler reports a failed play separately from a failed load. On iOS this is
  // what fires when audio is still locked, and the documented recovery is to
  // wait for the unlock event and play again.
  handlePlayError(item, error) {
    this.lastError = `play ${item.id}: ${error}`;

    // If the opener itself could not start, the audio output never opened:
    // let the next gesture try again instead of assuming we are set
    if (item.id === this.openerId) this.primed = false;

    const sound = this.sounds[item.id];
    if (!sound) return;

    sound.once('unlock', () => {
      if (this.sounds[item.id] === sound) sound.play();
    });
  }

  // HTML5 reports MediaError codes (1 aborted, 2 network, 3 decode, 4 source);
  // Web Audio reports a message instead
  handleLoadError(item, type, code) {
    this.lastError = `${item.id}: ${code}`;
    // We abort downloads ourselves whenever the stage changes mid-load; that is
    // not a failure the player needs to hear about
    if (code === 1) {
      console.debug(`Load of '${item.id}' aborted`);
      return;
    }

    const isCurrentStage = type === 'music' && this.currentStage && this.currentStage.music === item.id;
    const retries = this.loadRetries[item.id] || 0;

    // Remote archives drop connections, and Web Audio reports decode failures
    // as text rather than a code; one silent retry covers most of both
    const retriable = code === 2 || typeof code === 'string';

    if (isCurrentStage && retries < 1 && retriable) {
      this.loadRetries[item.id] = retries + 1;

      setTimeout(() => {
        const sound = this.sounds[item.id];

        if (sound && this.currentStage && this.currentStage.music === item.id) {
          sound.play();
        }
      }, 1000);

      return;
    }

    this.emitError({ type, code, ...item });
  }

  emitOverrideUpdate(override) {
    this.overrideUpdateListeners.forEach(listener => listener(override));
  }

  // Effective level for a channel, applied on top of each sound's own volume
  channelLevel(type) {
    const channel = this.channels[type];
    return channel.muted ? 0 : channel.volume * this.master;
  }

  setMasterVolume(volume) {
    this.master = volume;
    localStorage.setItem(MASTER_KEY, volume);
    this.applyChannelVolume('music');
    this.applyChannelVolume('sound');
  }

  getMasterVolume() {
    return this.master;
  }

  applyChannelVolume(type) {
    const level = this.channelLevel(type);

    Object.values(this.sounds).forEach(sound => {
      if (sound.meta.type !== type) return;
      sound.volume(sound.meta.baseVolume * level);
    });
  }

  setChannelVolume(type, volume) {
    this.channels[type].volume = volume;
    localStorage.setItem(STORED[type].volume, volume);
    this.applyChannelVolume(type);
  }

  setChannelMute(type, muted) {
    this.channels[type].muted = muted;
    localStorage.setItem(STORED[type].muted, muted);
    this.applyChannelVolume(type);
  }

  getChannelState(type) {
    return { ...this.channels[type] };
  }

  // Read-only snapshot of the stage currently loaded, for the now playing bar
  getPlaybackState() {
    if (!this.currentStage) return null;

    const music = this.sounds[this.currentStage.music];
    if (!music) return null;

    const seek = music.seek();

    return {
      stage: this.currentStage,
      playing: music.playing(),
      duration: music.duration() || 0,
      seek: typeof seek === 'number' ? seek : 0
    };
  }

  loadSounds(soundData) {
    this.pendingPreload = [];
    // Reloading data replaces every Howl; without unloading first, whatever is
    // playing keeps playing from an instance nothing references any more
    this.stop();
    Object.values(this.sounds).forEach(sound => sound.unload());
    this.sounds = {};
    this.loadRetries = {};

    // Load music tracks (with loop enabled)
    soundData.sources.music.forEach(item => {
      const customLoop = !!(item.loop_start != null || item.loop_end != null);
      const baseVolume = item.volume != null ? item.volume : 1.0;

      // Decoding before the audio context is awake fails outright, so nothing
      // preloads until the channel is open; the ids are queued instead
      if (item.preload) this.pendingPreload.push(item.id);

      this.sounds[item.id] = new Howl({
        src: [item.src],
        loop: !customLoop,
        preload: false,
        html5: USE_HTML5,
        volume: baseVolume * this.channelLevel('music'),
        onloaderror: (soundId, code) => {
          this.handleLoadError(item, 'music', code);
        },
        onplayerror: (soundId, error) => {
          this.handlePlayError(item, error);
        },
        onplay: () => {
          delete this.loadRetries[item.id];

          if (!customLoop) {
            return;
          }

          const music = this.sounds[item.id];
          this.clearIntervals();

          const loopInterval = setInterval(() => {
            if (music.seek() >= item.loop_end) {
              music.seek(item.loop_start);
            }
          }, 10);

          this.intervals.push(loopInterval);
        }
      });

      this.sounds[item.id].meta = { type: 'music', baseVolume };
    });
    
    // Load sound effects (no loop)
    soundData.sources.sounds.forEach(item => {
      const baseVolume = item.volume != null ? item.volume : 1.0;

      if (item.preload) this.pendingPreload.push(item.id);

      this.sounds[item.id] = new Howl({
        src: [item.src],
        loop: false,
        preload: false,
        html5: USE_HTML5,
        volume: baseVolume * this.channelLevel('sound'),
        onloaderror: (soundId, code) => {
          this.handleLoadError(item, 'sound', code);
        },
        onplayerror: (soundId, error) => {
          this.handlePlayError(item, error);
        }
      });

      this.sounds[item.id].meta = { type: 'sound', baseVolume };
    });

    // iOS only opens the audio output once a real sound has played through
    // Howler inside a user gesture; a synthesised buffer is not enough. We
    // keep one short effect loaded from the start to use as that opener.
    const openerIds = ['sound-codec', 'sound-knock'];
    const available = Object.keys(this.sounds).filter(id => this.sounds[id].meta.type === 'sound');

    this.openerId = openerIds.find(id => this.sounds[id]) || available[0] || null;

    if (this.openerId && !this.usesHtml5) {
      this.sounds[this.openerId].load();
    }
  }

  playStage(stageId, stages, resume = false) {
    // Find the stage
    const stage = stages.find(s => s.id === stageId);
    if (!stage || !stage.music) return;

    this.resumeContext();

    this.stopAllMusic();

    // A new attempt at this stage deserves a fresh retry
    delete this.loadRetries[stage.music];

    // Save previous and current stage
    this.currentStage = stage;

    // Clear any active override
    this.activeOverride = null;

    // Play the stage music
    const music = this.sounds[stage.music];
    if (music) {
      if (resume) {
        // Resume the previous stage if applicable
        music.seek(music.meta.paused_at || 0);
      }

      // play() is supposed to kick off the download, but on iOS it can return
      // without doing so; asking for the load explicitly is harmless elsewhere
      if (music.state() === 'unloaded') music.load();

      music.play();
      music.meta.paused_at = null;
    }

    this.emitOverrideUpdate(null);
  }

  playOverride(override) {
    this.resumeContext();

    // Keep track of pause timestamp
    if (this.currentStage) {
      const music = this.sounds[this.currentStage.music];

      if (music) {
        music.meta.paused_at = music.seek();
      }
    }

    // Stop current music and clear any pending sounds
    this.stopAllMusic();
    this.clearTimeouts();
    
    // Set this as the active override
    this.activeOverride = override.id;
    
    // Play each sound in the sequence with the specified delays
    override.play.forEach(sound => {
      if (!sound.id) {
        return;
      }

      const timeout = setTimeout(() => {
        const howl = this.sounds[sound.id];

        if (howl) {
          if (howl.state() === 'unloaded') howl.load();
          howl.play();
        }
      }, sound.delay * 1000);
      this.timeouts.push(timeout);
    });

    this.emitOverrideUpdate(override);

    // If there's a natural end to this override sequence, clear it
    // For now we'll assume the override stays active until manually cleared
  }

  // Returns the ids actually played, so the button can track its own progress
  playSfx(sfx) {
    this.resumeContext();

    const played = [];

    // Play each sound without stopping music
    sfx.play.forEach(sound => {
      const howl = this.sounds[sound.id];

      if (howl) {
        if (howl.state() === 'unloaded') howl.load();

        // Create a new instance to allow overlapping sounds
        howl.play();
        played.push(sound.id);
      }
    });

    return played;
  }

  getSfxProgress(ids) {
    let playing = false;
    let seek = 0;
    let duration = 0;

    ids.forEach(id => {
      const sound = this.sounds[id];
      if (!sound || !sound.playing()) return;

      const position = sound.seek();

      playing = true;
      seek = Math.max(seek, typeof position === 'number' ? position : 0);
      duration = Math.max(duration, sound.duration() || 0);
    });

    return { playing, seek, duration };
  }

  stopAllSounds() {
    Object.values(this.sounds).forEach(sound => {
      if (sound.meta.type === 'sound') {
        sound.stop();
      }
    });
  }

  // Full stop: music, effects already sounding, and pending ones
  stop() {
    this.stopAllMusic();
    this.stopAllSounds();
    this.clearTimeouts();
    this.loadRetries = {};
    this.currentStage = null;
    this.activeOverride = null;
    this.emitOverrideUpdate(null);
  }

  // Toggling the active override off: back to the stage, or silence if there is none
  clearOverride(stages) {
    if (this.currentStage) {
      this.stopAllSounds();
      this.resumeStage(stages);
      return;
    }

    this.stop();
  }

  resumeStage(stages) {
    if (this.currentStage) {
      this.playStage(this.currentStage.id, stages, true);
    }
  }

  stopAllMusic() {
    // Stop all music tracks (not sound effects)
    Object.values(this.sounds).forEach(sound => {
      if (sound.meta.type === 'music') {
        sound.stop();
      }
    });

    this.clearIntervals();
  }

  clearTimeouts() {
    this.timeouts.forEach(timeout => clearTimeout(timeout));
    this.timeouts = [];
  }

  clearIntervals() {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
  }

  // New method to check if buttons should be shown based on filters
  isAudioAvaible(filters) {
    if (!filters) return true;

    let available = true;

    if (filters?.override?.in) {
      available &&= this.activeOverride != null && filters.override.in.includes(this.activeOverride);
    }
    if (filters?.override?.not_in) {
      available &&= this.activeOverride == null || !filters.override.not_in.includes(this.activeOverride);
    }

    if (filters?.stage?.in) {
      available &&= this.currentStage != null && filters.stage.in.includes(this.currentStage.id);
    }
    if (filters?.stage?.not_in) {
      available &&= this.currentStage == null || !filters.stage.not_in.includes(this.currentStage.id);
    }

    return available;
  }
}

const defaultAudioService = new AudioService();

export default defaultAudioService;
