const {createServer} = require("http");
const {resolve, sep} = require("path");
const {createReadStream, createWriteStream} = require("fs");
const {stat, readdir} = require("fs").promises
const commandLineArgs = require('command-line-args')

const optionDefinitions = [
    { name: 'port', alias: 'p', type: String, defaultValue: "8000" },
    { name: 'directory', alias: 'd', type: String, defaultOption: true, defaultValue: "." },
]

const args = commandLineArgs(optionDefinitions);


const path = resolve(args.directory);  
stat(path).then(stats => {
    if(!stats.isDirectory()) throw new Error; 
}).catch(e => console.log(`No such directory "${args.directory}"`));

const methods = Object.create(null);

