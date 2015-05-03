// countries is added in make all
var COUNTRIES = {}
var GEOIP_ROOT = "QmQQ3BUpPjgYiTdhp4H9YWSCtoFXs8t91njhpvXNNLd3yB"

function aton4 (a) {
  a = a.split(/\./)
  return ((parseInt(a[0], 10)<<24)>>>0) + ((parseInt(a[1], 10)<<16)>>>0) + ((parseInt(a[2], 10)<<8)>>>0) + (parseInt(a[3], 10)>>>0)
}

function formatData (data) {
  var obj = {}

  if (data[0]) obj.country_name = data[0]
  if (data[1]) obj.country_code = data[1]
  if (data[2]) obj.region_code = data[2]
  if (data[3]) obj.city = data[3]
  if (data[4]) obj.postal_code = data[4]
  if (data[5]) obj.latitude = parseFloat(data[5])
  if (data[6]) obj.longitude = parseFloat(data[6])
  if (data[7]) obj.metro_code = data[7]
  if (data[8]) obj.area_code = data[8]

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

function lookup (ipfs, ip, cb) {
  _lookup(ipfs, GEOIP_ROOT, aton4(ip), cb)
}

function lookup_root (ipfs, hash, ip, cb) {
  _lookup(ipfs, hash, aton4(ip), cb)
}

module.exports = {lookup: lookup,
                  lookup_root: lookup_root,
                  _lookup: _lookup}
