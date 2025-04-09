(function() {
    var options = $.extend({
        culture: "nl-NL"
    }, {options});

    var field = $("#field_{propertyIdWithSuffix}");
    var kendoComponent = field.kendoNumericTextBox($.extend({change: function(event) { window.dynamicItems.fields.onFieldValueChange(event, options); }}, {options})).data("kendoNumericTextBox");

    if (options.saveOnEnter) {
        field.keypress(function(event) {
            window.dynamicItems.fields.onInputFieldKeyUp(event, options);
        });
    }

    {customScript}
})();