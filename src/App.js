import React, { useState, useEffect } from 'react';
import StageSelector from './components/StageSelector/StageSelector';
import OverrideButtons from './components/OverrideButtons/OverrideButtons';
import SfxButtons from './components/SfxButtons/SfxButtons';
import SettingsPanel from './components/SettingsPanel/SettingsPanel';
import CodecHeader from './components/CodecHeader/CodecHeader';
import TabBar from './components/TabBar/TabBar';
import NowPlayingBar from './components/NowPlayingBar/NowPlayingBar';
import CrtOverlay from './components/CrtOverlay/CrtOverlay';
import ErrorToast from './components/ErrorToast/ErrorToast';
import audioService from './services/audioService';
import useMediaQuery from './hooks/useMediaQuery';
import './App.css';

const TABS = [
  { id: 'stage', label: 'Stage' },
  { id: 'events', label: 'Events' },
  { id: 'sfx', label: 'Sfx' },
];

const EYEBROWS = {
  stage: 'Mission select',
  events: 'Stage overrides',
  sfx: 'Sound effects',
};

function App() {
  const [soundboardData, setSoundboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStage, setSelectedStage] = useState('');
  const [soundErrors, setSoundErrors] = useState([]);
  const [isOverrideActive, setIsOverrideActive] = useState(false);
  const [activeTab, setActiveTab] = useState('stage');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [crtEnabled, setCrtEnabled] = useState(localStorage.getItem('mgs-crt') !== 'off');
  const isDesktop = useMediaQuery('(min-width: 900px)');

  useEffect(() => {
    const unsubscribe = audioService.onError(error => {
      setSoundErrors(prev => [...prev, { ...error, errorId: Date.now() }]);
    });

    // Try to load from localStorage first
    const savedData = localStorage.getItem('mgs-soundboard-data');

    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        setSoundboardData(parsedData);
        audioService.loadSounds(parsedData);
        setLoading(false);
      } catch (err) {
        console.error('Failed to parse saved data, loading default', err);
        loadDefaultData();
      }
    } else {
      loadDefaultData();
    }

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = audioService.onOverrideUpdate(override => {
      setIsOverrideActive(override !== null);

      if (override && override.id === 'override-alert') {
        document.documentElement.dataset.state = 'alert';
      } else {
        delete document.documentElement.dataset.state;
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    document.documentElement.dataset.crt = crtEnabled ? 'on' : 'off';
    localStorage.setItem('mgs-crt', crtEnabled ? 'on' : 'off');
  }, [crtEnabled]);

  const loadDefaultData = () => {
    import('./data/metal-gear-solid-soundboard.json')
      .then(data => {
        setSoundboardData(data.default);
        audioService.loadSounds(data.default);
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to load soundboard data');
        console.error(err);
        setLoading(false);
      });
  };

  const handleUpdateData = (newData) => {
    setSoundboardData(newData);
    localStorage.setItem('mgs-soundboard-data', JSON.stringify(newData));

    // loadSounds stops everything, so nothing is selected any more
    audioService.loadSounds(newData);
    setSelectedStage('');
  };

  const handleStop = () => {
    audioService.stop();
    setSelectedStage('');
  };

  const handleDismissError = (errorId) => {
    setSoundErrors(prev => prev.filter(err => err.errorId !== errorId));
  };

  if (loading) return <p className="app__status">Establishing codec link…</p>;
  if (error) return <p className="app__status app__status--error">{error}</p>;
  if (!soundboardData) return null;

  return (
    <div className={`app${isDesktop ? ' app--desktop' : ''}`}>
      <CodecHeader onOpenSettings={() => setSettingsOpen(true)} />

      {isDesktop ? (
        <main className="app__main app__main--columns">
          <section className="app__column">
            <p className="app__eyebrow u-eyebrow">{EYEBROWS.stage}</p>
            <StageSelector
              stages={soundboardData.stages}
              selectedStage={selectedStage}
              setSelectedStage={setSelectedStage}
            />
          </section>

          <section className="app__column">
            <p className="app__eyebrow u-eyebrow">{EYEBROWS.events}</p>
            <OverrideButtons overrides={soundboardData['stage-overrides']} stages={soundboardData.stages} />
          </section>

          <section className="app__column">
            <p className="app__eyebrow u-eyebrow">{EYEBROWS.sfx}</p>
            <SfxButtons sfxList={soundboardData.sfx} />
          </section>
        </main>
      ) : (
        <main className="app__main" key={activeTab}>
          <p className="app__eyebrow u-eyebrow">{EYEBROWS[activeTab]}</p>

          {activeTab === 'stage' && (
            <StageSelector
              stages={soundboardData.stages}
              selectedStage={selectedStage}
              setSelectedStage={setSelectedStage}
            />
          )}

          {activeTab === 'events' && <OverrideButtons overrides={soundboardData['stage-overrides']} stages={soundboardData.stages} />}

          {activeTab === 'sfx' && <SfxButtons sfxList={soundboardData.sfx} />}
        </main>
      )}

      <NowPlayingBar
        stages={soundboardData.stages}
        isOverrideActive={isOverrideActive}
        onStop={handleStop}
      />

      {!isDesktop && <TabBar tabs={TABS} activeTab={activeTab} onSelect={setActiveTab} />}

      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        soundboardData={soundboardData}
        onUpdateData={handleUpdateData}
        crtEnabled={crtEnabled}
        onToggleCrt={() => setCrtEnabled(prev => !prev)}
      />

      <ErrorToast errors={soundErrors} onDismiss={handleDismissError} />

      <CrtOverlay />
    </div>
  );
}

export default App;
