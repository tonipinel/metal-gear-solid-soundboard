import React, { useId } from 'react';

// Geometry taken from codec-volume-bg.svg in christabor/metal-gear-codec
// (MIT, Copyright (c) 2013 Chris Tabor). Recoloured to currentColor and split
// into an off layer plus a lit layer clipped to the current level.
const WIDTH = 113.949;
const HEIGHT = 67.502;
const ROWS = [0.501, 6.702, 12.902, 19.103, 25.303, 31.504, 37.705, 43.905, 50.106, 56.306, 62.507];
const ROW_HEIGHT = 4.995;
const RAMP = 'M4.641,67.502h18.833c0,0,1-44.865,15-54.6c14-9.735,69.5-6.701,74.667-6.701V0H4.782L4.641,67.502z';

function Rows({ rampId }) {
  return (
    <>
      {ROWS.map((y) => (
        <rect key={`step-${y}`} x="0" y={y} width="2.781" height={ROW_HEIGHT} />
      ))}
      <g clipPath={`url(#${rampId})`}>
        {ROWS.map((y) => (
          <rect key={`bar-${y}`} x="4.641" y={y} width="109.308" height={ROW_HEIGHT} />
        ))}
      </g>
    </>
  );
}

function VolumeMeter({ level }) {
  // Unique per instance: fixed ids would make two meters share one clip
  const id = useId();
  const rampId = `codec-ramp-${id}`;
  const levelId = `codec-level-${id}`;

  return (
    <svg
      className="codec-volume__meter"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={rampId}>
          <path d={RAMP} />
        </clipPath>
        <clipPath id={levelId}>
          <rect x="0" y={HEIGHT * (1 - level)} width={WIDTH} height={HEIGHT * level} />
        </clipPath>
      </defs>

      <g fill="currentColor" opacity="0.22">
        <Rows rampId={rampId} />
      </g>

      <g fill="currentColor" clipPath={`url(#${levelId})`}>
        <Rows rampId={rampId} />
      </g>
    </svg>
  );
}

export default VolumeMeter;
