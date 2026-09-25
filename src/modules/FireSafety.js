/**
 * Fire & Explosion Response — gated objectives, one-shot events, openable exit.
 */
export function createFireScenarioConfig({ onNotify, onVisual }) {
  let hasExtinguisher = false;
  let correctExt = false;
  let fireOut = false;
  let exited = false;
  const consumed = new Set();
  const timers = [];

  const objectives = [
    { id: 'identify', textKey: 'fireObj1' },
    { id: 'locate_ext', textKey: 'fireObj2' },
    { id: 'select_ext', textKey: 'fireObj3' },
    { id: 'pickup', textKey: 'fireObj4' },
    { id: 'approach', textKey: 'fireObj5' },
    { id: 'extinguish', textKey: 'fireObj6' },
    { id: 'find_exit', textKey: 'fireObj7' },
    { id: 'evac_route', textKey: 'fireObj8' },
    { id: 'assembly', textKey: 'fireObj9' },
    { id: 'assess', textKey: 'fireObj10' },
  ];

  function once(id, fn) {
    if (consumed.has(id)) return false;
    consumed.add(id);
    fn();
    return true;
  }

  return {
    id: 'fire',
    name: 'Fire & Explosion Response',
    objectives,
    onStart() {
      onNotify?.('moduleStarted', 'info');
      timers.push(setTimeout(() => onVisual?.('completeObj', 'identify'), 2500));
    },
    dispose() {
      timers.forEach(clearTimeout);
      timers.length = 0;
    },
    onEvent(eventName, payload, api) {
      const { objectives: objMgr, score, complete } = api;
      if (eventName !== 'fire' || hasExtinguisher) onVisual?.('tip', eventName);

      switch (eventName) {
        case 'alarm_button':
          once('alarm_button', () => {
            score.addCorrect();
            onNotify?.('correctAction', 'success');
            onVisual?.('alarm');
            if (objMgr.completeById('identify')) score.completeObjective();
          });
          break;

        case 'ext_CO2':
          once('ext_CO2', () => {
            hasExtinguisher = true;
            correctExt = true;
            score.addCorrect();
            onNotify?.('correctAction', 'success');
            if (objMgr.completeById('locate_ext')) score.completeObjective();
            if (objMgr.completeById('select_ext')) score.completeObjective();
            if (objMgr.completeById('pickup')) score.completeObjective();
            onVisual?.('pickupExt', 'CO2');
          });
          break;

        case 'ext_Foam':
        case 'ext_DryPowder':
          once(eventName, () => {
            hasExtinguisher = true;
            correctExt = false;
            score.addWrong();
            onNotify?.('wrongAction', 'warning');
            if (objMgr.completeById('locate_ext')) score.completeObjective();
            if (objMgr.completeById('pickup')) score.completeObjective();
            onVisual?.('pickupExt', eventName.replace('ext_', ''));
          });
          break;

        case 'fire':
          if (!hasExtinguisher) {
            if (!consumed.has('fire_unsafe')) {
              consumed.add('fire_unsafe');
              score.addUnsafe();
              onNotify?.('unsafeAction', 'danger');
            }
            return;
          }
          once('fire_extinguish', () => {
            fireOut = true;
            if (correctExt) {
              score.addCorrect();
              onNotify?.('fireExtinguished', 'success');
            } else {
              score.addWrong();
              onNotify?.('wrongAction', 'warning');
            }
            if (objMgr.completeById('approach')) score.completeObjective();
            if (objMgr.completeById('extinguish')) score.completeObjective();
            onVisual?.('extinguish');
          });
          break;

        case 'emergency_exit':
          if (!fireOut && !consumed.has('exit_early')) {
            consumed.add('exit_early');
            score.addUnsafe();
            onNotify?.('unsafeAction', 'danger');
          }
          once('emergency_exit', () => {
            exited = true;
            score.addCorrect();
            if (objMgr.completeById('find_exit')) score.completeObjective();
            if (objMgr.completeById('evac_route')) score.completeObjective();
            onNotify?.('correctAction', 'success');
            onVisual?.('exit');
          });
          break;

        case 'assembly_point':
          if (!exited || !fireOut) {
            onNotify?.('wrongAction', 'warning');
            return;
          }
          once('assembly_point', () => {
            score.evacuationBonus();
            if (objMgr.completeById('assembly')) score.completeObjective();
            if (objMgr.completeById('assess')) score.completeObjective();
            onNotify?.('evacuationComplete', 'success');
            onVisual?.('assembly');
            complete();
          });
          break;
      }
    },
    onComplete() {
      onNotify?.('moduleComplete', 'success');
    },
  };
}
