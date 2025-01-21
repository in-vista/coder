(async () => {
    // Retrieve the settings of the entity property.
    const options = {options};

    // Retrieve the value of the entity property's instance.
    const value = {default_value};
   
    // Page builder    
    document.querySelector("#openPageBuilder").addEventListener('click', pageBuilder => {
        const htmlWindow = $("#contentBuilderWindow").clone(true);
        
        const iframe = htmlWindow.find("iframe");
        iframe.attr("src", `/Modules/ContentBox?wiserItemId=${encodeURIComponent('{itemId}')}&propertyName=${encodeURIComponent('{propertyName}')}&languageCode=${encodeURIComponent('{languageCode}' || "")}&userId=${encodeURIComponent(dynamicItems.base.settings.userId)}`);

        // Add customer styles to page builder 
        /*const iframeDoc = iframe.contentDocument || iframe.contentWindow.document; // Get the iframe's document
        const link = iframeDoc.createElement('link');
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = window.dynamicItems.settings.htmlEditorCssUrl; // The URL of the stylesheet from the parent site
        iframeDoc.head.appendChild(link);*/       

        htmlWindow.kendoWindow({
            width: "100%",
            height: "100%",
            title: "Page builder",
            close: (closeEvent) => {
                closeEvent.sender.destroy();
                htmlWindow.remove();
            }
        });

        const kendoWindow = htmlWindow.data("kendoWindow").maximize().open();

        htmlWindow.find(".k-primary, .k-button-solid-primary").kendoButton({
            click: () => {
                const html = iframe[0].contentWindow.main.vueApp.contentBox.html();                
                $("#field_{propertyIdWithSuffix}").val(html);
                
                kendoWindow.close();
            },
            icon: "save"
        });

        htmlWindow.find(".k-secondary").kendoButton({
            click: () => {
                kendoWindow.close();
            },
            icon: "cancel"
        });
    });

    // Inject custom Javascript code from the entity property's settings.
    {customScript}
})();