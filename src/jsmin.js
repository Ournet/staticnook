var UglifyJS = require('uglify-js');

var jsmin = module.exports = {
  minify:function(data, options){
    return UglifyJS.minify(data, options);
  }
}