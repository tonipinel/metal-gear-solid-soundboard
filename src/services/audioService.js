import { Howl } from 'howler';

const STORED = {
  music: { volume: 'mgs-volume-music', muted: 'mgs-muted-music' },
  sound: { volume: 'mgs-volume-sfx', muted: 'mgs-muted-sfx' }
};

const MASTER_KEY = 'mgs-master-level';

const readVolume = (key, fallback) => {
  const stored = parseFloat(localStorage.getItem(key));
  return Number.isFinite(stored) ? stored : fallback;
};

class AudioService {
  constructor() {
    this.sounds = {};
    this.currentStage = null;
    this.timeouts = [];
    this.intervals = [];
    this.activeOverride = null;
    this.loadRetries = {};
    
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

  // MediaError codes: 1 aborted, 2 network, 3 decode, 4 source not supported
  handleLoadError(item, type, code) {
    // We abort downloads ourselves whenever the stage changes mid-load; that is
    // not a failure the player needs to hear about
    if (code === 1) {
      console.debug(`Load of '${item.id}' aborted`);
      return;
    }

    const isCurrentStage = type === 'music' && this.currentStage && this.currentStage.music === item.id;
    const retries = this.loadRetries[item.id] || 0;

    // Remote archives drop connections; one silent retry covers most of it
    if (isCurrentStage && retries < 1 && code === 2) {
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

      this.sounds[item.id] = new Howl({
        src: [item.src],
        loop: !customLoop,
        preload: item.preload || false,
        html5: true,
        volume: baseVolume * this.channelLevel('music'),
        onloaderror: (soundId, code) => {
          this.handleLoadError(item, 'music', code);
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

      this.sounds[item.id] = new Howl({
        src: [item.src],
        loop: false,
        preload: item.preload || false,
        html5: true,
        volume: baseVolume * this.channelLevel('sound'),
        onloaderror: (soundId, code) => {
          this.handleLoadError(item, 'sound', code);
        }
      });

      this.sounds[item.id].meta = { type: 'sound', baseVolume };
    });
  }

  playStage(stageId, stages, resume = false) {
    // Find the stage
    const stage = stages.find(s => s.id === stageId);
    if (!stage || !stage.music) return;

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

      music.play();
      music.meta.paused_at = null;
    }

    this.emitOverrideUpdate(null);
  }

  playOverride(override) {
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
        if (this.sounds[sound.id]) {
          this.sounds[sound.id].play();
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
    const played = [];

    // Play each sound without stopping music
    sfx.play.forEach(sound => {
      if (this.sounds[sound.id]) {
        // Create a new instance to allow overlapping sounds
        this.sounds[sound.id].play();
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
