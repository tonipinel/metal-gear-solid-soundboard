import React, { useRef, useState } from 'react';
import audioService from '../../services/audioService';
import './VolumeControl.css';

// State is seeded from the service, never applied on mount: writing the
// initial render's defaults back would overwrite the stored mix.
// The channel prop is fixed per instance; pass a key to swap it.
function VolumeControl({ channel, label }) {
  const [state, setState] = useState(() => audioService.getChannelState(channel));
  const previousVolume = useRef(state.volume || 1);

  const apply = (next) => {
    setState(next);
    audioService.setChannelVolume(channel, next.volume);
    audioService.setChannelMute(channel, next.muted);
  };

  const handleVolumeChange = (event) => {
    const volume = parseFloat(event.target.value);
    apply({ volume, muted: volume === 0 });
  };

  const handleMuteToggle = () => {
    if (state.muted) {
      apply({ volume: Math.max(previousVolume.current, 0.1), muted: false });
      return;
    }

    // Remember the level in effect right now, to restore it on unmute
    previousVolume.current = state.volume;
    apply({ volume: 0, muted: true });
  };

  return (
    <div className="volume">
      <span className="volume__channel">{label}</span>

      <button
        type="button"
        className="volume__mute"
        onClick={handleMuteToggle}
        aria-label={`${state.muted ? 'Unmute' : 'Mute'} ${label}`}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M4 9v6h4l5 4V5L8 9z" />
          {state.muted ? <path d="M17 9l4 6M21 9l-4 6" /> : <path d="M17 8.5a5 5 0 010 7" />}
        </svg>
      </button>

      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={state.volume}
        onChange={handleVolumeChange}
        className="volume__slider"
        aria-label={`${label} volume`}
      />

      <span className="volume__value">{Math.round(state.volume * 100)}</span>
    </div>
  );
}

export default VolumeControl;
