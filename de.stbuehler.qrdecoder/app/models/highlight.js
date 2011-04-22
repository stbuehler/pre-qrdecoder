
function highlight(text) {
	text = text.replace(new RegExp('(https?://|mailto:)\\S*?\.?($|\\s)', 'ig'), function(value) { return '<a href="'+value+'">'+value+'</a>' });
	text = text.replace('\n', '<br />\n');
	return text;
}
