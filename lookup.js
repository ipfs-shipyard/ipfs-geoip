var ipfs = require('./ipfs.js')()

function aton4 (a) {
	a = a.split(/\./)
	return ((parseInt(a[0], 10)<<24)>>>0) + ((parseInt(a[1], 10)<<16)>>>0) + ((parseInt(a[2], 10)<<8)>>>0) + (parseInt(a[3], 10)>>>0)
}

function _lookup (hash, lookfor, cb) {
	ipfs.object.get(hash, function (err, res) {
		var data = JSON.parse(res.Data)

		var child = 0;
		if (data.type == 'Node') {
			while (data.mins[child] < lookfor &&
						 child != data.mins.length) {
				child++
			}
			return _lookup(res.Links[child-1].Hash, lookfor, cb)
		} else if (data.type == 'Leaf') {
			while (data.data[child].min < lookfor &&
						 child != data.data.length) {
				child++
			}

			cb(null, data.data[child-1].data)
		}
	})
}

function lookup (hash, ip, cb) {
	_lookup(hash, aton4(ip), cb)
}

if (process.argv.length != 4) {
	console.log("usage: node lookup.js root <ip4-adr>")
	process.exit(1)
}

lookup(process.argv[2], process.argv[3], function (err, result) {
	console.log(result)
})
