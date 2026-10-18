import React, { useState, useEffect, useRef } from 'react';
import audioService from '../../services/audioService';
import VolumeControl from '../VolumeControl/VolumeControl';
import './SettingsPanel.css';

function SettingsPanel({ isOpen, onClose, soundboardData, onUpdateData, crtEnabled, onToggleCrt }) {
  const [jsonContent, setJsonContent] = useState('');
  const [isModified, setIsModified] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const panelRef = useRef(null);
  const [diagnostics, setDiagnostics] = useState(() => audioService.getDiagnostics());
  const onCloseRef = useRef(onClose);

  onCloseRef.current = onClose;

  useEffect(() => {
    if (soundboardData) {
      setJsonContent(JSON.stringify(soundboardData, null, 2));
      setIsModified(false);
    }
  }, [soundboardData]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const read = () => setDiagnostics(audioService.getDiagnostics());
    read();
    const diagnosticsTimer = setInterval(read, 1000);

    const panel = panelRef.current;
    const previouslyFocused = document.activeElement;

    panel.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusables = panel.querySelectorAll('button, a[href], input, textarea');
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearInterval(diagnosticsTimer);
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleJsonChange = (e) => {
    setJsonContent(e.target.value);
    setIsModified(JSON.stringify(soundboardData, null, 2) !== e.target.value);
    setValidationError(null);
  };

  const handleSave = () => {
    try {
      const parsedJson = JSON.parse(jsonContent);

      if (!parsedJson.sources || !parsedJson.stages || !parsedJson['stage-overrides'] || !parsedJson.sfx) {
        throw new Error('missing required sections: sources, stages, stage-overrides or sfx');
      }

      onUpdateData(parsedJson);
      setIsModified(false);
    } catch (err) {
      setValidationError(`Invalid JSON: ${err.message}`);
    }
  };

  const handleReset = () => {
    localStorage.removeItem('mgs-soundboard-data');
    window.location.reload();
  };

  return (
    <div className="settings" role="dialog" aria-modal="true" aria-label="Settings" ref={panelRef} tabIndex={-1}>
      <div className="settings__bar">
        <span className="u-eyebrow">Settings</span>
        <button type="button" className="settings__close" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="settings__body">
        <div className="settings__section">
          <span className="u-eyebrow">Mix</span>
          <div className="settings__mixer">
            <VolumeControl channel="music" label="Mus" />
            <VolumeControl channel="sound" label="Sfx" />
          </div>
        </div>

        <div className="settings__row">
          <span className="settings__row-label">CRT effect</span>
          <button
            type="button"
            className="settings__switch"
            onClick={onToggleCrt}
            aria-pressed={crtEnabled}
          >
            {crtEnabled ? 'On' : 'Off'}
          </button>
        </div>

        <div className="settings__section">
          <span className="u-eyebrow">Soundboard data</span>
          <p className="settings__hint">
            Editing this JSON changes the stages, events and effects. A broken structure breaks the app.
          </p>

          {validationError && <p className="settings__error">{validationError}</p>}

          <textarea
            className="settings__editor"
            value={jsonContent}
            onChange={handleJsonChange}
            rows="14"
            spellCheck="false"
          />

          <div className="settings__actions">
            <button type="button" className="settings__action" onClick={handleSave} disabled={!isModified}>
              Save data
            </button>
            <button type="button" className="settings__action" onClick={handleReset}>
              Reset to default
            </button>
          </div>
        </div>

        <div className="settings__section">
          <span className="u-eyebrow">Playback</span>
          <p className="settings__hint">
            {audioService.usesHtml5
              ? 'Tracks stream as they download.'
              : 'This device ignores volume on audio elements, so tracks are decoded up front to keep the mix under control.'}
          </p>
          <dl className="settings__diagnostics">
            {Object.entries(diagnostics).map(([key, value]) => (
              <React.Fragment key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </React.Fragment>
            ))}
          </dl>
        </div>

        <div className="settings__section">
          <span className="u-eyebrow">About</span>
          <p className="settings__hint">
            No audio is hosted here. Every sound streams from external archives. All Metal Gear Solid audio and
            characters belong to Konami. Unofficial fan project, not affiliated with or endorsed by Konami.
          </p>
          <p className="settings__hint">
            Built by <a href="https://github.com/wikiti" target="_blank" rel="noreferrer">Daniel @wikiti</a> with{' '}
            <a href="https://boardgamegeek.com/user/Zypzu" target="_blank" rel="noreferrer">Eric @Zypzu</a> and other
            BGG community members. Codec skin by{' '}
            <a href="https://github.com/tonipinel" target="_blank" rel="noreferrer">Toni Pinel</a>.
          </p>
          <p className="settings__hint">
            The volume meter geometry comes from{' '}
            <a href="https://github.com/christabor-archive/metal-gear-codec" target="_blank" rel="noreferrer">
              metal-gear-codec
            </a>{' '}
            by Chris Tabor (MIT). The codec portraits are posterised vector drawings, with no
            imagery loaded from anywhere.
          </p>
        </div>
      </div>
    </div>
  );
}

export default SettingsPanel;
