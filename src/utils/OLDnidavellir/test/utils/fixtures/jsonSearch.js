export const jsonObj = {
  alpha: 1,
  bravo: [1, 2, 3],
  charlie: { delta: 1 },
  india: {
    kilo: 4,
    lima: 4
  },
  uniform: {
    kilo: 4,
    lima: 4
  },
  echo: {
    foxtrot: [1, 2, 3],
    golf: {
      india: {
        kilo: 4,
        lima: 4
      },
      juliet: {
        kilo: 4,
        lima: 5
      },
      mike: [
        { kilo: 4 },
        6,
        { lima: 5 },
        { lima: 6, kilo: 7 },
        { charlie: { delta: 1 } },
        { alpha: 1 },
        [ 6, { lima: 5 }, 10 ]
      ],
      november: 8
    }
  }
}

export const fixtures = [
  [ [], [jsonObj] ],

  [ ['$.lima'], [] ],

  [ ['lima'], [] ],

  [ ['$..lima'], [
    jsonObj['india']['lima'],
    jsonObj['uniform']['lima'],
    jsonObj['echo']['golf']['india']['lima'],
    jsonObj['echo']['golf']['juliet']['lima'],
    jsonObj['echo']['golf']['mike'][2]['lima'],
    jsonObj['echo']['golf']['mike'][3]['lima'],
    jsonObj['echo']['golf']['mike'][6][1]['lima']
  ] ],

  [ ['$..charlie'], [
    jsonObj['echo']['golf']['mike'][4]['charlie'],
    jsonObj['charlie']
  ] ],

  [ ['$.charlie.delta', 1], [
    jsonObj['charlie']
  ] ],

  [ ['charlie.delta', 1], [
    jsonObj['charlie']
  ] ],

  [ ['echo.golf.india.kilo', 4], [
    jsonObj['echo']['golf']['india']
  ] ],

  [ ['$.lima', 1], [] ],

  [ ['lima', 1], [] ],

  [ ['$..alpha', 1], [
    jsonObj['echo']['golf']['mike'][5],
    jsonObj
  ] ],

  [ ['$..alpha', 2], [] ],

  [ ['$..charlie', 1], [] ],

  [ ['$..delta', 1], [
    jsonObj['charlie'],
    jsonObj['echo']['golf']['mike'][4]['charlie']
  ] ],

  [ ['$..charlie.delta', 1], [
    jsonObj['charlie'],
    jsonObj['echo']['golf']['mike'][4]['charlie']
  ] ],

  [ ['$..india.kilo', 5], [] ],

  [ ['$..india.lima', 5], [] ],

  [ ['$..echo.golf.india.kilo', 4], [jsonObj['echo']['golf']['india']] ],

  [ ['$..echo.golf.india.kilo', 5], [] ],

  [ ['$..echo.golf.november', 8], [jsonObj['echo']['golf']] ],

  [ ['$..india.kilo', 4], [
    jsonObj['india'],
    jsonObj['echo']['golf']['india']
  ] ],

  [ ['$..lima', 5], [
    jsonObj['echo']['golf']['juliet'],
    jsonObj['echo']['golf']['mike'][2],
    jsonObj['echo']['golf']['mike'][6][1]
  ] ],

  [ ['$..lima', 4], [
    jsonObj['india'],
    jsonObj['uniform'],
    jsonObj['echo']['golf']['india']
  ] ],

  [ ['$..kilo', 4], [
    jsonObj['india'],
    jsonObj['uniform'],
    jsonObj['echo']['golf']['india'],
    jsonObj['echo']['golf']['juliet'],
    jsonObj['echo']['golf']['mike'][0]
  ] ],

  [ ['$..golf..delta', 1], [
    jsonObj['echo']['golf']['mike'][4]['charlie']
  ] ],

  [ ['$..mike..delta', 1], [
    jsonObj['echo']['golf']['mike'][4]['charlie']
  ] ],

  [ ['$..echo.foxtrot', 2], [
    jsonObj['echo']['foxtrot']
  ] ],

  [ ['$..bravo', 0], [] ],

  [ ['$..bravo', 1], [jsonObj['bravo']] ],

  [ ['$..bravo'], [
    jsonObj['bravo']
  ] ],

  [ ['bravo'], [
    jsonObj['bravo']
  ] ],

  [ ['$.bravo'], [
    jsonObj['bravo']
  ] ],

  [ ['$.echo.foxtrot'], [
    jsonObj['echo']['foxtrot']
  ] ],

  [ ['$..mike'], [
    jsonObj['echo']['golf']['mike']
  ] ],

  [ ['$.echo.golf.*'], [
    jsonObj['echo']['golf']['india'],
    jsonObj['echo']['golf']['juliet'],
    jsonObj['echo']['golf']['mike'],
    jsonObj['echo']['golf']['november']
  ] ],

  [ ['$.*'], [
    jsonObj['alpha'],
    jsonObj['bravo'],
    jsonObj['charlie'],
    jsonObj['india'],
    jsonObj['uniform'],
    jsonObj['echo']
  ] ]
]
