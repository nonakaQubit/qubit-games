// 進み具合の保存（ブラウザの localStorage）
import { encodeSpell, decodeSpell } from './spell.js?v=20261109_v46';

const KEY = 'rorqual.save.v1';

const blank = () => ({ cleared: [], seen: [], lang: 'ja', area: 'okhotsk' });

export function load() {
  let base = blank();
  try {
    base = { ...base, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch { /* ignore */ }
  return base;
}

export function save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* 保存できなくても遊べる */ }
}

export { encodeSpell, decodeSpell };
