/**
 * Machinery Safety module — danger-zone awareness, PPE, emergency stop, then
 * Lockout/Tagout. Order taught: recognise hazard → respect the zone → PPE →
 * e-stop → lock out.
 */
export function createMachineryScenarioConfig({ onNotify, onVisual }) {
  let machineStopped = false;
  let hasPPE = false;
  const consumed = new Set();

  const objectives = [
    { id: 'identify_hazard', textKey: 'machObj1' },
    { id: 'danger_zone', textKey: 'machObj2' },
    { id: 'select_ppe', textKey: 'machObj3' },
    { id: 'e_stop', textKey: 'machObj4' },
    { id: 'lockout', textKey: 'machObj5' },
    { id: 'complete', textKey: 'machObj6' },
  ];

  function once(id, fn) {
    if (consumed.has(id)) return false;
    consumed.add(id);
    fn();
    return true;
  }

  return {
    id: 'machinery',
    name: 'Machinery Safety',
    objectives,
    onStart() {
      onNotify?.('moduleStarted', 'info');
    },
    dispose() {},
    onEvent(eventName, payload, api) {
      const { objectives: objMgr, score, complete } = api;

      switch (eventName) {
        case 'hazard_sign':
          once('hazard_sign', () => {
            score.addCorrect();
            if (objMgr.completeById('identify_hazard')) score.completeObjective();
            onNotify?.('correctAction', 'success');
            onVisual?.('tip', 'hazard_sign');
          });
          break;

        // Trainee walked up to the painted caution lane — objective credit, no penalty.
        // BUGFIX: this objective could previously only be completed by walking INTO the
        // moving-parts hazard (a penalised, unsafe action), leaving the HUD stuck on it.
        case 'danger_zone_seen':
          once('danger_zone_seen', () => {
            if (objMgr.completeById('danger_zone')) score.completeObjective();
            onNotify?.('objectiveComplete', 'success');
            onVisual?.('tip', 'danger_zone_seen');
          });
          break;

        case 'enter_hazard':
          once('enter_hazard_' + (payload?.zone || 'default'), () => {
            if (!hasPPE) {
              score.addUnsafe();
              onNotify?.('unsafeAction', 'danger');
            }
            if (objMgr.completeById('danger_zone')) score.completeObjective();
          });
          break;

        case 'ppe_station':
          once('ppe_station', () => {
            hasPPE = true;
            score.addCorrect();
            if (objMgr.completeById('select_ppe')) score.completeObjective();
            onNotify?.('correctAction', 'success');
            onVisual?.('tip', 'ppe_station');
          });
          break;

        case 'emergency_stop':
          once('emergency_stop', () => {
            if (!hasPPE) {
              score.addUnsafe();
              onNotify?.('unsafeAction', 'danger');
            }
            machineStopped = true;
            score.addCorrect();
            if (objMgr.completeById('e_stop')) score.completeObjective();
            onNotify?.('correctAction', 'success');
            onVisual?.('machineStop');
            onVisual?.('tip', 'emergency_stop');
          });
          break;

        case 'lockout_tagout':
          if (!machineStopped) {
            // Penalise once, not on every press
            once('lockout_before_stop', () => {
              score.addUnsafe();
              onNotify?.('unsafeAction', 'danger');
            });
            return;
          }
          once('lockout_tagout', () => {
            score.addCorrect();
            if (objMgr.completeById('lockout')) score.completeObjective();
            if (objMgr.completeById('complete')) score.completeObjective();
            onNotify?.('correctAction', 'success');
            onVisual?.('lockout');
            onVisual?.('tip', 'lockout_tagout');
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
