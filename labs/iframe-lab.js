(() => {
  'use strict';

  window.addEventListener('message', (event) => {
    if (event.source !== parent) {
      return;
    }

    const sandboxed = document.documentElement.dataset.frameKind === 'sandboxed';
    const ownOrigin = location.origin;
    const validFileParent = location.protocol === 'file:' && event.origin === 'null';
    if (!sandboxed && !validFileParent && event.origin !== ownOrigin) {
      return;
    }

    const targetOrigin = event.origin === 'null' ? '*' : event.origin;
    parent.postMessage({
      from: sandboxed ? 'sandboxed-frame' : 'safe-frame',
      echo: event.data,
    }, targetOrigin);
  });
})();
