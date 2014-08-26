var path = require('path');
var staticnook = require('./staticnook');

var configfile = path.join(process.cwd(),'staticnook.yml');

console.log(configfile);

staticnook.run(__dirname+'/..', configfile);