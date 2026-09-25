import React from 'react';
import './TabBar.css';

const ICONS = {
  stage: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z" />
      <path d="M9 3v15M15 6v15" />
    </svg>
  ),
  events: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M12 3l9 17H3z" />
      <path d="M12 9v5M12 17h.01" />
    </svg>
  ),
  sfx: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M3 12h2l2-6 3 14 3-18 3 13 2-3h3" />
    </svg>
  ),
};

function TabBar({ tabs, activeTab, onSelect }) {
  return (
    <nav className="tab-bar" aria-label="Sections">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;

        return (
          <button
            key={tab.id}
            type="button"
            className={`tab-bar__item${isActive ? ' tab-bar__item--active' : ''}`}
            onClick={() => onSelect(tab.id)}
            aria-current={isActive ? 'page' : undefined}
          >
            {ICONS[tab.id]}
            <span className="tab-bar__label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default TabBar;
