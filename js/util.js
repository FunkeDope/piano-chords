// Small helpers shared by every module: DOM lookup, HTML escaping, safe localStorage, layout checks.

export const $ = id => document.getElementById(id);
export const esc = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
export const pad = n => ' '.repeat(Math.max(0, n | 0));   // safe spacing: a negative gap just means no gap

// localStorage can throw (private windows, blocked storage), so every access is guarded
export const store = {
  get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch (e) {} },
  remove(key) { try { localStorage.removeItem(key); } catch (e) {} },
  getJSON(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch (e) { return fallback; } },
  setJSON(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} },
};

export const MOBILE = '(max-width:760px)';
export const isMobile = () => matchMedia(MOBILE).matches;

export const listNames = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0] || '';
