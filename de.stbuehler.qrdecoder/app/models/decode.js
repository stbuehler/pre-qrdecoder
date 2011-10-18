
/* returns a future */
function decode(pluginwrapper, filename) {
	var future = pluginwrapper.decode(filename);
	future.then(function (future) {
		/* explicitly forward exception to silence log */
		if (future.exception) {
			future.exception = future.exception;
		} else {
			var result = future.result;
			future.result = { text: PluginWrapper.HexToUTF8(result[0]), barcodeformat: result[1] };
		}
	});
	return future;
}
