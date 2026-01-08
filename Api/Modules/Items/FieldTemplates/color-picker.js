(() => {
    const options = {options};
    
    const kendoComponent = $("#field_{propertyIdWithSuffix}").kendoColorPicker($.extend({
        buttons: false,
        change: function(event) { window.dynamicItems.fields.onFieldValueChange(event, options); },
    }, options)).data("kendoColorPicker");
    
    const readonly = {readonly};
    
    kendoComponent.enable(!readonly);
})();