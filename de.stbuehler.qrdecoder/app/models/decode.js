
function hexToString(hex) {
	for (var result = '', c = 0; c < hex.length; c += 2)
		result += String.fromCharCode(parseInt(hex.substr(c, 2), 16));
	return result;
}

var _decodeQueue = [];

function decodeDone(result, error) {
	if (0 == _decodeQueue.length) {
		Mojo.Log.error('spurious decodeDone: result = "' + result + '", error = "' + error + '"');
		return;
	}
	var cb = _decodeQueue.shift();
	cb(result, error);
}

/* returns a future */
function decode(plugin, filename, f) {
	var futready = false, decodeready = false;
	var exc = false, res;
	var timer, retries = 0;

	plugin.decodeDone = decodeDone; /* ensure callback is initialized */
	
	var finish = function(future) {
		if (futready && decodeready) {
			if (exc) {
				future.exception = exc;
			} else {
				future.result = res;
			}
		}
	};
	
	var trydecode = function(future) {
		if (future.status() == "cancelled") return;
		if (!plugin.decode) {
			retries++;
			if (retries > 20) {
				Mojo.Log.error('method "decode" from plugin not available yet - timeout');
				exc = new Error('plugin ' + plugin + ' has no method "decode"');
				decodeready = true;
				finish(future);
			} else {
				Mojo.Log.info('method "decode" from plugin not available yet');
				timer = window.setTimeout(trydecode.bind(null, future), 200); /* try again later */
			}
			return;
		}
		try {
			plugin.decode(filename);
			_decodeQueue.push(function(result, error) {
				if (error) {
					exc = new Error(error);
				} else {
					res = hexToString(result);
				}
				decodeready = true;
				finish(future);
			});
		} catch (e) {
			exc = e;
			decodeready = true;
			finish(future);
		}
	};
	
	if (!f) {
		f = new Future(true);
		futready = true;
	} else {
		f.then(function(future) { futready = true; finish(future); });
	}

	f.then(function() { }); /* block until results are ready */ 
	/* start async */
	timer = window.setTimeout(trydecode.bind(null, f), 1);
	
	return f;
}
