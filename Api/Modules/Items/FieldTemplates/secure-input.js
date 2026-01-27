(function() {
    let options = {options};
    const canToggleSecureText = options.canToggleSecureText ?? true
    let container = $("#container_{propertyIdWithSuffix}");
    let field = $("#field_{propertyIdWithSuffix}").change(window.dynamicItems.fields.onFieldValueChange.bind(window.dynamicItems.fields));

    const eyeOpen  = '<i class="k-icon k-font-icon k-i-eye k-button-icon" style="font-size: 20px;"></i>';
    const eyeClosed = '<i class="k-icon k-font-icon k-i-eye-slash k-button-icon" style="font-size: 20px;"></i>';
    
    const toggleText = container.find(".toggle-text");
    if (canToggleSecureText) {
        toggleText
            .removeClass("hidden")
            .html(eyeClosed);
        
        toggleText.css(
            {
                "display": "flex",
                "flex-wrap": "wrap",
                "width": "40px",
                "justify-content": "center"
            });
        
        toggleText.click(function () {
            const current = field.attr("type");
            
            const isSecure = current === "password";
            field.attr("type", isSecure ? "text" : "password");
            
            
            toggleText.html(isSecure ? eyeOpen : eyeClosed);
        });
    } else{
        toggleText.addClass("hidden")
    }

    {customScript}
})();