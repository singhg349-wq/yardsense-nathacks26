// Human-readable equipment class names, shared by the timeline and re-plan card.
export const CLASS_NAMES = {
  SCISSOR_19: '19 ft scissor lift',
  BOOM_60: '60 ft boom lift',
  HEATER_400K: '400k BTU heater',
  GEN_45KW: '45 kW generator',
  TELEHANDLER: 'Telehandler',
  MINI_EX: 'Mini excavator',
  PLATE_COMPACTOR: 'Plate compactor',
  LIGHT_TOWER: 'Light tower',
}

export function className(code) {
  return CLASS_NAMES[code] ?? code
}
