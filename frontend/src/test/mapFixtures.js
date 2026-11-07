// Same shapes and values the API returns for the seed data.
export const sites = [
  { id: 'Y-NB', name: 'Northgate Builders yard', kind: 'yard', company: 'NB01', address: '11240 Alder Industrial Way NW, Edmonton, AB', lat: 53.57, lon: -113.42 },
  { id: 'Y-NR', name: 'Northgate Rentals yard', kind: 'yard', company: 'NR01', address: '4410 Birchfield Road SW, Edmonton, AB', lat: 53.454, lon: -113.465 },
  { id: 'S-RIV', name: 'Riverside Clinic site', kind: 'site', company: 'NB01', address: '9820 Maple Bank Drive NW, Edmonton, AB', lat: 53.538, lon: -113.495 },
  { id: 'S-WGT', name: 'Westgate Tower site', kind: 'site', company: 'NB01', address: '17250 Cedar Gate Avenue NW, Edmonton, AB', lat: 53.542, lon: -113.615 },
  { id: 'S-KNG', name: 'Kingsway Lofts site', kind: 'site', company: 'NB01', address: '10510 Larch Street NW, Edmonton, AB', lat: 53.561, lon: -113.505 },
  { id: 'S-CAP', name: 'Capilano Substation site', kind: 'site', company: 'NE01', address: '7380 Hazel Grid Road NW, Edmonton, AB', lat: 53.53, lon: -113.415 },
  { id: 'S-EX1', name: 'Spruce Grove Storage (rental customer)', kind: 'site', company: 'NR01', address: '310 Poplar Court, Spruce Grove, AB', lat: 53.545, lon: -113.9 },
  { id: 'S-EX2', name: 'Leduc Cold Storage (rental customer)', kind: 'site', company: 'NR01', address: '905 Willow Park Road, Leduc, AB', lat: 53.265, lon: -113.55 },
]

export const classes = [
  { code: 'SCISSOR_19', label: '19 ft scissor lift' },
  { code: 'TELEHANDLER', label: 'Telehandler' },
  { code: 'GEN_45KW', label: '45 kW generator' },
]

const move = (asset_id, from_site_id, to_site_id, km, transport_cost) => ({ asset_id, from_site_id, to_site_id, km, transport_cost })

export const allocations = [
  { request_id: 'PRJ-RIV:0', site_id: 'S-RIV', class: 'SCISSOR_19', option: 'rent_sister', start: '2026-11-23', finish: '2027-01-31', kept_in_group: 4978.28,
    moves: [move('100003', 'Y-NR', 'S-RIV', 12.4, 205.86), move('100004', 'Y-NR', 'S-RIV', 12.4, 205.86)] },
  { request_id: 'PRJ-RIV:1', site_id: 'S-RIV', class: 'TELEHANDLER', option: 'move_ours', start: '2026-11-23', finish: '2027-01-31', kept_in_group: 6403.54,
    moves: [move('100017', 'S-WGT', 'S-RIV', 10.3, 196.46)] },
  { request_id: 'PRJ-RIV:2', site_id: 'S-RIV', class: 'GEN_45KW', option: 'buy', start: '2026-11-23', finish: '2027-01-31', kept_in_group: 560.59, moves: [] },
  { request_id: 'PRJ-CAP:2', site_id: 'S-CAP', class: 'SCISSOR_19', option: 'rent_sister', start: '2027-02-01', finish: '2027-08-27', kept_in_group: 7081.64,
    moves: [move('100003', 'S-RIV', 'S-CAP', 7, 181.36)] },
  { request_id: 'PRJ-KNG:5', site_id: 'S-KNG', class: 'GEN_45KW', option: 'rent_sister', start: '2027-02-01', finish: '2027-06-06', kept_in_group: 1956.55,
    moves: [move('BUY-GEN_45KW-1', 'S-RIV', 'S-KNG', 3.4, 165.45)] },
  { request_id: 'PRJ-WMD:3', site_id: 'S-KNG', class: 'TELEHANDLER', option: 'rent_outside', start: '2027-02-01', finish: '2027-08-27', kept_in_group: 0, moves: [] },
]

export const idle = [
  { asset_id: '100003', description: 'Scissor Lift 19 ft electric', site_id: 'Y-NR', where: 'at Northgate Rentals yard' },
  { asset_id: '100004', description: 'Scissor Lift 19 ft electric', site_id: 'Y-NR', where: 'at Northgate Rentals yard' },
  { asset_id: '100017', description: 'Telehandler 10k lb 55 ft', site_id: 'S-WGT', where: 'at Westgate Tower site since Nov 6' },
  { asset_id: '100050', description: 'Mini Excavator 3.5 t', site_id: 'S-KNG', where: 'at Kingsway Lofts site since Oct 2' },
]

const out = (asset_id, project_id, site_id) => ({ asset_id, project_id, site_id, checked_out: '2026-09-14', checked_in: null })

export const assignments = [
  out('100017', 'PRJ-WGT', 'S-WGT'), // Still checked out, but its phase ended: idle, not working.
  out('100018', 'PRJ-WGT', 'S-WGT'),
  out('100050', 'PRJ-KNG', 'S-KNG'),
  out('100051', 'PRJ-KNG', 'S-KNG'),
  out('100060', null, 'S-EX1'),
  out('100061', null, 'S-EX2'),
  out('100062', null, 'S-EX2'),
  { ...out('100070', 'PRJ-KNG', 'S-KNG'), checked_in: '2026-10-01' },
]
