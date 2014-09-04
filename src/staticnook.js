var path = require('path');
var fs = require('node-fs');
var glob = require('glob');
var async = require('async');
var util = require('util');
var crypto = require('crypto');

var logfile;

var staticnook = module.exports = {
	run: function(dir, options){
		console.log('running staticnook...');
		options = getOptions(options);
		//console.log(options);
		logfile = path.join(dir, 'staticnook.log')
		options.dir = dir;
		log('===============================');
		log('START: '+ new Date())
		log('===============================');
		console.log('TRANSFORMS');
		console.log('==================================');
		transform(options, function(err){
			if(err){
				return console.log(err);
			}
			console.log('UPLOADS');
			console.log('==================================');
			upload(options);
		});
	}
}

function log(str){
	fs.appendFileSync(logfile, str+'\n');
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
		if(item.input.files.length==0){
			console.log('no file in upload');
			continue;
		}

		var paths = [];
		var root = item.input.root || options.out;

		for (var j = item.input.files.length - 1; j >= 0; j--) {
			var file = item.input.files[j];
			var p = formatPath(root, item.input.path, file);
			paths.push(p);
		}
		var files = getFiles(paths, {mtime: item.input.mtime});

		if(files.length==0){
			console.log('not found files for upload');
			//console.log(paths);
			continue;
		}

		for (var j = 0; j < files.length; j++) {
			var file = files[j];
			var outfile = file;
			if(isString(root)) outfile = outfile.substr(root.length);
			//console.log(file);
			if(isString(item.output.prefix)) outfile = path.join(item.output.prefix, outfile);

			console.log('uploading... ' + outfile);
			if(!fs.existsSync(file)) throw new Error('not found file');
			//console.log(item.headers)
			if(item.mode === 'dev' && item.output.headers){
				console.log('dev mode: removing Cache-Control...');
				if(item.output.headers['cache-control'])
					delete item.output.headers['cache-control'];
				item.output.headers['Cache-Control'] = 'private';
			}
			client.putFile(file, outfile, item.output.headers, function(err, res){
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

	async.mapSeries(transforms, TransformUtil.transform.bind(TransformUtil), function(err, result){
		cb(err, result);
	});
}

function transformFn(t, options, modules, cb){
	var paths = [];
	if(!isArray(t.type)) return cb();
	if(t.input.files.length==0){
		console.log('no files in transform!');
		return cb();
	}
	//console.log(t);
	var root = t.input.root || options.src;
	for (var j = 0; j < t.input.files.length; j++) {
		var file = t.input.files[j];
		var p = formatPath(options.dir, root, t.input.path, file);
		//console.log(p);
		paths.push(p);
	}

	var files = readPaths(paths, {mtime: t.input.mtime, any: true });

	if(files.length==0){
		console.log('no files readed from paths!');
		console.log(paths);
		return cb();
	}

	var data = files.join('\n');

	//console.log(data);

	var TypeUtil={
		data: data,
		modules: modules,
		paths: paths,
		//results:[],
		transform: function(tp, callback){
			var self = this;
			console.log('transforming: ' + tp);
			//console.log(this.data);
			//console.log('=============')
			aTransformFn(tp, this.data, this.paths, this.modules, function(err, result){
				self.data = result;
				callback(err, result);
			});
		}
	};

	async.mapSeries(t.type, TypeUtil.transform.bind(TypeUtil), function(err, result){
		if(err) return cb(err);

		var filename = t.output.file;
		var hash = null;
		if(filename.indexOf('{hash}') > -1)
		{
			var md5 = crypto.createHash('sha1');
			md5.update(TypeUtil.data);
			hash = md5.digest('hex');
			hash = hash.substring(0,8);
			filename = filename.replace('{hash}', hash);
		}
		var outputFile = formatPath(options.dir, options.out, filename);
		writeFile(outputFile, TypeUtil.data);

		if(isString(t.output.gzip)){
			aTransformFn('gzip',TypeUtil.data,null, TypeUtil.modules, function(err, result){
				if(err) return cb(err);

				var gzipfilename = t.output.gzip;
				if(gzipfilename.indexOf('{hash}')>-1)
					gzipfilename = gzipfilename.replace('{hash}',hash);
				var gzipfile = formatPath(options.dir, options.out, gzipfilename);
				//console.log('writing gzip file: '+gzipfile);
				writeFile(gzipfile, result);
				cb();
			});
		} else cb();
	});
}

function aTransformFn(tp, data, filenames, modules, cb){
	switch(tp){
		case 'cssmin':
		data = modules.cssmin.minify(data);
		cb(null,data);
		break;
		case 'jsmin':
		//console.log('js minifing...');
		data = modules.jsmin.minify(data, {fromString: true,mangle: true});
		//console.log('js minified!');
		//console.log(JSON.stringify(data));
		cb(null,data.code);
		break;
		case 'gzip':
		modules.gzip.compress(data, cb);
		break;
		case 'less':
		//console.log('less rendering: '+data);
		var paths=[];
		for (var i = 0; i < filenames.length; i++) {
			var filename = filenames[i];
			var dirname = path.dirname(filename);
			if(paths.indexOf(dirname)<0) paths.push(dirname);
		}
		modules.less.render(data, {paths: paths, filename:filenames[0]}, cb);
		break;
		default:
		console.log('no transform type: ' + tp);
		cb(null,data);
		break;
	}
}

function readPaths(paths, time){
	return readFiles(getFiles(paths, time));
}

function getFiles(paths, options){
	var result = [];
	options = options || {};
	var timef = options.mtime && options.mtime > 0;

	if(timef){
		var mtime = options.mtime * 1000;
		var cfiles = [];
		var any = options.any === true;
		var now = new Date().getTime();
		//console.log('now: ' + new Date());
		//console.log(options);
		for (var i = 0; i < paths.length; i++) {
			var p = paths[i];
			var files = glob.sync(p);
			result = result.concat(files);
		
			for (var j = 0; j < files.length; j++) {
				var file = files[j];
				var stats = fs.statSync(file);
				var t = stats.mtime.getTime();
				//console.log(stats.mtime);
				if(t + mtime >= now){
					cfiles.push(file);
				} else {
					//console.log(file + ' - not changed');
					//console.log((t + mtime) +' < '+ now);
				}
			}
		}
		result = any && cfiles.length > 0 ? result : cfiles;
	}else{
		for (var i = 0; i < paths.length; i++) {
			var p = paths[i];
			var files = glob.sync(p);
			result = result.concat(files);
		}
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
	console.log('writing file: ' + file);
	var p = path.dirname(file);
	if(!fs.existsSync(p))
		fs.mkdirSync(p, 0777, true);
	fs.writeFileSync(file, data);
	log(path.basename(file));
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