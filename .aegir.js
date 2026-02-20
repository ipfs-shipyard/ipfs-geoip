import http from 'node:http'
import fs from 'node:fs'

export default {
  tsRepo: false,
  dependencyCheck: {
    input: [
      'dist/**/*.js',
    ],
    productionInput: [
      'dist/**/*.js',
    ],
  },
  build: {
    config: {
      format: 'esm',
      banner: {
        js: ''
      },
      footer: {
        js: ''
      }
    }
  },
  test: {
    before: async (...args) => {
      // set up a server to serve the fixtures
      const server = http.createServer((req, res) => {
        const cidString = req.url.replace('/ipfs/', '').split('?')[0]
        const fixturePath = `./test/fixtures/${cidString}.raw.bin`
        try {
          const mockBlock = fs.readFileSync(fixturePath, null)
          res.writeHead(200, {
            'access-control-allow-origin': '*', // allow CORS requests
            'Content-Type': 'application/vnd.ipld.raw',
            'Content-Length': mockBlock.length
          })
          res.end(mockBlock)
        } catch {
          res.writeHead(404, { 'access-control-allow-origin': '*' })
          res.end(`Fixture not found: ${cidString}`)
        }
      })
      let gwUrl = process.env.IPFS_GATEWAY
      if (!gwUrl) {
        // no gateway specified, start the server
        await new Promise((resolve, _reject) => {
          server.listen(0, () => {
            gwUrl = `http://localhost:${server.address().port}`
            console.log(`server listening at ${gwUrl}`)
            resolve()
          })
        })
      }

      return {
        server,
        env: {
          IPFS_GATEWAY: gwUrl,
        }
      }
    },
    after: (_, before) => {
      before.server.close()
    }
  }
}
