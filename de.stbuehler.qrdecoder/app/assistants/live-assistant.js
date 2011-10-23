var LiveAssistant = Class.create({
	initialize: function(mainscene, pluginwrapper) {
		this.mainscene = mainscene;
		this.plugin = pluginwrapper;
		this.pictureTaken = this.pictureTaken.bind(this);
	},

	setup: function() {
		this.controller.setupWidget(Mojo.Menu.appMenu, StageAssistant.appMenuAttributes, StageAssistant.appMenuModel);
		this.controller.enableFullScreenMode(true);

		this.video = document.createElement("video");

		var deviceinfo = JSON.parse(PalmSystem.deviceInfo);

		this.video.setAttribute("width", deviceinfo.screenWidth);
		this.video.setAttribute("height", deviceinfo.screenHeight);
		this.video.setAttribute("showControls", false);

		$('live-content').appendChild(this.video);

		this.mediaCaptureObj = libraries.mediacapture.MediaCapture({video: this.video});

		Mojo.Log.info("available capture devices: ", JSON.stringify(this.mediaCaptureObj.captureDevices));

		var sources = this.getVideoSources(this.mediaCaptureObj);
		this.captureDevice = this.selectCamera(sources);

		this.mediaCaptureObj.load(this.captureDevice.deviceUri, {imageCaptureFormat: this.captureDevice.format});
		this.mediaCaptureObj.addEventListener("imagecapturecomplete", this.pictureTaken, false);

		/* setup widgets here */
		this.live_stop = true;
		this.live_running = false;

		/* add event handlers to listen to events from widgets */
	},

	getVideoSources: function(mediaCaptureObj) {
		var list = [], i, d, f = false, f1;

		for (i = 0; i < mediaCaptureObj.supportedImageFormats.length; i++) {
			f1 = mediaCaptureObj.supportedImageFormats[i];
			if (f1.mimetype == "image/jpeg" && (!f || f1.samplerate > f.samplerate)) f = f1;
		}

		for (i = 0; i < mediaCaptureObj.captureDevices.length; i++) {
			d = mediaCaptureObj.captureDevices[i];
			for (typeIdx = 0; typeIdx != d.inputtype.length; ++typeIdx) {
				if (d.inputtype[typeIdx] == this.mediaCaptureObj.INPUT_TYPE_IMAGE) {
					/* found image/video device */
					list.push({ deviceUri: d.deviceUri, format: f, description: d.description, device: d });
					break;
				}
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

	pictureTaken: function(event) {
		Mojo.Log.error("picture taken");
		if (this.live_stop) {
			this.live_running = false;
			return;
		}
		var f = decode(this.plugin, LiveAssistant.imgFilename);
		Mojo.Log.error("decoding picture");
		f.then(function (future) {
			Mojo.Log.error("decoding picture done");
			try {
				if (this.live_stop) {
					this.live_running = false;
					return;
				}
				if (future.exception) {
					/* again */
					Mojo.Log.error("pictureTaken/live decoding failed: " + future.exception);
					this.takePicture();
				} else {
					var result = future.result;
					this.controller.stageController.popScene(this);
					this.mainscene.useImage(LiveAssistant.imgFilename);
					this.mainscene.showResult(result.text, result.barcodeformat);
				}
			} catch (e) {
				Mojo.Log.error("pictureTaken/decoded exception" + e);
			}
		}.bind(this));
	},

	takePicture: function(event) {
		this.mediaCaptureObj.startImageCapture(LiveAssistant.imgFilename,
			{ quality: 100, flash: 0, reviewDuration: 0, exifData: { } });
	},

	activate: function(event) {
		this.controller.stageController.setWindowProperties({blockScreenTimeout: true});
		this.plugin.activate();

		this.live_stop = false;
		if (!this.live_running) {
			this.live_running = true;
			this.takePicture();
		}
		/* put in event handlers here that should only be in effect when this scene is active. For
		   example, key handlers that are observing the document */
	},

	deactivate: function(event) {
		this.controller.stageController.setWindowProperties({blockScreenTimeout: false});
		// this.plugin.deactivate();
		this.live_stop = true;

		/* remove any event handlers you added in activate and do any other cleanup that should happen before
		   this scene is popped or another scene is pushed on top */
	},

	cleanup: function(event) {
		/* this function should do any cleanup needed before the scene is destroyed as 
		   a result of being popped off the scene stack */
		if (this.mediaCaptureObj) {
			this.mediaCaptureObj.removeEventListener("imagecapturecomplete", this.pictureTaken , false);
			this.mediaCaptureObj.unload();
			this.mediaCaptureObj = false;
		}
	},
});

LiveAssistant.imgFilename = "/media/internal/.de.stbuehler.qrdecoder/live.jpg";
