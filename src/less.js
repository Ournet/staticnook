var lessObj = require('less')
var path = require('path')
var fs = require('fs')

var less = module.exports = {
  render: function(data, options, cb){
    //console.log('options: ');
    //console.log(options);
    //var content = getFileContent(data, filename);
    //console.log('css rendering: '+content);
    lessObj.render(data, options, cb);
  }
}

function getFileContent(data, filename){
  var info = getImportInfo(data);
  if(info == null) return data;
  filename = path.join(path.dirname(filename),info.name+'.less');
  console.log('new file: '+filename);
  var fdata = getFileData(filename);
  //console.log(fdata);
  data = data.replace(info.value, fdata);
  console.log('new data:')
  console.log(data)
  return getFileContent(data, filename);
}

function getFileData(filename){
    return fs.readFileSync(filename);
}

function getImportInfo(data){
  var importRe = /@import "([\w\d_\.\/-]+)\.less";/;
  var re = importRe.exec(data);
  if(re && re.index>-1){
    return {index: re.index, value: re[0], name: re[1]};
  }
  return null;
}