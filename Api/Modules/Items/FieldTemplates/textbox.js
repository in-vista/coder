(function() {
var field = $("#field_{propertyIdWithSuffix}");
const item = field.closest('.item');
var options = {options};
options.type = options.type || "text";

var codeMirrorSettings = {
    lineNumbers: true,
    indentUnit: 4,
    lineWrapping: true,
    foldGutter: true,
    gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter", "CodeMirror-lint-markers"],
    lint: true,
	extraKeys: {
		"Ctrl-Q": function (cm) {
			cm.foldCode(cm.getCursor());
		},
		"F11": function (cm) {
			cm.setOption("fullScreen", !cm.getOption("fullScreen"));
		},
		"Esc": function (cm) {
			if (cm.getOption("fullScreen")) cm.setOption("fullScreen", false);
		},
		"Ctrl-Space": "autocomplete"
	}
};

switch (options.type.toLowerCase()) {
    case "css":
        codeMirrorSettings.mode = "text/css";
        break;
    case "javascript":
        codeMirrorSettings.mode = "text/javascript";
        break;
    case "mysql":
        codeMirrorSettings.mode = "text/x-mysql";
        break;
    case "xml":
        codeMirrorSettings.mode = "application/xml";
        break;
    case "html":
        codeMirrorSettings.mode = "text/html";
        break;
    case "json":
        codeMirrorSettings.mode = "application/json";
        break;
}

const regexFailedMessage = options.regexFailedMessage ?? 'Ongeldige waarde.';
const regexFailedMessageElement = item.find('.regexFailedMessage');

if (codeMirrorSettings.mode) {
	// Only load code mirror when we actually need it.
	Misc.ensureCodeMirror().then(function() {
        field.parent().removeAttr("class");
		var codeMirrorInstance = CodeMirror.fromTextArea(field[0], codeMirrorSettings);
		field.data("CodeMirrorInstance", codeMirrorInstance);
		
		codeMirrorInstance.on('change', function(editor, changeObject) {
			const value = editor.doc.getValue();
			validateRegex(value);
		});
	});
}

field
	.change(async (event) => {
		await window.dynamicItems.fields.onFieldValueChange(event, options);
	})
	.keyup(async event => {
		await window.dynamicItems.fields.onTextFieldKeyUp(event);
		validateRegex($(event.target).val());
	});

function validateRegex(input) {
	const regex = /{pattern}/;
	const matchesRegex = regex.test(input);
	regexFailedMessageElement[!matchesRegex ? 'text' : 'html'](!matchesRegex ? regexFailedMessage : '&nbsp;');
}

{customScript}
})();