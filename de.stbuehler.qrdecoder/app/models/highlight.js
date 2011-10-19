
function highlight(text, barcodeformat) {
	var gs1org = 'http://gepir.gs1.org/v32/xx/gtin.aspx?TabContainerGTIN%3ATabPanelGTIN%3AbtnSubmitGTIN=Search&amp;__VIEWSTATE=&amp;TabContainerGTIN%3ATabPanelGTIN%3AtxtRequestGTIN=';

	switch (barcodeformat) {
	case 'EAN_13':
	case 'EAN_8':
		return 'EAN: <b>' + text + '</b><br /><a href="'+gs1org+text+'">Lookup with gs1.org</a><br /><a href="http://www.ean-search.org/perl/ean-search.pl?q='+text+'">Lookup with ean-search.org</a>';
	case 'UPC_A':
	case 'UPC_E':
		return 'UPC: <b>' + text + '</b><br /><a href="'+gs1org+text+'">Lookup with gs1.org</a>';
	case 'ITF':
		return 'ITF-14: <b>' + text + '</b><br /><a href="'+gs1org+text+'">Lookup with gs1.org</a>';
	default:
		break;
	}
	if ((typeof enyo != "undefined") && enyo.string && enyo.string.runTextIndexer) {
		text = enyo.string.runTextIndexer(text);
	} else {
		text = text.replace(new RegExp('(https?://|mailto:)\\S*?\.?($|\\s)', 'ig'), function(value) { return '<a href="'+value+'">'+value+'</a>' });
	}
	text = text.replace('\n', '<br />\n');
	return text;
}
