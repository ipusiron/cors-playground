(function chooseLanguage(){
  'use strict';
  const params = new URLSearchParams(location.search);
  const requested = params.get('lang');
  let stored = null;
  try { stored = localStorage.getItem('corspg-language'); } catch (error) { stored = null; }
  const detected = navigator.language.toLowerCase().startsWith('ja') ? 'ja' : 'en';
  const language = ['ja', 'en'].includes(requested)
    ? requested
    : (['ja', 'en'].includes(stored) ? stored : detected);
  try { localStorage.setItem('corspg-language', language); } catch (error) { /* optional */ }

  const current = document.documentElement.lang === 'en' ? 'en' : 'ja';
  if(language !== current){
    const target = language === 'en' ? 'index.en.html' : 'index.html';
    params.set('lang', language);
    location.replace(`${target}?${params.toString()}${location.hash}`);
  }
})();
