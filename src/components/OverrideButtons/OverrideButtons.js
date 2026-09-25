import React, { useEffect, useState } from 'react';
import audioService from '../../services/audioService';
import { cleanLabel } from '../../utils/label';
import { getOverrideIcon } from '../../utils/icons';
import './OverrideButtons.css';

function OverrideButtons({ overrides, stages }) {
  const [visibleButtons, setVisibleButtons] = useState([]);
  const [activeOverride, setActiveOverride] = useState(null);

  useEffect(() => {
    const updateVisibleButtons = () => {
      setVisibleButtons(
        overrides.filter((override) => !override.show_if || audioService.isAudioAvaible(override.show_if))
      );
      setActiveOverride(audioService.activeOverride);
    };

    updateVisibleButtons();

    return audioService.onOverrideUpdate(updateVisibleButtons);
  }, [overrides]);

  return (
    <div className="override-buttons">
      {visibleButtons.map((override, index) => {
        const Icon = getOverrideIcon(override.id);
        const isActive = override.id === activeOverride;

        return (
          <button
            key={override.id || `override-${index}`}
            type="button"
            className={
              'override-button' +
              (override.id === 'override-alert' ? ' override-button--alert' : '') +
              (isActive ? ' override-button--active' : '')
            }
            onClick={() => (isActive ? audioService.clearOverride(stages) : audioService.playOverride(override))}
            aria-pressed={isActive}
          >
            <Icon className="override-button__icon" aria-hidden="true" />
            <span>{cleanLabel(override.label)}</span>
            {isActive && <span className="override-button__state">Playing</span>}
          </button>
        );
      })}
    </div>
  );
}

export default OverrideButtons;
