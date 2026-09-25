import React from 'react';
import CodecVolume from '../CodecVolume/CodecVolume';
import Portrait, { ART } from './Portrait';
import './CodecHeader.css';

function CodecHeader({ onOpenSettings }) {
  return (
    <header className="codec-header">
      <div className="codec-header__bar">
        <h1 className="codec-header__title u-glow">MGS Board Game Soundboard</h1>
      </div>

      <div className="codec-header__screen">
        <Portrait art={ART.campbell} label="Colonel Campbell" />
        <CodecVolume onOpenSettings={onOpenSettings} />
        <Portrait art={ART.snake} label="Solid Snake" />
      </div>
    </header>
  );
}

export default CodecHeader;
