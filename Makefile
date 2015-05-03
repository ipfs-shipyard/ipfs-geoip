all:
	cat src/lookup.js > ipfs-geoip.js
	node generate/countries.js >> ipfs-geoip.js
