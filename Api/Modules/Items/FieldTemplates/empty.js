(function() {
    let container = $("#container_{propertyIdWithSuffix}");
    const item = container.closest('.item');

    const placeholderPattern = /^\{[^{}]*\}$/;
    const inputValue = container.text().trim();

    // If it only contains text of a replacement variable (e.g. {full_name} ), remove the item
    // so it doesn't take up any space.
    if (placeholderPattern.test(inputValue))
        item.remove();
    
})();