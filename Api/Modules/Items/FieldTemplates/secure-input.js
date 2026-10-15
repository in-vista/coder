(function() {
    let options = {options};
    const canToggleSecureText = options.canToggleSecureText ?? true
    let container = $("#container_{propertyIdWithSuffix}");
    let field = $("#field_{propertyIdWithSuffix}").change(window.dynamicItems.fields.onFieldValueChange.bind(window.dynamicItems.fields));

    const toggleVisibilityEyeElement = $("#password-toggle_{propertyIdWithSuffix}");
    const secureInputPlaceholder = "••••••••••••••••••••••••";
    const secureInputType = field.attr("type");

    field.data("secureInputType", secureInputType);

    if (secureInputType === "password" && field.val() === secureInputPlaceholder) {
        field.addClass("skip-when-saving");
    }

    const updateToggleVisibility = function() {
        toggleVisibilityEyeElement.toggleClass("hidden", !canToggleSecureText || field.hasClass("skip-when-saving") || !field.val());
    }

    field.on("keydown", function(event) {
        if (!field.hasClass("skip-when-saving"))
            return;

        if (event.key.length === 1 || event.key === "Backspace" || event.key === "Delete") {
            field.val("");
            field.removeClass("skip-when-saving");
        }
    });

    field.on("paste", function() {
        if (!field.hasClass("skip-when-saving"))
            return;

        field.val("");
        field.removeClass("skip-when-saving");
    });

    field.on("input", function() {
        field.removeClass("skip-when-saving");
        updateToggleVisibility();
    });

    updateToggleVisibility();

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