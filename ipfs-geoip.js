var countries = require('country-data').countries

function aton4 (a) {
  a = a.split(/\./)
  return ((parseInt(a[0], 10)<<24)>>>0) + ((parseInt(a[1], 10)<<16)>>>0) + ((parseInt(a[2], 10)<<8)>>>0) + (parseInt(a[3], 10)>>>0)
}

function formatData (data) {
  var obj = {}
  if (data[0]) {
    obj.country_code = data[0]
    obj.country_name = countries[data[0]].name
  }
  if (data[1]) obj.region_code = data[1]
  if (data[2]) obj.city = data[2]
  if (data[3]) obj.postal_code = data[3]
  if (data[4]) obj.latitude = parseFloat(data[4])
  if (data[5]) obj.longitude = parseFloat(data[5])
  if (data[6]) obj.metro_code = data[6]
  if (data[7]) obj.area_code = data[7]

  return obj
}

function _lookup (ipfs, hash, lookfor, cb) {
  ipfs.object.get(hash, function (err, res) {
    if (err) {
      cb(err, null)
    } else {
      var obj = JSON.parse(res.Data)

      var child = 0;
      if (obj.type == 'Node') {
        while (obj.mins[child] &&
               obj.mins[child] <= lookfor) {
          child++
        }
        return _lookup(ipfs, res.Links[child-1].Hash, lookfor, cb)
      } else if (obj.type == 'Leaf') {
        while (obj.data[child] &&
               obj.data[child].min <= lookfor) {
          child++
        }
        if (obj.data[child-1].data) {
          cb(null, formatData(obj.data[child-1].data))
        } else {
          cb("Unmapped range", null)
        }
      }
    }
  })
}

function lookup (ipfs, hash, ip, cb) {
  _lookup(ipfs, hash, aton4(ip), cb)
}

module.exports = {lookup: lookup,
                  _lookup: _lookup}
