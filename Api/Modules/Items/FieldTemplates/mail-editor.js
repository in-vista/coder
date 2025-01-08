(async () => {
    // Set up variables for elements in the document.
    const container = $("#container_{propertyIdWithSuffix}");
    
    // Retrieve the settings of the entity property.
    const options = {options};
    
    // Retrieve the value of the entity property's instance.
    const value = {default_value};
    
    // Load the identifier from the queryId. If it is not present, set it to "0" by default.
    let identifier = 0;
    if(options.identifierQueryId) {
        const dataResult = await Wiser.api({
            method: "POST",
            contentType: "application/json",
            dataType: "json",
            url: `${dynamicItems.settings.wiserApiRoot}items/${encodeURIComponent("{itemIdEncrypted}")}/action-button/{propertyId}?queryId=${encodeURIComponent(options.identifierQueryId || dynamicItems.settings.zeroEncrypted)}&itemLinkId={itemLinkId}&userType=${encodeURIComponent(dynamicItems.settings.userType)}`,
            data: JSON.stringify({})
        });
        
        const rows = dataResult.otherData;
        const firstRow = rows[0];
        identifier = firstRow['identifier'] ?? firstRow[0];
    }
    
    // Load custom templates.
    const customTemplatesContainer = container.find('.custom-templates-container');
    if(options.loadCustomTemplatesQueryId) {
        const customTemplatesButton = customTemplatesContainer.find('.load-custom-template');

        Wiser.api({
            method: "POST",
            contentType: "application/json",
            dataType: "json",
            url: `${dynamicItems.settings.wiserApiRoot}items/${encodeURIComponent("{itemIdEncrypted}")}/action-button/{propertyId}?queryId=${encodeURIComponent(options.loadCustomTemplatesQueryId || dynamicItems.settings.zeroEncrypted)}&itemLinkId={itemLinkId}&userType=${encodeURIComponent(dynamicItems.settings.userType)}`,
            data: JSON.stringify({})
        }).then(dataResult => {
            const dataSource = dataResult.otherData;

            customTemplatesButton.kendoDropDownList({
                optionLabel: 'Selecteer een template...',
                clearButton: false,
                dataTextField: 'text',
                dataValueField: 'id',
                dataSource: dataSource,
                change: async function(event) {
                    const templateId = this.value();
                    
                    if(!templateId)
                        return;

                    const templateResults = await Wiser.api({
                        method: "GET",
                        contentType: "application/json",
                        dataType: "json",
                        url: `${dynamicItems.settings.wiserApiRoot}topol/${encodeURIComponent(templateId)}`
                    });
                    
                    const json = templateResults.json;
                    if(!json) {
                        this.select(null);
                        kendo.alert('Deze template heeft nog geen content!');
                        return;
                    }

                    TopolPlugin.load(json);
                }
            });
        });
    } else {
        customTemplatesContainer.toggleClass('hidden', true);
    }
    
    // Set up general options for the Topol instance.
    let topolOptions = {
        // Required.
        id: '#field_{propertyIdWithSuffix}_container',
        authorize: {
            apiKey: '{topolApiKey}',
            // 'userId' is used by Topol to track the amount of Topol-related requests the "user" has made. This string
            // can be anything. This is the only variable that is sent back to our custom endpoints for the Topol file
            // manager. That way we can identify what item the Topal instance is related to. This is a bit of a hacky
            // way, but unfortunately currently the only way.
            userId: String(identifier)
        },
        // Custom API endpoints authorization
        apiAuthorizationHeader: `Bearer ${localStorage.getItem('accessToken')}`,
        // API overwrites.
        api: {
            FOLDERS: '{baseUrl}/api/v3/topol/folders',
            IMAGE_UPLOAD: '{baseUrl}/api/v3/topol/image-upload'
        },
        // Callbacks.
        callbacks: {
            onSave: function (json, html) {
                const jsonField = $('#field_{propertyIdWithSuffix}');
                jsonField.val(JSON.stringify(json));
                
                const htmlField = $('#field_{propertyIdWithSuffix}_html');
                htmlField.val(encodeHtml(html));
            }
        },
        // Default settings.
        language: 'nl',
        removeTopBar: true,
        showUnsavedDialogBeforeExit: false
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