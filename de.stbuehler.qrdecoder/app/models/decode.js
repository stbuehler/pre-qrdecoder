
/* returns a future */
function decode(pluginwrapper, filename) {
	var future = pluginwrapper.decode(filename);
	future.then(function (future) {
		/* explicitly forward exception to silence log */
		if (future.exception) {
			future.exception = future.exception;
		} else {
			future.result = PluginWrapper.HexToBinary(future.result[0]);
		}
	});
	return future;
}
