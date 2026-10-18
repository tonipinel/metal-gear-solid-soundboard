import React, { useEffect, useState } from 'react';
import audioService from '../../services/audioService';
import { cleanLabel } from '../../utils/label';
import './NowPlayingBar.css';

function NowPlayingBar({ stages, isOverrideActive, onStop }) {
  const [playback, setPlayback] = useState(null);

  useEffect(() => {
    const read = () => setPlayback(audioService.getPlaybackState());
    let intervalId = null;

    const start = () => {
      read();
      if (intervalId === null) intervalId = setInterval(read, 500);
    };

    const stop = () => {
      clearInterval(intervalId);
      intervalId = null;
    };

    // Nothing to redraw while the app is in the background
    const onVisibilityChange = () => (document.hidden ? stop() : start());

    start();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  if (!playback) return null;

  const { stage, duration, seek, playing } = playback;

  const progress = duration > 0 ? Math.min((seek / duration) * 100, 100) : 0;

  let status = 'Buffering';
  if (playing) status = 'Transmitting';
  else if (isOverrideActive) status = 'Standby';

  const isBuffering = status === 'Buffering';

  return (
    <div className={`now-playing${isBuffering ? ' now-playing--buffering' : ''}`}>
      {isBuffering ? (
        <div className="now-playing__sweep" aria-hidden="true" />
      ) : (
        <div className="now-playing__line" style={{ width: `${progress}%` }} />
      )}

      <div className="now-playing__info">
        <span className="u-eyebrow now-playing__status">
          {status}
          {isBuffering && <span className="now-playing__dots" aria-hidden="true" />}
        </span>
        <span className="now-playing__stage u-glow">{cleanLabel(stage.label)}</span>
      </div>

      <div className="now-playing__actions">
        {isOverrideActive && (
          <button
            type="button"
            className="now-playing__button"
            onClick={() => audioService.clearOverride(stages)}
            aria-label="Resume stage"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
              <path d="M7 4l12 8-12 8z" />
            </svg>
          </button>
        )}

        <button
          type="button"
          className="now-playing__button"
          onClick={() => audioService.playStage(stage.id, stages)}
          aria-label="Restart stage"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M20 12a8 8 0 11-2.6-5.9" />
            <path d="M20 3v5h-5" />
          </svg>
        </button>

        <button
          type="button"
          className="now-playing__button now-playing__button--stop"
          onClick={onStop}
          aria-label="Stop audio"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
            <rect x="6" y="6" width="12" height="12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default NowPlayingBar;
