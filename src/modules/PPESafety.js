export function createPPEScenarioConfig({ onNotify, onVisual }) {
  const required = ['helmet', 'shoes', 'gloves', 'goggles', 'vest'];
  const selected = new Set();
  const consumed = new Set();

  const objectives = required.map((id) => ({ id, textKey: 'ppeObj_' + id }));
  objectives.push({ id: 'complete', textKey: 'ppeObj_complete' });

  return {
    id: 'ppe',
    name: 'PPE Training',
    objectives,
    onStart() {
      onNotify?.('moduleStarted', 'info');
    },
    dispose() {},
    onEvent(eventName, payload, api) {
      const { objectives: objMgr, score, complete } = api;

      if (eventName === 'sandals') {
        if (!consumed.has('sandals')) {
          consumed.add('sandals');
          score.addWrong();
          onNotify?.('wrongAction', 'warning');
          onVisual?.('wrongItem', 'sandals');
          onVisual?.('tip', 'sandals');
        }
        return;
      }

      if (required.includes(eventName)) {
        if (consumed.has(eventName)) return;
        consumed.add(eventName);
        selected.add(eventName);
        score.addCorrect();
        if (objMgr.completeById(eventName)) score.completeObjective();
        onNotify?.('correctAction', 'success');
        onVisual?.('ppeOn', eventName);
        onVisual?.('tip', eventName);

        if (required.every((r) => selected.has(r))) {
          if (!consumed.has('ppe_done')) {
            consumed.add('ppe_done');
            if (objMgr.completeById('complete')) score.completeObjective();
            onNotify?.('objectiveComplete', 'success');
            complete();
          }
        }
      }
    },
    onComplete() {
      onNotify?.('moduleComplete', 'success');
    },
  };
}
