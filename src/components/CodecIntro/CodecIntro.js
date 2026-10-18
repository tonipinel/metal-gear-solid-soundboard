import React from 'react';
import Portrait, { ART } from '../CodecHeader/Portrait';
import './CodecIntro.css';

// Opening the channel is a real tap that plays a real sound, which is what
// iOS requires before it will route any audio to the speaker
function CodecIntro({ onStart, ready }) {
  return (
    <div className="codec-intro">
      <div className="codec-intro__screen">
        <Portrait art={ART.campbell} label="Colonel Campbell" />

        <div className="codec-intro__panel">
          <span className="codec-intro__freq u-glow">140.85</span>
          <span className="codec-intro__status u-eyebrow">
            {ready ? 'Channel ready' : 'Tuning…'}
          </span>
        </div>

        <Portrait art={ART.snake} label="Solid Snake" />
      </div>

      <button type="button" className="codec-intro__button" onClick={onStart}>
        Start codec
      </button>

      <p className="codec-intro__note">
        Tap to open the channel. Phones only let a page play audio after you do.
      </p>
    </div>
  );
}

export default CodecIntro;
