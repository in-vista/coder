// Override kendo's alert function to set a default title.
const originalKendoAlert = kendo.alert;
kendo.alert = function (text, title = null) {
	const alert = originalKendoAlert(text);

	title ??= window.top.document.title;
	alert.element.getKendoAlert().title(title);

	return alert;
};