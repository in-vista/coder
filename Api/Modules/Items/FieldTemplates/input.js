(function() {
    let options = {options};
    let container = $("#container_{propertyIdWithSuffix}");
    let field = $("#field_{propertyIdWithSuffix}").change(window.dynamicItems.fields.onFieldValueChange.bind(window.dynamicItems.fields));
    const item = field.closest('.item');
    let urlMode = options.type === "url" || (field.val() || "").indexOf("http") === 0;
    let hyperlink = container.find(".open-link").toggle(urlMode);
    
    if (urlMode) {
        field.addClass("padding-right");
	
        hyperlink.click(dynamicItems.fields.onInputLinkIconClick.bind(dynamicItems.fields, field, options));
    }

    if (options.saveOnEnter) {
        field.keypress((event) => {
            window.dynamicItems.fields.onInputFieldKeyUp(event, options);
        });
    }

    const regexFailedMessage = options.regexFailedMessage ?? 'Ongeldige waarde.';
    const regexFailedMessageElement = item.find('.regexFailedMessage');
    
    field.keyup((event) => {
        const regex = /{pattern}/;
        const target = $(event.target);
        const matchesRegex = regex.test(target.val());
        regexFailedMessageElement[!matchesRegex ? 'text' : 'html'](!matchesRegex ? regexFailedMessage : '&nbsp;');
    });

    {customScript}
})();