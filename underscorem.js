"use strict";

var _ = require("underscore");

var sys = require('util');

var Buffer = require('buffer').Buffer;

exports.module = module
//exports.blacklist = ['./underscorem']
exports.base = './js/underscore_extensions'

function makeOnce(keyFunction, actionFunction){
	var manyArgs = actionFunction.length-1
	var active = {}
	var count = 0;
	return function(){
		var args = Array.prototype.slice.apply(arguments);
		var cb = args[args.length-1];
		var realArgs = args.slice(0, args.length-1)
		var key = keyFunction.apply(undefined, realArgs)
		var listeners;
		function specialCb(){
			active[key] = undefined;
			var args = Array.prototype.slice.apply(arguments);
			listeners.forEach(function(listener){
				listener.apply(undefined, args)
			})
		}

		if(!active[key]){
			listeners = active[key] = [cb]
			actionFunction.apply(undefined, realArgs.concat([specialCb]))
		}else{
			active[key].push(cb);
		}
	}
}
function makeOnceWithDone(keyFunction, actionFunction, doneFunction){
	var manyArgs = actionFunction.length-1
	var active = {}
	var count = 0;
	return function(){
		var args = Array.prototype.slice.apply(arguments);
		var cb = args[args.length-1];
		var realArgs = args.slice(0, args.length-1)
		var key = keyFunction.apply(undefined, realArgs)
		var listeners;
		function specialCb(){
			--count;
			if(doneFunction) doneFunction(count)
			active[key] = undefined;
			var args = Array.prototype.slice.apply(arguments);
			listeners.forEach(function(listener){
				listener.apply(undefined, args)
			})
		}

		if(!active[key]){
			listeners = active[key] = [cb]
			++count;
			actionFunction.apply(undefined, realArgs.concat([specialCb]))
		}else{
			active[key].push(cb);
		}
	}
}

var more = {
	log: function(msg){
		if(typeof(exports) !== undefined){
			sys.debug(msg);
		}else{
			//TODO
		}
	},
	errout: function(msg){
		if(typeof(exports) !== undefined){
			if(msg.length > 1000) msg = msg.substr(0, 1000) + '...';
			console.log(msg);
			//sys.debug(msg);
			console.log(new Error().stack);
			throw new Error(msg);
		}else{
			_.log(msg);
			throw new Error(msg);
		}
	},
	remove: function(list, value){
		var i = list.indexOf(value);
		if(i === -1) _.errout('list does not contain value: ' + value);
		list.splice(i, 1);
	},
	removeAll: function(list, otherList){
		return _.filter(list, function(v){
			return otherList.indexOf(v) === -1;
		});
	},
	latch: function(count, millisecondsUntilFailure, doneCb, failureCb){
		_.assertInt(count)

		var counter = count;
		
		var timeoutHandle;
		
		if(arguments.length === 4){
			timeoutHandle = setTimeout(function(){
				failureCb(counter);
			}, millisecondsUntilFailure);
		}else{
			_.assertLength(arguments, 2);
			doneCb = arguments[1];
			millisecondsUntilFailure = undefined;
		}
	
		if(count === 0){				
			if(timeoutHandle !== undefined){
				clearTimeout(timeoutHandle);
			}
			doneCb();
			return {};
		}	
		
		var f = function(){
			--counter;
		
			if(counter === 0){
				
				if(timeoutHandle !== undefined){
					clearTimeout(timeoutHandle);
				}
				
				doneCb();
			}else if(counter < 0){
				_.errout('latch counter is negative: programmer error : ' + (f.description !== undefined ? (': ' + f.description) : ''));
			}	
		}
		
		return f;
	},
	doOnce: function(keyFunction, actionFunction, doneFunction){
		if(doneFunction){
			return makeOnceWithDone(keyFunction, actionFunction, doneFunction)
		}else{
			return makeOnce(keyFunction, actionFunction)
		}
	},
	memoizeAsync: function(actionFunction, keyFunction){
		if(keyFunction === undefined) keyFunction = function(v){return v;}
		
		var manyArgs = actionFunction.length-1
		var active = {}
		var stored = {}
		var count = 0;
		var storedArgs = {}
		var f = function(){
			var args = Array.prototype.slice.apply(arguments);
			var cb = args[args.length-1];
			_.assertFunction(cb)
			var realArgs = args.slice(0, args.length-1)
			var key = keyFunction.apply(undefined, realArgs)
			storedArgs[key] = realArgs

			if(stored[key]){
				//console.log('calling back from stored: ' + key)
				cb.apply(undefined, stored[key])
				return
			}
			
			var listeners;
			function specialCb(){
				active[key] = undefined;
				var args = Array.prototype.slice.apply(arguments);
				//console.log('storing for: ' + key)
				stored[key] = args;
				listeners.forEach(function(listener){
					listener.apply(undefined, args)
				})
			}

			if(!active[key]){
				//console.log('loading normally: ' + key + ' ' + JSON.stringify(active[key]))
				listeners = active[key] = [cb]
				actionFunction.apply(undefined, realArgs.concat([specialCb]))
			}else{
				active[key].push(cb);
			}
		}
		//f.replace = function(key, newArguments){
		//	stored[key] = newArguments;
		//}
		f.clear = function(){
			var args = Array.prototype.slice.apply(arguments);
			var key = keyFunction.apply(undefined, args)
			stored[key] = undefined
		}
		f.refresh = function(){
			var args = Array.prototype.slice.apply(arguments);
			var key = keyFunction.apply(undefined, args)
			var realArgs = storedArgs[key]
			_.assertDefined(realArgs)
			//console.log('cleared stored: ' + key)
			stored[key] = undefined
			function refreshSpecialCb(){
				active[key] = undefined;
				var args = Array.prototype.slice.apply(arguments);
				//console.log('after refresh, storing for: ' + key)
				stored[key] = args;
				listeners.forEach(function(listener){
					//console.log('refresh calling listener')
					listener.apply(undefined, args)
				})
			}
			if(!active[key]){
				var listeners = active[key] = []
				//console.log('applying action function')
				actionFunction.apply(undefined, realArgs.concat([refreshSpecialCb]))
			}else{
				//_.errout('already refreshing - TODO')
				//active[key].push(cb);
			}

		}
		return f
	},
	assert: function(v){
		if(!v){
			_.errout('assertion failed');
		}
	},
	assertNot: function(v){
		if(v){
			_.errout('assertion failed');
		}
	},
	assertLength: function(arr, len, msg){
		if(arr.length !== len){
			var m = msg || 'Expected ' + len + ' values, but instead there are ' + arr.length;
			_.errout(m);
		}
	},
	assertString: function(v){
		if(typeof(v) !== 'string'){
			_.errout('Expected string, got ' + typeof(v) + ': ' + v);
		}
	},
	assertObject: function(v){
		if(typeof(v) !== 'object'){
			_.errout('Expected object, got ' + typeof(v) + ': ' + v);
		}
	},
	assertFunction: function(v){
		if(typeof(v) !== 'function'){
			_.errout('Expected function, got ' + typeof(v) + ': ' + v);
		}
	},
	assertEqual: function(a, b){
		if(a !== b){
			if(typeof(exports) !== undefined){
				_.errout('Values should be equal, but are not: ' + sys.inspect(a) + ', ' + sys.inspect(b));
			}else{
				_.errout('Values should be equal, but are not: ' + a.toString() + ', ' + b.toString());
			}
		}
	},
	assertInt: function(v){
		if(typeof(v) !== 'number'){
			_.errout('Expected integer, got ' + typeof(v) + ': ' + v);
		}
		if((v>>0) !== v){
			_.errout('value ' + v + ' is not the same as its integer conversion ' + (v>>0) + ' - expected integer.');
		}
	},
	assertNumber: function(v){
		if(typeof(v) !== 'number'){
			_.errout('Expected number, got ' + typeof(v) + ': ' + v);
		}
		if(isNaN(v)){
			_.errout('Expected number, got NaN');
		}
	},
	assertBoolean: function(v){
		if(v !== true && v !== false){
			_.errout('Expected boolean, got ' + typeof(v) + ': ' + v);
		}
	},
	assertBuffer: function(v){
		if(!(v instanceof Buffer)){
			_.errout('Expected buffer, got ' + typeof(v) + ': ' + v);
		}
	},
	assertArray: function(v){
		if(!(v instanceof Array)){
			_.errout('Expected Array, got ' + typeof(v) + ': ' + v);
		}
	},
	assertPrimitive: function(v){
		if(_.isArray(v) || _.isObject(v)){
			_.errout('expected primitive, got ' + typeof(v) + ': ' + v);
		}
	},
	assertDefined: function(v){
		if(v === undefined){
			_.errout('value is undefined');
		}
	},
	assertUndefined: function(v){
		if(v !== undefined){
			_.errout('value should be undefined');
		}
	},
	assertNotNull: function(v){
		if(v === null){
			_.errout('value is null (not undefined, null!) - never do that!');
		}
	},
	assertIn: function(arr, value){
		if(!more.isIn(arr, value)) _.errout('cannot find value(' + value + ') in array: ' + JSON.stringify(arr));
	},
	isObject: function(v){
		return !_.isArray(v) && typeof(v) === 'object';
	},
	isInteger: function(v){
		return typeof(v) === 'number' && (v>>0) === v;
	},
	isLong: function(v){
		return Math.round(v) === v;
	},
	isInt: function(v){
		return typeof(v) === 'number' && (v>>0) === v;
	},
	isIn: function(arr, value){
		_.assertArray(arr);
		return arr.indexOf(value) !== -1;
	},
	isPrimitive: function(v){
		return !_.isArray(v) && !_.isObject(v);
	},
	//Use to descend into a json object without having to check for attributes on each descent.
	//For example: the expression obj.a.b.c will be fine if obj = {a: {b: {c: 'blah'}}}, but throw an exception if obj = {}.
	//Using maybe(obj, 'a', 'b', 'c') will return undefined in the second case.
	maybe: function(obj){
		var cur = obj;
		for(var i=1;i<arguments.length;++i){
			if(cur === undefined) return undefined;
			
			cur = cur[arguments[i]];
		}
		return cur;
	},
	
	minimum: function(collection, f){
		var m;
		_.each(collection, function(v){
			var av = f(v);
			if(m === undefined || m > av) m = av;
		});
		return m;
	},
	maximum: function(collection, f){
		var m;
		_.each(collection, function(v){
			var av = f(v);
			if(m === undefined || m < av) m = av;
		});
		return m;
	},
	
	lookup: function(obj, attr, v){
		return _.detect(obj, function(value){
			return value[attr] === v;
		});
	},
	
	either: function(a, b){
		return a !== undefined ? a : b;
	},
	
	assureOnce: function(f){
		_.assertFunction(f);
		var called = false;
		return function(){
			if(called) _.errout('already called this function that should only be called once ever.');
			called = true;
			f.apply(this, Array.prototype.slice.call(arguments, 0));
		}
	},
	
	uniqueArray: function uniqueArray(arr){
		var u = {}, a = [];
		for(var i = 0, l = arr.length; i < l; ++i){
			if(u[arr[i]]) continue;
			a.push(arr[i]);
			u[arr[i]] = true;
		}
		return a;
	}
}

more.once = more.assureOnce;

_.mixin(more);

_.extend(exports, _);


