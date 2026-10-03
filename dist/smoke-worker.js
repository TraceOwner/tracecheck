'use strict';
/* Runs the smoke shader for every canvas the page hands over. The page only
   sends sizes, pointer, scroll and run/stop messages; frames never touch the
   page's main thread. */
importScripts('smoke-core.js');
const smokes = new Map();
onmessage = ({data}) => {
  const {id, type} = data;
  if (type === 'create') {
    const smoke = TraceSmoke.create(data.canvas, {
      scene: data.scene, strength: data.strength,
      live: () => postMessage({id, type: 'live'}),
      lost: reason => postMessage({id, type: 'lost', reason})
    });
    if (smoke) smokes.set(id, smoke); else postMessage({id, type: 'lost', reason: 'context'});
    return;
  }
  const smoke = smokes.get(id);
  if (!smoke) return;
  if (type === 'resize') smoke.resize(data.w, data.h);
  else if (type === 'input') smoke.input(data.patch);
  else if (type === 'still') smoke.still();
  else if (type === 'run') smoke.run(data.on);
  else if (type === 'destroy') { smoke.destroy(); smokes.delete(id); }
};
