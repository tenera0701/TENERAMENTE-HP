/* Tweaks panel for TENERAMENTE HP */
const { useState, useEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "svcLayout": "grid",
  "accent": "blue",
  "density": "normal"
}/*EDITMODE-END*/;

const ACCENTS = {
  blue:   { primary: '#4A8BFF', strong: '#2F7CFF', a: '#5AA0FF', b: '#34DFEA' },
  indigo: { primary: '#7B6BFF', strong: '#5E4BFF', a: '#8B6BFF', b: '#5AA0FF' },
  cyan:   { primary: '#34DFEA', strong: '#15BFCC', a: '#5AA0FF', b: '#34DFEA' },
  rose:   { primary: '#FF6B8E', strong: '#E5436B', a: '#FF8FA8', b: '#FFB36B' },
};

function applyAccent(name) {
  const a = ACCENTS[name] || ACCENTS.blue;
  document.documentElement.style.setProperty('--primary', a.primary);
  document.documentElement.style.setProperty('--primary-strong', a.strong);
  document.documentElement.style.setProperty('--blue-400', a.a);
  document.documentElement.style.setProperty('--cyan-400', a.b);
}
function applyDensity(d) {
  document.documentElement.style.setProperty('--section-pad',
    d === 'compact' ? 'clamp(56px, 8vh, 100px)' :
    d === 'roomy'   ? 'clamp(120px, 18vh, 220px)' :
                      'clamp(80px, 12vh, 160px)');
}
function applySvcLayout(mode) {
  const list = document.querySelector('[data-svc-list]');
  if (list) list.setAttribute('data-mode', mode);
  document.querySelectorAll('[data-svc-tabs] .svc-tab').forEach(t => {
    t.classList.toggle('active', t.getAttribute('data-mode') === mode);
  });
}
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('ten-theme', t); } catch (e) {}
  document.querySelectorAll('[data-theme-toggle] .theme-icon').forEach(el => {
    el.textContent = t === 'dark' ? '☾' : '☀';
  });
}

function TenTweaks() {
  const [t, setTweak] = window.useTweaks(TWEAK_DEFAULTS);

  useEffect(() => { applyTheme(t.theme); }, [t.theme]);
  useEffect(() => { applyAccent(t.accent); }, [t.accent]);
  useEffect(() => { applyDensity(t.density); }, [t.density]);
  useEffect(() => { applySvcLayout(t.svcLayout); }, [t.svcLayout]);

  return (
    <window.TweaksPanel title="Tweaks">
      <window.TweakSection title="Appearance">
        <window.TweakRadio label="Theme" value={t.theme} options={[
          { value: 'dark', label: 'Dark' },
          { value: 'light', label: 'Light' },
        ]} onChange={v => setTweak('theme', v)} />
        <window.TweakSelect label="Accent" value={t.accent} options={[
          { value: 'blue', label: 'Bright Blue' },
          { value: 'indigo', label: 'Indigo' },
          { value: 'cyan', label: 'Cyan' },
          { value: 'rose', label: 'Rose' },
        ]} onChange={v => setTweak('accent', v)} />
      </window.TweakSection>
      <window.TweakSection title="Layout">
        <window.TweakRadio label="Services" value={t.svcLayout} options={[
          { value: 'grid', label: 'Grid' },
          { value: 'list', label: 'List' },
        ]} onChange={v => setTweak('svcLayout', v)} />
        <window.TweakSelect label="Density" value={t.density} options={[
          { value: 'compact', label: 'Compact' },
          { value: 'normal', label: 'Normal' },
          { value: 'roomy', label: 'Roomy' },
        ]} onChange={v => setTweak('density', v)} />
      </window.TweakSection>
    </window.TweaksPanel>
  );
}

// Mount when the kit is ready
(function mount() {
  if (!window.TweaksPanel || !window.useTweaks) { setTimeout(mount, 50); return; }
  const root = document.createElement('div');
  root.id = 'tweaks-root';
  document.body.appendChild(root);
  ReactDOM.createRoot(root).render(<TenTweaks />);
})();
