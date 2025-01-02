(() => {
    // Retrieve the settings of the entity property.
    const options = {options};
    
    // Retrieve the value of the entity property's instance.
    const value = {default_value};
    
    // Set up general options for the Topol component.
    let topolOptions = {
        id: '#field_{propertyIdWithSuffix}_container',
        authorize: {
            apiKey: 'I8aZbIYWVZtWaKWWWmrzbi7YvthqHpEh4mfKpbXm36XKaQTHEDgKJGje3OIa',
            userId: 'Coder',
        },
        callbacks: {
            onSave: function (json, html) {
                const jsonField = $('#field_{propertyIdWithSuffix}');
                jsonField.val(JSON.stringify(json));
                
                const htmlField = $('#field_{propertyIdWithSuffix}_html');
                htmlField.val(encodeHtml(html));
            }
        }
    };
    
    // Overrule any settings on the topol settings from the entity property settings.
    topolOptions = Object.assign(topolOptions, options);
    
    // Destroy any previous Topol instances. Otherwise, the second time a Topol instance is loaded, the library assumes
    // the iframe used by Topol was already loaded. This will cause the iframe to no longer be loaded properly.
    TopolPlugin.destroy();
    
    // Initialize the Topol mail editor view.
    TopolPlugin.init(topolOptions);
    
    // Set the initial value of the mail editor.
    if(value && value !== '')
        TopolPlugin.load(JSON.parse(value));
    
    // Set the initial value to the hidden input field, to later be read by Coder for saving the item details.
    $('input#field_{propertyIdWithSuffix}').val(value);

    /**
     * Encodes HTML so it can be properly assigned to attributes in the HTML document.
     * @param input The input string of the HTML to encode.
     * @returns {string} The encoded HTML from the given input.
     */
    function encodeHtml(input) {
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    }
    
    // Inject custom Javascript code from the entity property's settings.
    {customScript}
})();