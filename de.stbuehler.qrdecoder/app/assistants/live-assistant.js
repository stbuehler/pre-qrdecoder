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

		this.mediaCaptureObj = libraries.mediacapture.MediaCapture({video:this.video});

		var i, typeIdx, fmt, dev; 
		for (i=0; this.mediaCaptureObj.supportedImageFormats.length != i; ++i){
			fmt = this.mediaCaptureObj.supportedImageFormats[i];
			if (fmt.mimetype == "image/jpeg"){
				break;
			}
		}
		for (var i=0; i != this.mediaCaptureObj.captureDevices.length; ++i) {
			dev = this.mediaCaptureObj.captureDevices[i];
			for (typeIdx = 0; typeIdx != dev.inputtype.length; ++typeIdx) {
				if (dev.inputtype[typeIdx] == this.mediaCaptureObj.INPUT_TYPE_IMAGE) {
					break;
				}
			}
		}
		this.mediaCaptureObj.load(dev.deviceUri, {"imageCaptureFormat":fmt});
		this.mediaCaptureObj.addEventListener("imagecapturecomplete", this.pictureTaken, false);

		/* setup widgets here */
		this.live_stop = true;
		this.live_running = false;

		/* add event handlers to listen to events from widgets */
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
					this.controller.stageController.popScene(this);
					this.mainscene.useImage(LiveAssistant.imgFilename);
					this.mainscene.showResult(future.result);
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
		Mojo.Log.error("live activate");
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
		Mojo.Log.error("live deactivate");
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
