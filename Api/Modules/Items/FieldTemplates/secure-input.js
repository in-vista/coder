(function() {
    let options = {options};
    const canToggleSecureText = options.canToggleSecureText ?? true
    let container = $("#container_{propertyIdWithSuffix}");
    let field = $("#field_{propertyIdWithSuffix}").change(window.dynamicItems.fields.onFieldValueChange.bind(window.dynamicItems.fields));

    const toggleVisibilityEyeElement = $("#password-toggle_{propertyIdWithSuffix}");

    toggleVisibilityEyeElement.toggleClass("hidden", !canToggleSecureText);

    if (canToggleSecureText) {
        toggleVisibilityEyeElement
            .on("click", function () {
                const isSecureText = field.attr("type") === "password";

                field.attr("type", isSecureText ? "text" : "password");

                toggleVisibilityEyeElement
                    .toggleClass("icon-eye-visible", !isSecureText)
                    .toggleClass("icon-eye-invisible", isSecureText);
            });
    }

    {customScript}
})();