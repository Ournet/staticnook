var cleancss = require('clean-css');

var cssmin = module.exports = {
  minify: function(data, options) {
    options = options || {};
    var m = new cleancss(options);
    return m.minify(data);
  }
}