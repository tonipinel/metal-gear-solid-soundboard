import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import audioService from '../../services/audioService';
import { cleanLabel } from '../../utils/label';
import { getSfxIcon } from '../../utils/icons';
import './SfxButtons.css';

const humanize = (str) => str.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

// Remote clips can take a while to arrive; stop waiting for one that never starts
const LOAD_TIMEOUT = 20000;

function SfxButtons({ sfxList }) {
  const [visibleButtons, setVisibleButtons] = useState([]);
  const bars = useRef(new Map());
  const playingSfx = useRef(new Map());
  const frame = useRef(null);

  useEffect(() => {
    const updateVisibleButtons = () => {
      setVisibleButtons(sfxList.filter((sfx) => !sfx.show_if || audioService.isAudioAvaible(sfx.show_if)));
    };

    updateVisibleButtons();

    return audioService.onOverrideUpdate(updateVisibleButtons);
  }, [sfxList]);

  // The bars are written straight to the DOM: at 60fps, re-rendering every
  // button on each frame would cost far more than the animation is worth
  const tick = useCallback(() => {
    playingSfx.current.forEach((entry, key) => {
      const bar = bars.current.get(key);
      const { playing, seek, duration } = audioService.getSfxProgress(entry.ids);

      if (playing) {
        entry.started = true;

        if (bar) {
          bar.dataset.state = 'playing';
          bar.style.transform = `scaleX(${duration > 0 ? Math.min(seek / duration, 1) : 0})`;
        }

        return;
      }

      if (!entry.started && performance.now() - entry.at < LOAD_TIMEOUT) {
        if (bar) bar.dataset.state = 'loading';
        return;
      }

      if (bar) {
        bar.dataset.state = 'idle';
        bar.style.transform = 'scaleX(0)';
      }

      playingSfx.current.delete(key);
    });

    frame.current = playingSfx.current.size > 0 ? requestAnimationFrame(tick) : null;
  }, []);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const handlePlay = (sfx, key) => {
    const ids = audioService.playSfx(sfx);
    if (ids.length === 0) return;

    playingSfx.current.set(key, { ids, started: false, at: performance.now() });

    if (frame.current === null) frame.current = requestAnimationFrame(tick);
  };

  const registerBar = (key) => (element) => {
    if (element) bars.current.set(key, element);
    else bars.current.delete(key);
  };

  const categories = useMemo(() => {
    const groups = visibleButtons.reduce((acc, sfx) => {
      const category = sfx.category || 'default';
      acc[category] = acc[category] || [];
      acc[category].push(sfx);
      return acc;
    }, {});

    return Object.keys(groups).map((name) => ({ name, items: groups[name] }));
  }, [visibleButtons]);

  const renderButton = (sfx, key) => {
    const Icon = getSfxIcon(sfx.id);

    return (
      <button
        key={key}
        type="button"
        className="sfx__button"
        onClick={() => handlePlay(sfx, key)}
      >
        <span className="sfx__progress" ref={registerBar(key)} data-state="idle" aria-hidden="true" />
        <Icon className="sfx__icon" aria-hidden="true" />
        <span className="sfx__label">{cleanLabel(sfx.label)}</span>
      </button>
    );
  };

  return (
    <div className="sfx">
      {categories.map((category) => (
        <section className="sfx__group" key={category.name}>
          <h2 className="sfx__group-title">{humanize(category.name)}</h2>

          <div className="sfx__grid">
            {category.items.map((sfx, index) => renderButton(sfx, sfx.id || `${category.name}-${index}`))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default SfxButtons;
