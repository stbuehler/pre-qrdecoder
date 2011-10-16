
/* Author: Stefan Bühler 2011
 * Use at your own risk, in whatever project you like.
 *
 *
 * synchronized methods return a future, which just forwards the direct result of the 
 * plugin method call
 *
 *
 * plugin implementation requirements:
 *   - needs a "check" method like this:
 *     PDL_bool checkPlugin(PDL_JSParameters *params) { return PDL_TRUE; }
 *     [...]
 *     PDL_RegisterJSHandler("check", checkPlugin);
 *   - calls "ready" in the SDL event loop until it succeeded:
 *     PDL_Err mjErr = PDL_CallJS("ready", NULL, 0);
 *
 * call the (de)activate methods from the corresponding methods in your scene assistants
 *   (plugins are not accessible while the scene is deactivated)
 *
 * async method expect the plugin to return a "request-id"; the plugin should call the
 * "asyncResult" handler later (with PDL_CallJS) with the parameters:
 *   - "request-id" (the same ofc)
 *   - "exception" (error string, empty if nothing bad happened)
 *   - parameters after that are used as entries for a result list
 * the async methods return futures too, but they will forward the results from the asyncResult callback.
 *
 * Note: your plugin can reuse request ids, as long as the results come in the same order as the requests.
 * For example you could use the hex representation of the pointer to your internal "job data" for a request. 
 *
 * If you just use async calls as your plugin takes a long time to calculate something, the results are probably always
 * in the same order as the requests, and you can use the same id for all requests.
 *
 * remember:
 *  - the plugin api treats everything as string. binary data should be (hex) encoded.
 *  - plugin calls should return fast, or the javascript call times out (about 3 seconds)
 */


var PluginWrapper = Class.create({
	initialize: function initialize(plugin, syncmethods, asyncmethods) {
		var i, method;

		this._plugin = plugin;
		this._enyo = false;
		if (plugin.addCallback) this._enyo = true;

		if (this._enyo) {
			plugin.addCallback("ready", this._onReady.bind(this), false);
			plugin.addCallback("asyncResult", this._asyncResult.bind(this), false);
		} else {
			plugin.ready = this._onReady.bind(this);
			plugin.asyncResult = this._asyncResult.bind(this);
		}
		this._runCheck = this._runCheck.bind(this);
		this._queue = [];
		this._loaded = false;
		this._crashed = false;
		this._checkTimerActive = false;
		this._active = true;
		this._asyncReq = { }; /* map to *lists* of futures */

		for (i = 0; i < syncmethods.length; i++) {
			method = syncmethods[i];
			this[method] = this._runSyncMethod(method);
		}
		for (i = 0; i < asyncmethods.length; i++) {
			method = asyncmethods[i];
			this[method] = this._runAsyncMethod(method);
		}
	},

	error: function error() {
		if (this._enyo) {
			enyo.error.apply(enyo, arguments);
		} else {
			Mojo.Log.error.apply(Mojo.Log, arguments);
		}
	},

	info: function info() {
		if (this._enyo) {
			enyo.info.apply(enyo, arguments);
		} else {
			Mojo.Log.info.apply(Mojo.Log, arguments);
		}
	},

	deactivate: function deactivate() {
		if (!this._active) return;
		this._active = false;
	},
	activate: function activate() {
		if (this._active) return;
		this._active = true;
		if (this._loaded) this._runQueue();
		if (!this._loaded || this._crashed || this._checkTimerActive) return;
		this._checkTimerActive = true;
		setTimeout(this._runCheck, 1);
	},

	_runSyncMethodInner: function _runSyncMethodInner(method, future, args) {
		try {
			if (this._crashed) {
				future.exception = new Error("plugin died, cannot call method '" + method +"'");
				return future;
			}
			if (this._enyo) {
				var pargs = [method];
				Array.prototype.push.apply(pargs, args);
				future.result = this._plugin.callPluginMethod.apply(this._plugin, pargs);
			} else {
				if (!this._plugin || !this._plugin[method]) {
					future.exception = new Error("plugin has no method '" + method + "'");
					return;
				}
				future.result = this._plugin[method].apply(this.plugin, args);
			}
		} catch (e) {
			future.exception = e;
		}
	},
	_runSyncMethod: function _runSyncMethod(method) {
		var self = this;
		return function runSomeSyncMethod() {
			future = new Future();
			if (self._crashed) {
				future.exception = new Error("plugin died, cannot call method '" + method +"'");
				return future;
			}
			if (!self._loaded || !self._active) {
				this.info("pluginwrapper: queuing sync method '" + method + "' call");
				self._queue.push(self._runSyncMethodInner.bind(self, method, future, arguments));
				if (self._plugin && self._plugin[method]) {
					self._onReady();
				}
				return future;
			}
			self._runSyncMethodInner(method, future, arguments);
			return future;
		}.bind(this);
	},

	_asyncResultDeliver: function _asyncResultDeliver(future, exc, res) {
		if (exc) {
			future.exception = exc;
		} else {
			future.result = res;
		}
	},
	_asyncResult: function _asyncResult(reqid, exception) {
		var f, list, i;
		f = this._asyncReq[reqid];
		if (!f) {
			this.error('asyncResult without request: id=' + reqid);
			return;
		}
		/* remove entry */
		if (f.length == 1) {
			delete this._asyncReq[reqid];
			f = f[0];
		} else {
			f = f.shift();
		}
		/* forward result (delayed) */
		if (exception) {
			setTimeout(this._asyncResultDeliver.call.bind(this._asyncResultDeliver, this, f, new Error(exception)), 1);
		} else {
			/* collect remaining arguments */
			list = [];
			for (i = 2; i < arguments.length; i++) list.push(arguments[i]);
			setTimeout(this._asyncResultDeliver.call.bind(this._asyncResultDeliver, this, f, false, list), 1);
		}
	},
	_runAsyncMethodInner: function _runAsyncMethodInner(method, future, args) {
		var reqid, fl;
		try {
			if (this._crashed) {
				future.exception = new Error("plugin died, cannot call method '" + method +"'");
				return future;
			}
			if (this._enyo) {
				var pargs = [method];
				Array.prototype.push.apply(pargs, args);
				reqid = this._plugin.callPluginMethod.apply(this._plugin, pargs);
			} else { 
				if (!this._plugin || !this._plugin[method]) {
					future.exception = new Error("plugin has no method '" + method + "'");
					return;
				}
				reqid = this._plugin[method].apply(this._plugin, args);
			}
			this.info("pluginwrapper: async method '" + method + "'called, reqid = " + reqid);
			fl = this._asyncReq[reqid];
			if (fl) {
				fl.push(future);
			} else {
				this._asyncReq[reqid] = [ future ];
			}
		} catch (e) {
			this.error("calling async method error: " + e);
			future.exception = e;
		}
	},
	_runAsyncMethod: function _runAsyncMethod(method) {
		var self = this;
		return function runSomeAsyncMethod() {
			future = new Future();
			if (self._crashed) {
				future.exception = new Error("plugin died, cannot call method '" + method +"'");
				return future;
			}
			if (!self._loaded || !self._active) {
				this.info("pluginwrapper: queuing async method '" + method + "' call");
				self._queue.push(self._runAsyncMethodInner.bind(self, method, future, arguments));
				if (self._plugin && self._plugin[method]) {
					self._onReady();
				}
				return future;
			}
			self._runAsyncMethodInner(method, future, arguments);
			return future;
		}.bind(this);
	},

	_runQueue: function _runQueue() {
		var i, q;
		q = this._queue;
		this._queue = [];
		for (i = 0; i < q.length; i++) {
			q[i]();
		}
	},

	_onReady: function _onReady() {
		/* delay: "JavaScript functions called from the plug-in can not call handler functions." */
		this.info("pluginwrapper: onReady triggered");
		if (this._loaded) return;
		this._loaded = true;
		if (!this._active) return;

		setTimeout(this._runQueue.bind(this), 1);
		if (!this._checkTimerActive) {
			this._checkTimerActive = true;
			setTimeout(this._runCheck, 1000);
		}
	},

	_pluginCrashed : function _pluginCrashed() {
		this._crashed = true;
		var l, i, q;
		this._runQueue();
		q = this._asyncReq;
		this._asyncReq = { };
		for (l in q) {
			if (q.hasOwnProperty(l)) {
				l = q[l];
				for (i = 0; i < l.length; i++) {
					l[i].exception = new Error("plugin died");
				}
			}
		}
	},
	signalDisconnect: function signalDisconnect() {
		this.error("plugin disconnect");
		this._pluginCrashed();
	},
	
	_runCheck: function _runCheck() {
		if (!this._active) {
			this._checkTimerActive = false;
			return;
		}
		try {
			if (this._enyo) {
				this._plugin.callPluginMethod("check");
			} else {
				if (!this._plugin || !this._plugin.check) {
					this.error("plugin has no method 'check', probably crashed");
					return this._pluginCrashed();
				}
				this._plugin.check();
			}
			setTimeout(this._runCheck, 1000);
		} catch (e) {
			this.error("runCheck: ", e);
			this._pluginCrashed();
		}
	}
});

/* "Binary" strings - not UTF-8 characters */
PluginWrapper.HexToBinary = function HexToBinary(hex) {
	for (var result = '', c = 0; c < hex.length; c += 2)
		result += String.fromCharCode(parseInt(hex.substr(c, 2), 16));
	return result;
}
PluginWrapper.BinaryToHex = function BinaryToHex(str) {
	var hex = [], i, c;
	for (i = 0; i < str.length; i++) {
		c = str.charCodeAt(i);
		hex.push(((c >>> 4) & 0xF).toString(16));
		hex.push((c & 0xF).toString(16));
	}
	return hex.join("");
}

/* skips invalid chars */
PluginWrapper.BinaryToUTF8 = function BinaryToUTF8(binary) {
	var str = '', i, c, c1, seqlen, slen;
	for (i = 0; i < binary.length; i++) {
		c = binary.charCodeAt(i);
		if (0 == (c & 0x80)) { seqlen = 0; }
		else if (0xC0 == (c & 0xFE)) { continue; /* 0xCO / 0xC1 overlong */ }
		else if (0xC0 == (c & 0xE0)) { seqlen = 1; c = c & 0x1f; }
		else if (0xE0 == (c & 0xF0)) { seqlen = 2; c = c & 0x0f; }
		else if (0xF0 == (c & 0xF8)) { seqlen = 3; c = c & 0x07; }
		else continue;
		if (seqlen > binary.length - i) return str;
		for (slen = seqlen; slen > 0; slen--) {
			c1 = binary.charCodeAt(++i);
			if (0x80 != (c1 & 0xC0)) return false;
			c = (c << 6) | (c1 & 0x3f);
		}
		if ((seqlen == 2) && (c < 0x800)) continue; /* overlong */
		if ((seqlen == 3) && (c < 0x1000)) continue; /* overlong */

		/* exclude surrogates: "high" D800–DBFF and "low" DC00–DFFF */
		if (c >= 0xD800 && c <= 0xDFFF) continue;
		/* "noncharacters": last two code points in plane and U+FDD0..U+FDEF */
		if ((c & 0xFFFE) == 0xFFE || (c >= 0xFDD0 && c <= 0xFDEF)) continue;

		if (c > 0x10FFFF) continue; /* invalid char */
		str += String.fromCharCode(c);
	}
	return str;
}
PluginWrapper.HexToUTF8 = function HexToUTF8(hex) {
	var str = '', i, c, c1, seqlen, slen;
	for (i = 0; i < hex.length; i += 2) {
		c = parseInt(hex.substr(i, 2), 16);
		if (0 == (c & 0x80)) { seqlen = 0; }
		else if (0xC0 == (c & 0xFE)) { continue; /* 0xCO / 0xC1 overlong */ }
		else if (0xC0 == (c & 0xE0)) { seqlen = 1; c = c & 0x1f; }
		else if (0xE0 == (c & 0xF0)) { seqlen = 2; c = c & 0x0f; }
		else if (0xF0 == (c & 0xF8)) { seqlen = 3; c = c & 0x07; }
		else continue;
		if (2*seqlen > hex.length - i) return str;
		for (slen = seqlen; slen > 0; slen--) {
			i += 2;
			c1 = parseInt(hex.substr(i, 2), 16);
			if (0x80 != (c1 & 0xC0)) return false;
			c = (c << 6) | (c1 & 0x3f);
		}
		if ((seqlen == 2) && (c < 0x800)) continue; /* overlong */
		if ((seqlen == 3) && (c < 0x1000)) continue; /* overlong */

		/* exclude surrogates: "high" D800–DBFF and "low" DC00–DFFF */
		if (c >= 0xD800 && c <= 0xDFFF) continue;
		/* "noncharacters": last two code points in plane and U+FDD0..U+FDEF */
		if ((c & 0xFFFE) == 0xFFE || (c >= 0xFDD0 && c <= 0xFDEF)) continue;

		if (c > 0x10FFFF) continue; /* invalid char */
		str += String.fromCharCode(c);
	}
	return str;
}

PluginWrapper.UTF8ToBinary = function UTF8ToBinary(str) {
	var result = '', i, c;
	for (i = 0; i < str.length; i++) {
		c = str.charCodeAt(i);
		if (c < 0x80) {
			result += String.fromCharCode(c);
		} else if (c < 0x800) {
			result += String.fromCharCode(0xC0 | (c >>> 6)) + String.fromCharCode(0x80 | (c & 0x3F));
		} else if (c < 0x10000) {
			result += String.fromCharCode(0xE0 | (c >>> 12)) + String.fromCharCode(0x80 | ((c >>> 6) & 0x3F)) + String.fromCharCode(0x80 | (c & 0x3F));
		} else if (c < 0x110000) {
			result += String.fromCharCode(0xF0 | (c >>> 18)) + String.fromCharCode(0x80 | ((c >>> 12) & 0x3F)) + String.fromCharCode(0x80 | ((c >>> 6) & 0x3F)) + String.fromCharCode(0x80 | (c & 0x3F));
		}
		/* else too high, skip */
	}
	return result;
}
PluginWrapper.UTF8ToHex = function UTF8ToHex(str) {
	return PluginWrapper.BinaryToHex(PluginWrapper.UTF8ToBinary(str));
}
