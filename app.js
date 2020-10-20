const { createServer } = require("http");
const { resolve, sep } = require("path");
const { createReadStream, createWriteStream } = require("fs");
const { stat, readdir } = require("fs").promises
const commandLineArgs = require("command-line-args")

const optionDefinitions = [
  { name: "port", alias: "p", type: String, defaultValue: "8000" },
  { name: "directory", alias: "d", type: String, defaultOption: true, defaultValue: "." },
  { name: "host", alias: "h", type: String, defaultValue: "0.0.0.0"}
]
const args = commandLineArgs(optionDefinitions);

const path = resolve(args.directory);
// check if path exists and is a directory
stat(path)
  .then(stats => {
    if (!stats.isDirectory()) throw new Error;
  })
  .catch(() => console.log(`No such directory "${args.directory}"`));

const methods = Object.create(null);
const server = createServer((request, response) => {
  let handler = methods[request.method] || notAllowed;
  handler(request)
    .catch(error => {
      if (error.status !== null) return error;
      else return {status: 500, body: String(error)};
    })
    .then(({body, status = 200, type = "text/plain"}) => {
      response.writeHead(status, {"Content-Type": type});
      // if body is a readStream, pipe it to response
      if (body && body.pipe) body.pipe(response); 
      else response.end(body);
    })
}).listen(args.port, args.host);

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log(`Port ${args.port} in use, retrying...`);
    setTimeout(() => {
      server.close();
      server.listen(args.port, args.host);
    }, 1000);
  }
});


async function notAllowed(request) {
  return {
    status: 405,
    body: `Method ${request.method} not allowed.`
  };
}

