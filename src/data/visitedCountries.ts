// Countries you have visited, shown highlighted on the globe on the Trips page.
//
// To add a country, add an entry with its ISO 3166-1 alpha-3 code
// (see https://en.wikipedia.org/wiki/ISO_3166-1_alpha-3, e.g. FRA, ESP, JPN).
// The optional `note` is shown in the tooltip and the info card.
//
// `places` is optional: cities/spots you visited inside the country. They get
// a marker on the globe once the country is selected, and a clickable chip in
// the info card that zooms in on them.

export interface VisitedPlace {
  name: string
  lat: number
  lng: number
}

export interface VisitedCountry {
  code: string
  note?: string
  /** Free text shown in the country card — write whatever you like. */
  description?: string
  places?: VisitedPlace[]
}

export const visitedCountries: VisitedCountry[] = [
  {
    code: 'NLD',
    note: 'Home',
    description: 'Where I was born and raised. Edit this text in src/data/visitedCountries.ts.',
  },
  {
    code: 'BRA',
    note: 'Exchange at Inteli, São Paulo',
    description:
      'I spent my exchange semester at Inteli in São Paulo and travelled around the country. Edit this text in src/data/visitedCountries.ts.',
    places: [
      { name: 'São Paulo', lat: -23.5505, lng: -46.6333 },
      { name: 'Belo Horizonte', lat: -19.9167, lng: -43.9345 },
      { name: 'Salvador', lat: -12.9777, lng: -38.5016 },
      { name: 'Rio de Janeiro', lat: -22.9068, lng: -43.1729 },
    ],
  },
]
