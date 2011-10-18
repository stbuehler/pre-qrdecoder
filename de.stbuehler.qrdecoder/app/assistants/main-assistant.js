var MainAssistant = Class.create({
	initialize: function() {
		this.launchCam = this.launchCam.bind(this);
		this.decodeImage = this.decodeImage.bind(this);
		this.chooseImage = this.chooseImage.bind(this);
		this.onImageSelect = this.onImageSelect.bind(this);
		this.onDecodedImage = this.onDecodedImage.bind(this);
		this.onLive = this.onLive.bind(this);
		this.copyToClipboard = this.copyToClipboard.bind(this);
		this.decodeFuture = false;
		this.decodingSpinnerModel = { spinning: false };
	},

	setup: function() {
		this.controller.setupWidget(Mojo.Menu.appMenu, StageAssistant.appMenuAttributes, StageAssistant.appMenuModel);

		this.plugin = new PluginWrapper($('qrdecodePlugin'), [], ['decode']);
		this.img = $('qrimage');
		this.resulttext = '';
		/* this function is for setup tasks that have to happen when the scene is first created */

		/* use Mojo.View.render to render view templates and add them to the scene, if needed */

		/* setup widgets here */
		this.controller.setupWidget('buttonDecode', { }, { label: $L('Decode last picture'), disabled: false });
		this.controller.setupWidget('buttonChoose', { }, { label: $L('Choose from library'), disabled: false });
		this.controller.setupWidget('buttonShoot', { }, { label: $L('Take picture'), disabled: false });
		this.controller.setupWidget('buttonLive', { }, { label: $L('Live'), disabled: false });
		this.controller.setupWidget('buttonCopy', { }, { label: $L('Copy result'), disabled: false });

		this.controller.setupWidget('result-textfield',
			{ multiline: true, focusMode: Mojo.Widget.focusSelectMode },
			{ value: '', disabled: false });

		this.controller.setupWidget('decodingSpinner', { }, this.decodingSpinnerModel);

		this.useImage(MainAssistant.imgFilename);

		/* add event handlers to listen to events from widgets */

		this.controller.listen('qrimage', Mojo.Event.tap, this.launchCam);
		this.controller.listen('buttonDecode', Mojo.Event.tap, this.decodeImage);
		this.controller.listen('buttonChoose', Mojo.Event.tap, this.chooseImage);
		this.controller.listen('buttonShoot', Mojo.Event.tap, this.launchCam);
		this.controller.listen('buttonLive', Mojo.Event.tap, this.onLive);
		this.controller.listen('buttonCopy', Mojo.Event.tap, this.copyToClipboard);

		this.scrollto_result = false;
	},

	useImage: function(filename) {
		if (filename != MainAssistant.imgFilename) {
			$('buttonDecode').hide();
		}
		this.img.src = filename + "?" + (new Date()).getTime(); /* force refresh with ?... */
		this.currentFilename = filename;
	},

	launchCam: function(event) {
		if (Mojo.Environment.DeviceInfo.modelNameAscii == 'TouchPad') {
			Mojo.Controller.errorDialog("Cannot take pictures on this device. Use 'DigiCamera Lite' or a similar camera app on your touchpad to take pictures");
		} else {
			this.controller.stageController.pushScene(
				{ appId: 'com.palm.app.camera', name: 'capture' },
				{ sublaunch: true, mode: 'still', filename: MainAssistant.imgFilename }
			);
		}
	},

	onImageSelect: function(event) {
		this.useImage(event.fullPath);
		this.decodeImage();
	},
	chooseImage: function(event) {
		Mojo.FilePicker.pickFile({
			onSelect: this.onImageSelect,
			kind: 'image',
		}, this.controller.stageController);
	},

	onLive: function() {
		this.controller.stageController.pushScene({name: 'live'}, this, this.plugin);
	},

	scrollTo: function(element) {
		Mojo.View.getScrollerForElement(element).mojo.revealElement(element);
	},

	copyToClipboard: function() {
		this.controller.stageController.setClipboard(this.resulttext, false);
	},

	showResult: function(resulttext, barcodeformat) {
		this.resulttext = resulttext;
		$('result').innerHTML = highlight(resulttext, barcodeformat);
		$('result-textfield').mojo.setValue(resulttext);

		$('resultGroup').show();
		$('resultPlainGroup').show();
		$('errorGroup').hide();
		$('buttonCopy').show();
		this.scrollTo($('bottomScroller'));
		this.scrollto_result = true;
	},

	showError: function(resulttext) {
		this.resulttext = '';
		$('error-text').innerHTML = resulttext;

		$('resultGroup').hide();
		$('resultPlainGroup').hide();
		$('errorGroup').show();
		$('buttonCopy').hide();
		this.scrollTo($('bottomScroller'));
	},

	clearResult: function() {
		this.resulttext = '';
		$('resultGroup').hide();
		$('result').innerHTML = '';
		$('resultPlainGroup').hide();
		$('result-textfield').mojo.setValue('');
		$('errorGroup').hide();
		$('error-text').innerHTML = '';
		$('buttonCopy').hide();
	},

	onDecodedImage: function(future) {
		this.decodeFuture = false;
		$('decodeProgress').hide();
		this.decodingSpinnerModel.spinning = false;
		this.controller.modelChanged(this.decodingSpinnerModel);
		if (future.exception) {
			Mojo.Log.error('onDecodedImage: decoding failed: ' +future.exception);
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
		$('decodeProgress').show();
		this.decodingSpinnerModel.spinning = true;
		this.controller.modelChanged(this.decodingSpinnerModel);
		this.scrollTo($('bottomScroller'));

		/* this can result in an immediate callback, so do this last */
		f.then(this.onDecodedImage);
	},

	activate: function(event) {
		if (this.scrollto_result) {
			this.scrollto_result = false;
			this.scrollTo($('bottomScroller'));
		}
		this.plugin.activate();
		if (event && event.filename) {
			this.useImage(event.filename);
			this.decodeImage();
		}
		/* put in event handlers here that should only be in effect when this scene is active. For
		   example, key handlers that are observing the document */
	},

	deactivate: function(event) {
		this.scrollto_result = false;
		// this.plugin.deactivate();
		/* remove any event handlers you added in activate and do any other cleanup that should happen before
		   this scene is popped or another scene is pushed on top */
	},

	cleanup: function(event) {
		/* this function should do any cleanup needed before the scene is destroyed as 
		   a result of being popped off the scene stack */
		if (this.decodeFuture) {
			this.decodeFuture.cancel();
			this.decodeFuture = false;
		}
		this.controller.stopListening('qrimage', Mojo.Event.tap, this.launchCam);
		this.controller.stopListening('buttonDecode', Mojo.Event.tap, this.decodeImage);
		this.controller.stopListening('buttonChoose', Mojo.Event.tap, this.chooseImage);
		this.controller.stopListening('buttonShoot', Mojo.Event.tap, this.launchCam);
		this.controller.stopListening('buttonLive', Mojo.Event.tap, this.onLive);
		this.controller.stopListening('buttonCopy', Mojo.Event.tap, this.copyToClipboard);
	},

	handleCommand: function(event) {
		if (event.type == Mojo.Event.command) {
			switch (event.command) {
			case 'copy-result':
				this.copyToClipboard();
				break;
			}
		}
	},
});

MainAssistant.imgFilename = "/media/internal/.de.stbuehler.qrdecoder/tmp.jpg";
