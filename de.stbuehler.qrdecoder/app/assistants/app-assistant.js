var libraries   = MojoLoader.require({ name: "foundations", version: "1.0" });
var Future      = libraries["foundations"].Control.Future;

function AppAssistant() {
}

AppAssistant.prototype.setup = function() {
	Mojo.Log.info("AppAssistant: setup");
};

function StageAssistant() {
	/* this is the creator function for your stage assistant object */
}

StageAssistant.prototype.setup = function() {
	/* this function is for setup tasks that have to happen when the stage is first created */
	this.controller.pushScene("main");
};
