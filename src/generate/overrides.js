'use strict'

// Source data is not perfect, below are manual overrides applied to geo names
const overrides = new Map([
  // ['original', 'override']
  ['Antigua And Barbuda', 'Antigua and Barbuda'],
  ['Bosnia & Herzegovina', 'Bosnia and Herzegovina'],
  ['Bolivia, Plurinational State Of', 'Bolivia'],
  ['Bonaire, Saint Eustatius And Saba', 'Bonaire, Saint Eustatius and Saba'],
  ['Democratic Republic Of Congo', 'Democratic Republic of Congo'],
  ['Republic Of Congo', 'Republic of Congo'],
  ['Czech Republic', 'Czechia'],
  ['Ceuta, Mulilla', 'Ceuta and Melilla'],
  ['Micronesia, Federated States Of', 'Micronesia'],
  ['France, Metropolitan', 'Metropolitan France'],
  ['South Georgia And The South Sandwich Islands', 'South Georgia and the South Sandwich Islands'],
  ['Guinea-bissau', 'Guinea-Bissau'],
  ['Heard Island And McDonald Islands', 'Heard Island and McDonald Islands'],
  ['Isle Of Man', 'Isle of Man'],
  ['Iran, Islamic Republic Of', 'Iran'],
  ['Saint Kitts And Nevis', 'Saint Kitts and Nevis'],
  ["Korea, Democratic People's Republic Of", 'North Korea'],
  ['Korea, Republic Of', 'South Korea'],
  ["Lao People's Democratic Republic", 'Laos'],
  ['Macedonia, The Former Yugoslav Republic Of', 'North Macedonia'],
  ['Saint Pierre And Miquelon', 'Saint Pierre and Miquelon'],
  ['Palestinian Territory, Occupied', 'Palestine'],
  ['Saint Helena, Ascension And Tristan Da Cunha', 'Saint Helena, Ascension and Tristan da Cunha'],
  ['Svalbard And Jan Mayen', 'Svalbard and Jan Mayen'],
  ['Syrian Arab Republic', 'Syria'],
  ['Turks And Caicos Islands', 'Turks and Caicos Islands'],
  ['Tristan de Cunha', 'Tristan da Cunha'],
  ['Trinidad And Tobago', 'Trinidad and Tobago'],
  ['Taiwan, Province Of China', 'Taiwan'],
  ['Tanzania, United Republic Of', 'Tanzania'],
  ['United States', 'USA'],
  ['Vatican City State', 'Vatican City'],
  ['Saint Vincent And The Grenadines', 'Saint Vincent and the Grenadines'],
  ['Venezuela, Bolivarian Republic Of', 'Venezuela'],
  ['Virgin Islands (British)', 'British Virgin Islands'],
  ['Virgin Islands (US)', 'US Virgin Islands'],
  ['Viet Nam', 'Vietnam'],
  ['Wallis And Futuna', 'Wallis and Futuna']
])

export default function normalizeName (name) {
  if (overrides.has(name)) return overrides.get(name)
  return name
}
