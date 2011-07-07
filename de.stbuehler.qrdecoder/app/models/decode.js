
/* returns a future */
function decode(pluginwrapper, filename) {
	var future = pluginwrapper.decode(filename);
	future.then(function (future) {
		future.result = PluginWrapper.HexToBinary(future.result[0]);
	});
	return future;
}
