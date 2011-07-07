var MainAssistant = Class.create({
	initialize: function() {
		this.launchCam = this.launchCam.bind(this);
		this.decodeImage = this.decodeImage.bind(this);
		this.chooseImage = this.chooseImage.bind(this);
		this.onImageSelect = this.onImageSelect.bind(this);
		this.onDecodedImage = this.onDecodedImage.bind(this);
		this.decodeFuture = false;
		this.decodingSpinnerModel = { spinning: false };
	},

	setup: function() {
		this.controller.setupWidget(Mojo.Menu.appMenu, StageAssistant.appMenuAttributes, StageAssistant.appMenuModel);

		this.plugin = $('qrdecodePlugin');
		this.img = $('qrimage');
		/* this function is for setup tasks that have to happen when the scene is first created */

		/* use Mojo.View.render to render view templates and add them to the scene, if needed */

		/* setup widgets here */
		this.controller.setupWidget('buttonDecode', { }, { label: $L('Decode'), disabled: false });
		this.controller.setupWidget('buttonChoose', { }, { label: $L('Choose from Library'), disabled: false });
		this.controller.setupWidget('buttonShoot', { }, { label: $L('Take Picture'), disabled: false });

		this.controller.setupWidget('result-textfield', { multiline: true }, { value: '', disabled: false });

		this.controller.setupWidget('decodingSpinner', { }, this.decodingSpinnerModel);

		this.useImage(MainAssistant.imgFilename);

		/* add event handlers to listen to events from widgets */

		this.controller.listen('qrimage', Mojo.Event.tap, this.launchCam);
		this.controller.listen('buttonDecode', Mojo.Event.tap, this.decodeImage);
		this.controller.listen('buttonChoose', Mojo.Event.tap, this.chooseImage);
		this.controller.listen('buttonShoot', Mojo.Event.tap, this.launchCam);
	},

	useImage: function(filename) {
		this.img.src = filename + "?" + (new Date()).getTime(); /* force refresh with ?... */
		this.currentFilename = filename;
	},

	launchCam: function(event) {
		this.controller.stageController.pushScene(
			{ appId: 'com.palm.app.camera', name: 'capture' },
			{ sublaunch: true, mode: 'still', filename: MainAssistant.imgFilename }
		);
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

	scrollTo: function(element) {
		Mojo.View.getScrollerForElement(element).mojo.revealElement(element);
	},

	showResult: function(resulttext) {
		$('result').innerHTML = highlight(resulttext);
		$('result-textfield').mojo.setValue(resulttext);

		$('resultGroup').show();
		$('resultPlainGroup').show();
		$('errorGroup').hide();
		this.scrollTo($('bottomScroller'));
	},

	showError: function(resulttext) {
		$('error-text').innerHTML = resulttext;

		$('resultGroup').hide();
		$('resultPlainGroup').hide();
		$('errorGroup').show();
		this.scrollTo($('bottomScroller'));
	},

	clearResult: function(resulttext) {
		$('resultGroup').hide();
		$('result').innerHTML = '';
		$('resultPlainGroup').hide();
		$('result-textfield').mojo.setValue('');
		$('errorGroup').hide();
		$('error-text').innerHTML = '';
	},

	onDecodedImage: function(future) {
		this.decodeFuture = false;
		$('decodeProgress').hide();
		this.decodingSpinnerModel.spinning = false;
		this.controller.modelChanged(this.decodingSpinnerModel);
		try {
			var result = future.result;;
			this.showResult(result);
		} catch (e) {
			Mojo.Log.error('decoding failed: ' + e);
			this.showError('decoding failed: ' + e);
		}
	},

	decodeImage: function(event) {
		if (this.decodeFuture) return;
		this.decodeFuture = decode(this.plugin, this.currentFilename).then(this.onDecodedImage);
		this.clearResult();
		$('decodeProgress').show();
		this.decodingSpinnerModel.spinning = true;
		this.controller.modelChanged(this.decodingSpinnerModel);
		this.scrollTo($('bottomScroller'));
	},

	activate: function(event) {
		if (event && event.filename) {
			this.useImage(event.filename);
			this.decodeImage();
		}
		/* put in event handlers here that should only be in effect when this scene is active. For
		   example, key handlers that are observing the document */
	},

	deactivate: function(event) {
		/* remove any event handlers you added in activate and do any other cleanup that should happen before
		   this scene is popped or another scene is pushed on top */
	},

	cleanup: function(event) {
		/* this function should do any cleanup needed before the scene is destroyed as 
		   a result of being popped off the scene stack */
		if (this.decodeFuture) {
			this.decodeFuture.cancel();
		}
		this.controller.stopListening('qrimage', Mojo.Event.tap, this.launchCam);
		this.controller.stopListening('buttonDecode', Mojo.Event.tap, this.decodeImage);
		this.controller.stopListening('buttonChoose', Mojo.Event.tap, this.chooseImage);
		this.controller.stopListening('buttonShoot', Mojo.Event.tap, this.launchCam);
	},
});

MainAssistant.imgFilename = "/media/internal/.de.stbuehler.qrdecoder/tmp.jpg";
