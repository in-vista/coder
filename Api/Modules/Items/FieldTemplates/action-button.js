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
        const itemWindowHeader = itemWindow.find('.k-window-titlebar');
        const itemWindowHeaderContainer = itemWindowHeader.find('.item-window-header-actions').length
            ? itemWindowHeader.find('.item-window-header-actions')
            : $('<div class="item-window-header-actions" style="flex-grow: 1"></div>').insertAfter(itemWindowHeader.find('.k-window-title'));
        itemWindowHeaderContainer.append(item);
        
        // Initial settings.
        item.css({
            'width': ''
        });
        button.find('.k-button-text').remove();
        icon.css({
            'font-size': '32px'
        });
        
        // Tooltip on event.
        field.on('mouseenter', event => {
            tooltip.style.opacity = '1';
            tooltip.textContent = options.text;

            // Get button position
            const rect = button.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();

            // Calculate position (centered above button)
            const top = rect.top + window.scrollY + tooltipRect.height + 18;
            const left = rect.left + window.scrollX + (rect.width / 2) - (tooltipRect.width / 2);
            tooltip.style.top = `${top}px`;
            tooltip.style.left = `${left}px`;
        });
        
        // Tooltip off event.
        field.on('mouseleave', () => {
            tooltip.style.opacity = '0';
        });
    }
    
    {customScript}
})();