const http = require('http')
const process = require('process')
const util = require('util')

process.on('SIGINT', () => {
  console.info("Exiting...")
  process.exit(0)
})

const port = process.env.PORT || '8000'

http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'application/json'})
  res.write(util.inspect(req.headers, { depth: null, compact: false }))
  res.end()
}).listen(port)

console.log(`Listening on port ${port}`)

