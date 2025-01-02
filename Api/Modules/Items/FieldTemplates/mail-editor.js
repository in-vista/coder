(() => {
    const options = {options};
    
    const value = {default_value};
    
    const autoSave = options.autoSave ?? true;
    const autoSaveInterval = options.autoSaveInterval ?? 5;
    
    const topolOptions = {
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
        },
        enableAutosaves: autoSave,
        autosaveInterval: autoSaveInterval
    };

    TopolPlugin.destroy();
    TopolPlugin.init(topolOptions);
    if(value && value !== '')
        TopolPlugin.load(JSON.parse(value));

    $('input#field_{propertyIdWithSuffix}').val(value);
    
    function encodeHtml(input) {
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    }
    
    {customScript}
})();