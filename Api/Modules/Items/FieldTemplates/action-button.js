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
    
    // Move the action button to the header if set to be so.
    if(options.header) {
        // Retrieve the button container, button and icon.
        const item = field.closest('.item');
        const button = item.find('.k-button');
        const icon = button.find('.k-icon');
        
        // Move the element to the header of the item window.
        const itemWindow = item.closest('.k-window');
        const itemWindowTitlebar = itemWindow.find('.k-window-titlebar');
        const itemWindowActionsContainer = itemWindowTitlebar.find('.item-window-actions').length
            ? itemWindowTitlebar.find('.item-window-actions')
            : $('<div class="item-window-actions"></div>').insertAfter(itemWindowTitlebar.find('.k-window-title'));
        itemWindowActionsContainer.append(item);
        
        // Remove unused elements from the item.
        item.find('h4, .handler, .form-hint').remove();
        
        // Initial settings.
        item.css({
            'width': ''
        });
        button.find('.k-button-text').remove();
        icon.css({
            'font-size': '24px'
        });
        
        // Tooltip.
        if(options.text !== undefined) {
            // Set the title of the tooltip element.
            item.find('.tooltip').attr('title', options.text);
            
            // Create a Kendo tooltip.
            const tooltip = item.kendoTooltip({
                position: 'bottom',
                content: function(event) {
                    const target = event.target;
                    return $(target).find('.tooltip').attr('title');
                }
            }).data('kendoTooltip');
            
            tooltip.refresh();
        }
    }
    
    {customScript}
})();