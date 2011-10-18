var StageAssistant = Class.create({
	setup: function() {
		this.controller.pushScene({name: 'main'});
	},
	
	handleCommand: function(event) {
		if (event.type == Mojo.Event.command) {
			switch (event.command) {
			case 'do-support':
				if (Mojo.Environment.DeviceInfo.modelNameAscii == 'TouchPad') {
					Mojo.Controller.getAppController().createStageWithCallback(
						{ name: "supportStage", lightweight: true},
						function onSupportStage(stageController) {
							stageController.pushAppSupportInfoScene();
						},
						"card");
				} else {
					this.controller.pushAppSupportInfoScene();
				}
				break;
			case Mojo.Menu.helpCmd:
				this.controller.pushScene({name: 'help'});
				break;
			}
		}
	},
});

StageAssistant.appMenuAttributes = {
	omitDefaultItems: true,
};

StageAssistant.appMenuModel = {
	visible: true,
	items: [
		Mojo.Menu.editItem,
		{ label: $L('Copy result'), command: 'copy-result' },
		{ label: $L('Support'), command: 'do-support' },
		{ label: $L('Help'), command: Mojo.Menu.helpCmd }
	]
};
