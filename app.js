const { createServer } = require("http");
const { resolve, sep } = require("path");
const { createReadStream, createWriteStream } = require("fs");
const { stat, readdir, rmdir, unlink, mkdir } = require("fs").promises;
const commandLineArgs = require("command-line-args");
const mime = require("mime");


const optionDefinitions = [
  { name: "port", alias: "p", type: String, defaultValue: "8000" },
  { name: "directory", alias: "d", type: String, defaultOption: true, defaultValue: "." },
  { name: "host", alias: "h", type: String, defaultValue: "0.0.0.0"}
]
const args = commandLineArgs(optionDefinitions);

const baseDirectory = resolve(args.directory);
// check if baseDirectory exists and is a directory
stat(baseDirectory)
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

function urlPath(url) {
  let pathname = decodeURIComponent(url);
  return resolve(baseDirectory, pathname.slice(1));
}

methods.GET = async function(request) {
  let path = urlPath(request.url);
  let stats;
  try {
    stats = await stat(path);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    else return {status: 404, body: "File not found"};
  }
  if (stats.isDirectory()) {
    return {body: (await readdir(path)).join("\n")};
  } else {
    return {
      body: createReadStream(path),
      type: mime.getType(path)
    }
  }
};

methods.DELETE = async function(request) {
  let path = urlPath(request.url);
  let stats;
  try {
    stats = await stat(path);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    else return {status: 204};
  }
  if (stats.isDirectory()) await rmdir(path);
  else await unlink(path);
  return {status: 204};
}

function pipeStream(from, to) {
  return new Promise((resolve, reject) => {
    from.on("error", reject);
    to.on("error", reject);
    to.on("finish", resolve);
    from.pipe(to);
  })
}

methods.PUT = async function(request) {
  let path = urlPath(request.url);
  await pipeStream(request, createWriteStream(path));
  return {status: 204};
}

methods.MKCOL = async function(request) {
  let path = urlPath(request.url);
  try {
    await mkdir(path);
    return {status: 204}
  } catch(e) {
    return {status: 409}
  }
}