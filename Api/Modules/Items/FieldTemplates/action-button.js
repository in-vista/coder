(() => {
    const field = $("#field_{propertyIdWithSuffix}");
    const userItemPermissions = {userItemPermissions};
    const encryptedItemId = '{itemIdEncrypted}';
    const entityType = '{entityType}';
    const propertyId = {propertyId};
    const readOnly = {readonly};
    const isNew = {isNew};
    let options = {options};
    
    options = $.extend({
        click: (event) => {
            window.dynamicItems.fields.onActionButtonClick(event, encryptedItemId, propertyId, options, field); 
        },
        icon: "gear"
    }, options);

    if (options.doesCreate && (userItemPermissions & window.dynamicItems.permissionsEnum.create) === 0) {
        options.enable = false;
    }
    if (options.doesUpdate && (userItemPermissions & window.dynamicItems.permissionsEnum.update) === 0) {
        options.enable = false;
    }
    if (options.doesDelete && (userItemPermissions & window.dynamicItems.permissionsEnum.delete) === 0) {
        options.enable = false;
    }

    if (field.text) {
        field.find(".originalText").html(options.text);
    }
    const kendoComponent = field.kendoButton(options).data("kendoButton");
    
    // Hide the action button if the item is set to be read-only and the "show-on-read-only" is false.
    const showOnReadOnly = options.showOnReadOnly !== undefined ? options.showOnReadOnly : true;
    
    // Hide the item based on certain properties.
    if(
        (!showOnReadOnly && readOnly) ||
        (options.hideWhenNew && isNew)
    )
        field.closest('.item').hide();
    
    {customScript}
})();