enyo.kind({
	name: "QRDecoder",
	kind: enyo.VFlexBox,
	statics: {
		imgFilename: "/media/internal/.de.stbuehler.qrdecoder/tmp.jpg",
		liveImgFilename: "/media/internal/.de.stbuehler.qrdecoder/live.jpg",
		liveImgOptions: { quality: 100, flash: 0, reviewDuration: 0, exifData: { } },
	},
	components: [
		{kind: enyo.PageHeader, content: "QR Decoder"},
		{kind: enyo.Pane, name: "pane", flex: 1, components: [
			{kind: enyo.Scroller, name: "mainScroller", autoHorizontal: false, horizontal: false, flex: 1, layoutKind: enyo.VFlexLayout, components: [
				{kind: enyo.Group, caption: "Image", layoutKind: "VFlexLayout", components: [
					{kind: enyo.SizeableImage, name: "img", showing: false},
					{kind: enyo.Button, name: "takepicture", caption: "Take Picture", onclick: "onClickShoot", showing: false},
					{kind: enyo.Button, caption: "Live Capture", onclick: "startVideo"},
					{kind: enyo.Button, caption: "Choose from Library", onclick: "onClickChoose"},
					{kind: enyo.Button, name: "decode", caption: "Decode", onclick: "onClickDecode"},
					{kind: enyo.Button, name: "copyClipboard", caption: "Copy to clipboard", onclick: "copyToClipboard",showing: false},
				]},
				{kind: enyo.Group, name: "decodeProgress", caption: "In Progress", layoutKind: "VFlexLayout", align: "center", components: [{ kind: enyo.Spinner, showing: true }], showing: false },
				{kind: enyo.Group, name: "resultGroup", caption: "Result", layoutKind: "VFlexLayout", components: [
					{ kind: enyo.Control, allowHtml: true, name: "result", content: "" }
				], showing: false},
				{kind: enyo.Group, name: "errorGroup", caption: "Decode Error", layoutKind: "VFlexLayout", components: [
					{ kind: enyo.Control, allowHtml: false, name: "errortext", content: "" }
				], showing: false},
				{kind: enyo.Group, name: "resultPlainGroup", caption: "Plain Text", layoutKind: "VFlexLayout", components: [
					{ kind: enyo.Input, allowHtml: false, name: "resulttext", value: "",
						onkeypress: "readonly_keypress",selectAllOnFocus: true, alwaysLooksFocused: true }
				], showing: false},
			]},
			{kind: enyo.VFlexBox, components: [
				{layoutKind: "HFlexLayout", flex: 1, style: "overflow: hidden", components: [
					{kind: enyo.Video, name: "video", width: "768px", height: "1024px", showControls: false},
				]},
				{kind: enyo.Button,caption: "Back", onclick: "stopVideo"},
			]},
		]},
		{kind: "ApplicationEvents", onWindowRotated: "windowRotated", onWindowActivated: "windowActivated"},
		{kind: enyo.Hybrid, executable: "qrdecode_plugin", name: "qrdecodePlugin", cachePlugin: "true", onPluginDisconnected: "onPluginDisconnected"},
		{kind: enyo.FilePicker, name: "chooseImage", fileType: "image", onPickFile: "onPickFile"},
		{kind: enyo.MediaCapture, name: "capture", onInitialized: "onCapInitialized", onError: "onCapError", onLoaded: "onCapLoaded", onImageCaptureComplete: "onCapPicture"},
		{kind: enyo.AppMenu, components: [
			{kind: enyo.EditMenu},
			{caption: "Copy result to clipboard", onclick: "copyToClipboard"}
		]},
		{
			name: "launchCam",
			kind: enyo.PalmService,
			service: "palm://com.palm.applicationManager",
			method: "launch",
			onFailure: "launchCamFailure",
			subscribe: true
		},
		{
			name: "errorDialog",
			kind: enyo.Dialog,
			caption: "Error",
			components: [ {kind: enyo.Control, content: "Couldn't launch Camera (needs WebOS 3.0.4)"} ],
		},
	],

	create: function() {
		this.inherited(arguments);
		this.live = false;
		this.plugin = new PluginWrapper(this.$.qrdecodePlugin, [], ['decode']);
		this.resulttext = '';

		var deviceinfo = JSON.parse(PalmSystem.deviceInfo);
		if (deviceinfo.modelNameAscii == 'TouchPad') {
			// this.$.takepicture.hide();
		}
		this.useImage(QRDecoder.imgFilename);
		enyo.keyboard.setManualMode(true);
	},
	destroy: function() {
		try {
			this.$.capture.unload();
		} catch (e) {
			enyo.error(e);
		}
		this.inherited(arguments);
	},

	readonly_keypress: function(sender, event) {
		return false;
	},

	useImage: function(filename) {
		this.$.img.setSrc("file://" + filename + "?" + (new Date()).getTime()); /* force refresh with ?... */
		this.$.img.show();
		this.currentFilename = filename;
	},

	launchCamFailure: function() {
		this.$.errorDialog.openAtCenter();
	},
	launchCam: function() {
		// TODO: not working yet
		this.$.launchCam.call({
			id: 'com.palm.app.camera',
			name: 'capture',
			params: { scene: 'capture', sublaunch: true, mode: 'still', filename: QRDecoder.imgFilename }
		});
	},

	captureDeviceList: function(bag) {
		var dm = { }, keys = [], i, d, devices = [];
		for (i = 0; i < bag.deviceKeys.length; ++i) {
			d = bag.deviceKeys[i];
			if (!dm[d.deviceUri]) {
				dm[d.deviceUri] = 1;
				devices.push(bag[d.deviceUri]);
			}
		}
		return devices;
	},

	getVideoSources: function(devices) {
		var list = [], i, j, d, f, f1;
		for (i = 0; i < devices.length; i++) {
			d = devices[i];
			if (d.supportedImageFormats) {
				f = false;
				/* found image/video device */
				for (j = 0; j < d.supportedImageFormats.length; j++) {
					f1 = d.supportedImageFormats[j];
					if (f1.mimetype == "image/jpeg" && (!f || f1.samplerate > f.samplerate)) f = f1;
				}
				list.push({ deviceUri: d.deviceUri, format: f, description: d.description, device: d });
			}
		}
		return list;
	},

	selectCamera: function(sources) {
		/* prefer the rear camera */
		var sel = 0, i;
		for (i = 0; i < sources.length; i++) {
			if (sources[i].description == "Camera/Camcorder") {
				sel = i;
			} else if (sel == i &&
					((sources[i].description == "User facing camera") || (sources[i].description = "Front Camera"))) {
				/* try to not use this one */
				if (sources.length > sel+1) sel = sel+1;
			}
		}
		return sources[sel];
	},

	onCapInitialized: function(sender, result) {
		try {
			var devices = this.captureDeviceList(result);

			enyo.log("devices: ", enyo.json.stringify(devices));

			/* video devices with best samplerate selected */
			var sources = this.getVideoSources(devices);

			this.captureDevice = this.selectCamera(sources);
			enyo.log("selected video source: ", enyo.json.stringify(this.captureDevice));

			this.$.capture.load(this.captureDevice.deviceUri, this.captureDevice.format);
		} catch (e) {
			enyo.error("error: ", e);
		}
	},
	onCapLoaded: function() {
		enyo.log("capture loaded");
		if (this.live) {
			this.$.capture.startImageCapture(QRDecoder.liveImgFilename, QRDecoder.liveImgOptions);
		}
	},
	onLiveDecodedImage: function(future) {
		this.decodeFuture = false;
		this.$.decode.setDisabled(false);
		if (!this.live) return;
		if (future.exception) {
			/* and again */
			enyo.log('onLiveDecodedImage: decoding failed: ' +future.exception);
			this.$.capture.startImageCapture(QRDecoder.liveImgFilename, QRDecoder.liveImgOptions);
		} else {
			var result = future.result;
			this.stopVideo();
			this.useImage(this.$.capture.lastImagePath);
			this.showResult(result.text, result.barcodeformat);
		}
	},
	onCapPicture: function() {
		var f;
		if (this.decodeFuture) return;
		f = decode(this.plugin, this.$.capture.lastImagePath);
		this.decodeFuture = f;
		this.$.decode.setDisabled(true);

		/* this can result in an immediate callback, so do this last */
		f.then(this.onLiveDecodedImage.bind(this));
	},
	onCapError: function(sender, result) {
		enyo.error("capture error: ", result);
	},

	startVideo: function() {
		this.live = true;
		this.$.pane.selectViewByIndex(1);
		enyo.setAllowedOrientation("up");
		this.$.capture.initialize(this.$.video);
	},
	stopVideo: function() {
		this.live = false;
		this.$.pane.back();
		this.$.capture.unload();
		enyo.setAllowedOrientation("free");
	},

	onPluginDisconnected: function() {
		this.plugin.signalDisconnect();
	},

	onPickFile: function(sender, response) {
		if (response.length > 0) {
			this.useImage(response[0].fullPath);
			this.onClickDecode();
		}
	},
	onClickChoose: function() {
		this.$.chooseImage.pickFile();
	},
	onClickShoot: function() {
		this.launchCam();
	},
	onClickDecode: function() {
		this.decodeImage();
	},
	
	scrollTo: function(element) {
		//Mojo.View.getScrollerForElement(element).mojo.revealElement(element);
		this.$.mainScroller.scrollToBottom();
	},

	copyToClipboard: function() {
		enyo.dom.setClipboard(this.resulttext);
	},

	showResult: function(resulttext, barcodeformat) {
		this.resulttext = resulttext;
		this.$.result.setContent(highlight(resulttext, barcodeformat));
		this.$.resulttext.setValue(resulttext);
		this.$.resultGroup.setCaption('Result (' + barcodeformat + ')');

		this.$.resultGroup.show();
		this.$.resultPlainGroup.show();
		this.$.errorGroup.hide();
		this.$.copyClipboard.show();
		this.scrollTo(this.$.bottomScroller);
	},

	showError: function(resulttext) {
		this.resulttext = '';
		this.$.errortext.setContent(resulttext);

		this.$.resultGroup.hide();
		this.$.resultPlainGroup.hide();
		this.$.errorGroup.show();
		this.$.copyClipboard.hide();
		this.scrollTo(this.$.bottomScroller);
	},

	clearResult: function() {
		this.resulttext = '';
		this.$.resultGroup.hide();
		this.$.resultPlainGroup.hide();
		this.$.errorGroup.hide();
		this.$.result.setContent("");
		this.$.resulttext.setValue("");
		this.$.errortext.setContent("");
		this.$.copyClipboard.hide();
	},

	onDecodedImage: function(future) {
		this.decodeFuture = false;
		this.$.decodeProgress.hide();
		this.$.decode.setDisabled(false);
		if (future.exception) {
			enyo.error('onDecodedImage: decoding failed: ' +future.exception);
			this.showError('decoding failed: ' + future.exception);
		} else {
			var result = future.result;
			this.showResult(result.text, result.barcodeformat);
		}
	},

	decodeImage: function(event) {
		var f;
		if (this.decodeFuture) return;
		f = decode(this.plugin, this.currentFilename);
		this.decodeFuture = f;
		this.clearResult();
		this.$.decodeProgress.show();
		this.$.decode.setDisabled(true);
//		this.scrollTo($('bottomScroller'));

		/* this can result in an immediate callback, so do this last */
		f.then(this.onDecodedImage.bind(this));
	},
});

