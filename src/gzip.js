var zlib = require('zlib');

var gzip = module.exports = {
  compress: function(data, cb){
    zlib.gzip(data, cb);
  }
}