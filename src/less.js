var lessObj = require('less')

var less = module.exports = {
  render: function(data, options, cb){
    options = options || {};
    lessObj.render(data, options, function (e, css) {
      //console.log([e,css]);
      //console.log('done less!');
      cb(e, css);
    });
  }
}