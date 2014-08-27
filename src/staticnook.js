var path = require('path');
var fs = require('node-fs');
var glob = require('glob');
var async = require('async');

var staticnook = module.exports = {
	run: function(dir, options){
		console.log('running staticnook...');
		options = getOptions(options);
		//console.log(options);
		options.dir = dir;
		transform(options, function(){
			console.log('end transforms');
			upload(options);
		});
	}
}

function upload(options){
	if(!options.s3){
		console.log('no s3');
		return;
	}
	var list = options.uploads;
	if(!isArray(list)){
		console.log('uploads list is null!');
		return;
	}

	var knox = require('knox');

	var client = knox.createClient(options.s3);

	for (var i = list.length - 1; i >= 0; i--) {
		var item = list[i];
		if(item.files.length==0){
			console.log('no file in upload');
			continue;
		}

		var paths = [];
		for (var j = item.files.length - 1; j >= 0; j--) {
			var file = item.files[j];
			var p = formatPath(options.out,item.path, file);
			paths.push(p);
		}
		var files = getFiles(paths);

		if(files.length==0){
			console.log('not found files');
			console.log(paths);
			continue;
		}

		for (var j = 0; j < files.length; j++) {
			var file = files[j];
			var outfile = file;
			if(isString(options.out)) outfile = outfile.substr(options.out.length);
			//console.log(file);
			console.log('uploading... ' + file);
			if(!fs.existsSync(file)) throw new Error('not found file');
			//console.log(item.headers)
			client.putFile(file, outfile, item.headers, function(err, res){
			  // Always either do something with `res` or at least call `res.resume()`.
			  if(err){
			  	console.log(err);
			  	return;
			  }
			  res.resume();
			  if(200 == res.statusCode)
			  	console.log('uploaded!');
			  else
			  	console.log('not uploaded!!!');
			});
		}
		//client.
	}
}

function transform(options, cb){
	var transforms = options.transforms;
	if(!isArray(transforms)) return cb();

	var cssmin = require('./cssmin');
	var jsmin = require('./jsmin');
	var gzip = require('./gzip');
	var less = require('./less');

	var TransformUtil = {
		modules: {cssmin:cssmin, jsmin:jsmin, gzip:gzip, less:less},
		options: options,
		transform: function(t, callback){ 
			transformFn(t, this.options, this.modules, function(){
				console.log('done one transform item');
				callback(null);
			});
		}
	};

	async.map(transforms, TransformUtil.transform.bind(TransformUtil), function(err, result){
		cb();
	});
}

function transformFn(t, options, modules, cb){
	var paths = [];
	if(!isArray(t.type)) return cb();
	if(t.files.length==0){
		console.log('no files in transform!');
		return cb();
	}
	for (var j = 0; j < t.files.length; j++) {
		var file = t.files[j];
		var p = formatPath(options.dir, t.out ? options.out: options.src,t.path,file);
		//console.log(p);
		paths.push(p);
	}

	var files = readPaths(paths);

	if(files.length==0){
		console.log('no files readed from paths!');
		console.log(paths);
		return cb();
	}

	var data = files.join('\n');

	//console.log(data);

	var outputFile = formatPath(options.dir,options.out,t.path,t.out);

	var TypeUtil={
		data: data,
		modules: modules,
		transform: function(tp, callback){
			aTransformFn(tp, data, this.modules, function(err, result){
				data = result;
				callback(err, result);
			});
		}
	};

	async.map(t.type, TypeUtil.transform.bind(TypeUtil), function(err, result){
		writeFile(outputFile, data);
		cb();
	});
}

function aTransformFn(tp, data, modules, cb){
	switch(tp){
		case 'cssmin':
		data = modules.cssmin.minify(data);
		cb(null,data);
		break;
		case 'jsmin':
		data = modules.jsmin.minify(data);
		cb(null,data);
		break;
		case 'gzip':
		modules.gzip.compress(data, cb);
		break;
		case 'less':
		console.log('less rendering: '+data);
		modules.less.render(data,{}, cb);
		break;
		default:
		console.log('no transform type: ' + tp);
		cb(null,data);
		break;
	}
}

function readPaths(paths){
	return readFiles(getFiles(paths));
}

function getFiles(paths, options){
	var result=[];
	for (var i = 0; i < paths.length; i++) {
		var p = paths[i];
		var files = glob.sync(p, options);
		result = result.concat(files);
	}
	return result;
}

function readFiles(files){
	var result=[];
	for (var i = 0; i < files.length; i++) {
		var file = files[i];
		try{
			data = fs.readFileSync(file);
		}catch(e){
			continue;
		}

		result.push(data);
	}
	return result;
}

function formatPath(){
	var args = Array.prototype.slice.call(arguments);
	return path.normalize(args.join('/'));
}

function writeFile(file, data){
	var p = path.dirname(file);
	if(!fs.existsSync(p))
		fs.mkdirSync(p, 0777, true);
	fs.writeFileSync(file, data);
}

function isString(obj){
	return typeof obj === 'string';
}

function getOptions(options){
	if(typeof options === 'string'){
		console.log('loading file... '+options);
		//load file
		if(!fs.existsSync(options)){ throw new Error('file not exists!'); };
		if(endsWith(options,'.yml')){
			console.log('loading yml');
			var data = fs.readFileSync(options);
			//console.log(data);
			var yaml = require('js-yaml');
			var doc = yaml.load(data);
			return doc || {};
		}else if(endsWith(options,'.json')){
			var data = require(options);
			return data || {};
		}else{
			throw new Error('unsuported file format');
		}
	}
	return options || {};
}

function endsWith(str, suffix) {
	return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

function isArray(obj){
	return Object.prototype.toString.call(obj) === '[object Array]';
}