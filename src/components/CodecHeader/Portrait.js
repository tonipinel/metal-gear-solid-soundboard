import React from 'react';
import { CAMPBELL, SNAKE } from './portraitPaths';

function Portrait({ art, label }) {
  return (
    <figure className="portrait">
      <svg
        className="portrait__art"
        viewBox={art.viewBox}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={label}
      >
        <g transform={art.transform} fill="currentColor">
          {art.layers.map((layer) => (
            <path key={layer.opacity} d={layer.d} opacity={layer.opacity} />
          ))}
        </g>
      </svg>
    </figure>
  );
}

export const ART = { campbell: CAMPBELL, snake: SNAKE };

export default Portrait;
