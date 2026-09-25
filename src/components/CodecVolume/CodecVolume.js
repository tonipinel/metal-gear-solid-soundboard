import React, { useRef, useState } from 'react';
import audioService from '../../services/audioService';
import VolumeMeter from './VolumeMeter';
import './CodecVolume.css';

const STEP = 0.05;

function CodecVolume({ onOpenSettings }) {
  const [volume, setVolume] = useState(() => audioService.getMasterVolume());

  // Repeated taps land in the same render, so the latest value lives in a ref
  const latest = useRef(volume);

  const apply = (value) => {
    const clamped = Math.min(Math.max(value, 0), 1);

    latest.current = clamped;
    setVolume(clamped);
    audioService.setMasterVolume(clamped);
  };

  return (
    <div className="codec-volume">
      <span className="codec-volume__tag">Volume</span>

      <div className="codec-volume__row">
        <button
          type="button"
          className="codec-volume__arrow"
          onClick={() => apply(latest.current - STEP)}
          aria-label="Lower master volume"
        >
          <span className="codec-volume__sign">&minus;</span>
        </button>

        <div className="codec-volume__display">
          <VolumeMeter level={volume} />

          {/* the frequency is set dressing: in the game it is the channel, here it never changes */}
          <span className="codec-volume__readout u-glow">140.85</span>

          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(event) => apply(parseFloat(event.target.value))}
            className="codec-volume__input"
            aria-label="Master volume"
            title={`Master volume ${Math.round(volume * 100)}%`}
          />
        </div>

        <button
          type="button"
          className="codec-volume__arrow"
          onClick={() => apply(latest.current + STEP)}
          aria-label="Raise master volume"
        >
          <span className="codec-volume__sign">+</span>
        </button>
      </div>

      <button type="button" className="codec-volume__tag codec-volume__tag--action" onClick={onOpenSettings}>
        Settings
      </button>
    </div>
  );
}

export default CodecVolume;
