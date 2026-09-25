import {
  GiPocketRadio, GiHand, GiCannedFish, GiSwapBag, GiElevator, GiDoorway,
  GiPunchBlast, GiKnockout, GiGrenade, GiSmokeBomb, GiSpikyExplosion,
  GiMachineGun, GiSilenced, GiPistolGun, GiBackstab,
  GiSiren, GiTalk, GiCctvCamera, GiBrokenHeart,
  GiDeathSkull, GiPrisoner, GiAmmoBox, GiFurnace, GiSnowflake1, GiRobotGolem,
  GiVrHeadset, GiSoundWaves,
} from 'react-icons/gi';

const SFX_ICONS = {
  'sfx-codec': GiPocketRadio,
  'sfx-knock': GiHand,
  'sfx-ration': GiCannedFish,
  'sfx-pick-up-item': GiSwapBag,
  'sfx-elevator': GiElevator,
  'sfx-door-open': GiDoorway,
  'sfx-punch-ko-x1': GiPunchBlast,
  'sfx-ko-x2': GiKnockout,
  'sfx-grenade': GiGrenade,
  'sfx-grenade-chaff': GiSmokeBomb,
  'sfx-explosion': GiSpikyExplosion,
  'sfx-fa-mas': GiMachineGun,
  'sfx-socom-silenced': GiSilenced,
  'sfx-socom': GiPistolGun,
  'sfx-silent-takedown': GiBackstab,
  'sfx-alert': GiSiren,
  'sfx-camera-alert': GiCctvCamera,
};

const OVERRIDE_ICONS = {
  'override-alert': GiSiren,
  'override-gameover': GiDeathSkull,
  'override-Stage3-HoldingCell': GiPrisoner,
  'override-Stage3-Armory': GiAmmoBox,
  'override-Stage13-Heat': GiFurnace,
  'override-Stage13-Cold': GiSnowflake1,
  'override-Stage13-Rex': GiRobotGolem,
  'override-vr-stage-completed': GiVrHeadset,
};

export function getSfxIcon(id) {
  if (typeof id !== 'string') return GiSoundWaves;
  if (SFX_ICONS[id]) return SFX_ICONS[id];
  if (id.startsWith('sfx-guard-')) return GiTalk;
  if (id.startsWith('sfx-damage-')) return GiBrokenHeart;
  return GiSoundWaves;
}

export function getOverrideIcon(id) {
  return OVERRIDE_ICONS[id] || GiSoundWaves;
}
