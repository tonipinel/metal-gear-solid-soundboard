import React from 'react';
import audioService from '../../services/audioService';
import { cleanLabel } from '../../utils/label';
import './StageSelector.css';

function StageSelector({ stages, selectedStage, setSelectedStage }) {
  const handleStageSelect = (stageId) => {
    if (stageId === selectedStage) {
      setSelectedStage('');
      audioService.stopAllMusic();
      return;
    }

    setSelectedStage(stageId);
    audioService.playStage(stageId, stages);
  };

  return (
    <ul className="stage-list">
      {stages.filter((stage) => stage.id).map((stage) => {
        const isActive = stage.id === selectedStage;

        return (
          <li key={stage.id}>
            <button
              type="button"
              className={`stage-list__item${isActive ? ' stage-list__item--active' : ''}`}
              onClick={() => handleStageSelect(stage.id)}
              aria-pressed={isActive}
            >
              <span className="stage-list__marker" aria-hidden="true" />
              <span className="stage-list__label">{cleanLabel(stage.label)}</span>
              <span className="stage-list__state">{isActive ? 'Playing' : ''}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default StageSelector;
