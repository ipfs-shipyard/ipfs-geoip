'use strict'

var l = require('./lib/lookup')
var lookupPretty = require('./lib/pretty')

module.exports = {
  lookup: l.lookup,
  lookup_root: l.lookup_root,
  _lookup: l._lookup,
  lookupPretty: lookupPretty
}
