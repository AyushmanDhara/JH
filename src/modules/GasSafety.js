export function createGasScenarioConfig({ onNotify, onVisual }) {
  let hasPPE = false;
  let hasDetector = false;
  const consumed = new Set();
  const timers = [];

  const objectives = [
    { id: 'recognize', textKey: 'gasObj1' },
    { id: 'no_enter', textKey: 'gasObj2' },
    { id: 'ppe', textKey: 'gasObj3' },
    { id: 'detector', textKey: 'gasObj4' },
    { id: 'reading', textKey: 'gasObj5' },
    { id: 'report', textKey: 'gasObj6' },
    { id: 'alarm', textKey: 'gasObj7' },
    { id: 'buddy', textKey: 'gasObj8' },
    { id: 'safe', textKey: 'gasObj9' },
    { id: 'exit', textKey: 'gasObj10' },
  ];

  function once(id, fn) {
    if (consumed.has(id)) return false;
    consumed.add(id);
    fn();
    return true;
  }

  return {
    id: 'gas',
    name: 'Gas Leak & Confined Space',
    objectives,
    onStart() {
      onNotify?.('moduleStarted', 'info');
      timers.push(setTimeout(() => onVisual?.('completeObj', 'recognize'), 2000));
    },
    dispose() {
      timers.forEach(clearTimeout);
      timers.length = 0;
    },
    onEvent(eventName, payload, api) {
      const { objectives: objMgr, score, complete } = api;
      if (eventName !== 'enter_hazard') onVisual?.('tip', eventName);

      switch (eventName) {
        case 'gas_sign':
          once('gas_sign', () => {
            score.addCorrect();
            if (objMgr.completeById('recognize')) score.completeObjective();
            if (objMgr.completeById('no_enter')) score.completeObjective();
            onNotify?.('correctAction', 'success');
          });
          break;

        case 'ppe_station':
          once('ppe_station', () => {
            hasPPE = true;
            score.addCorrect();
            if (objMgr.completeById('ppe')) score.completeObjective();
            onNotify?.('correctAction', 'success');
            onVisual?.('ppeOn');
          });
          break;

        case 'gas_detector':
          once('gas_detector', () => {
            if (!hasPPE) {
              score.addUnsafe();
              onNotify?.('unsafeAction', 'danger');
            }
            hasDetector = true;
            score.addCorrect();
            if (objMgr.completeById('detector')) score.completeObjective();
            onNotify?.('correctAction', 'success');
            timers.push(setTimeout(() => {
              once('reading', () => {
                score.addCorrect();
                if (objMgr.completeById('reading')) score.completeObjective();
                onNotify?.('correctAction', 'success');
                onVisual?.('reading');
              });
            }, 800));
          });
          break;

        case 'gas_alarm':
          once('gas_alarm', () => {
            score.addCorrect();
            if (objMgr.completeById('report')) score.completeObjective();
            if (objMgr.completeById('alarm')) score.completeObjective();
            if (objMgr.completeById('buddy')) score.completeObjective();
            onNotify?.('correctAction', 'success');
            onVisual?.('alarm');
          });
          break;

        case 'safe_zone':
          once('safe_zone', () => {
            if (!hasPPE || !hasDetector) {
              score.addUnsafe();
              onNotify?.('unsafeAction', 'danger');
            }
            score.addCorrect();
            if (objMgr.completeById('safe')) score.completeObjective();
            onNotify?.('correctAction', 'success');
          });
          break;

        case 'gas_exit':
          once('gas_exit', () => {
            score.evacuationBonus();
            if (objMgr.completeById('exit')) score.completeObjective();
            onNotify?.('evacuationComplete', 'success');
            complete();
          });
          break;

        case 'enter_hazard':
          once('enter_hazard_' + (payload?.zone || 'default'), () => {
            if (!hasPPE) {
              score.addUnsafe();
              onNotify?.('unsafeAction', 'danger');
            }
          });
          break;
      }
    },
    onComplete() {
      onNotify?.('moduleComplete', 'success');
    },
  };
}
