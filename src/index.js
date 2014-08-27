var path = require('path');
var fs = require('fs');
var staticnook = require('./staticnook');

var root = process.cwd();

var configfile = path.join(root,'staticnook.yml');

if(!fs.existsSync(configfile)){
  configfile = path.join(root,'staticnook.json');
  if(!fs.existsSync(configfile)){
    console.log('not found config file!');
    return;
  }
}

console.log('config: '+configfile);

staticnook.run(__dirname+'/..', configfile);