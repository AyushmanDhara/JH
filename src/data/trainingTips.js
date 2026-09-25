/**
 * Short "why this matters" tips shown when the trainee performs a key action.
 * Kept out of the scenario logic so content can be edited without touching rules.
 * Keyed by module id → interaction/event id.
 */
export const TRAINING_TIPS = {
  fire: {
    alarm_button: 'Raise the alarm first — alert everyone before you tackle a fire.',
    ext_CO2: 'CO₂ is the right choice for live electrical / machinery fires: it leaves no residue and does not conduct electricity.',
    ext_Foam: 'Foam contains water and can conduct electricity — unsafe on a live electrical fire. Use CO₂.',
    ext_DryPowder: 'Dry powder works but leaves a corrosive residue that damages machinery. CO₂ is preferred here.',
    fire: 'Use PASS: Pull the pin, Aim at the base, Squeeze the handle, Sweep side to side.',
    emergency_exit: 'Always know two exits. Never use lifts in a fire — follow the marked evacuation route.',
    assembly_point: 'Report to the assembly point for a headcount. Do not re-enter until cleared.',
  },
  gas: {
    gas_sign: 'A gas warning means STOP. Do not enter until the atmosphere has been tested.',
    ppe_station: 'Select gas-rated PPE (and breathing apparatus where required) before approaching the hazard.',
    gas_detector: 'Test the atmosphere first: check oxygen, flammable gas and toxic gas readings before entry.',
    gas_alarm: 'Report the leak and raise the alarm — use the buddy system, never enter a hazard zone alone.',
    safe_zone: 'Move to the safe zone upwind / crosswind of the leak and wait for the all-clear.',
    gas_exit: 'Confined-space entry needs a permit, atmosphere testing and a standby person outside.',
  },
  machinery: {
    hazard_sign: 'Danger signs mark moving parts. Never reach into or walk across an operating conveyor or rotor.',
    danger_zone_seen: 'The painted lane marks where moving parts can reach you. Stay out until the machine is isolated.',
    ppe_station: 'Tight clothing, hair tied back, no loose jewellery, plus helmet, gloves and safety shoes near machinery.',
    emergency_stop: 'The e-stop halts the machine — but stopping is NOT the same as making it safe.',
    lockout_tagout: 'Lockout/tagout: isolate power, apply your personal lock and tag, then verify zero energy before service.',
  },
  ppe: {
    helmet: 'Helmets protect against falling objects and knocks to the head. Replace after any heavy impact.',
    shoes: 'Steel-toe, slip-resistant safety shoes protect against crush injuries and sharp or hot surfaces.',
    gloves: 'Choose gloves for the hazard: cut-resistant, chemical-resistant or heat-resistant.',
    goggles: 'Goggles guard against dust, sparks and splashes — normal glasses are not eye protection.',
    vest: 'A reflective vest makes you visible to vehicle and crane operators, day and night.',
    sandals: 'Open footwear offers no protection from crush, cuts or hot material — never acceptable on site.',
  },
};

export function getTip(moduleId, key) {
  return TRAINING_TIPS[moduleId]?.[key] || null;
}
