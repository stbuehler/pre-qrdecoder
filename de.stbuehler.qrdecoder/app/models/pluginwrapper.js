
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
		plugin.ready = this._onReady.bind(this);
		plugin.asyncResult = this._asyncResult.bind(this);
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
			if (!this._plugin || !this._plugin[method]) {
				future.exception = new Error("plugin has no method '" + method + "'");
				return;
			}
			future.result = this._plugin[method].apply(this.plugin, args);
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
				self._queue.push(self._runSyncMethodInner.bind(self, method, future, arguments));
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
			Mojo.Log.error('asyncResult without request: id=' + reqid);
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
			if (!this._plugin || !this._plugin[method]) {
				future.exception = new Error("plugin has no method '" + method + "'");
				return;
			}
			reqid = this._plugin[method].apply(this._plugin, args);
			fl = this._asyncReq[reqid];
			if (fl) {
				fl.push(future);
			} else {
				this._asyncReq[reqid] = [ future ];
			}
		} catch (e) {
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
				self._queue.push(self._runAsyncMethodInner.bind(self, method, future, arguments));
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
	_runCheck: function _runCheck() {
		if (!this._active) {
			this._checkTimerActive = false;
			return;
		}
		try {
			if (!this._plugin || !this._plugin.check) {
				Mojo.Log.error("plugin has no method 'check', probably crashed");
				return this._pluginCrashed();
			}
			this._plugin.check();
			setTimeout(this._runCheck, 1000);
		} catch (e) {
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
