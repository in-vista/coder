(() => {
    const field = $("#fieldSet_{propertyIdWithSuffix}");
    const container = field.closest(".item");
    const loader = container.find(".grid-loader");
    const checklistBox = field.find("#checklist-box_{propertyIdWithSuffix}");

    const options = {options};
    const readonly = {readonly};
    const usesCustomQuery = options.customQuery;
    const showSearch = options.showSearch;

    const currentItemId = "{itemIdEncrypted}";
    const propertyId = "{propertyId}";

    const idField = options.idField || options.dataValueField || "id";
    const titleField = options.titleField || options.dataTextField || "title";
    const checkedField = options.checkedField || "checked";

    // If a link type is configured, the checked state is based on linked items.
    // Otherwise the checked state is expected to come from the query/dataSource.
    const useLinkedItemsForCheckedState = options.linkTypeNumber > 0 || options.linkType > 0;

    // Keeps track of the currently linked items when using linked-items mode.
    let linkedItemIds = new Set();

    const setLoading = (isLoading) => {
        loader.toggleClass("loading", isLoading);
    };

    const getInputData = () => {
        let inputData = window.dynamicItems.fields.getInputData(field.closest(".popup-container, .pane-content")) || [];

        return inputData.reduce((fieldValues, item) => {
            fieldValues[item.key] = item.value;
            return fieldValues;
        }, {});
    };

    const getValueFromItem = (item, fieldNames, fallbackValue = "") => {
        for (const fieldName of fieldNames) {
            if (!fieldName) {
                continue;
            }

            if (item[fieldName] !== undefined && item[fieldName] !== null) {
                return item[fieldName];
            }
        }

        return fallbackValue;
    };

    const normalizeId = (value) => {
        if (value === undefined || value === null) {
            return "";
        }

        return value.toString();
    };

    const normalizeBoolean = (value) => {
        if (value === true || value === 1) {
            return true;
        }

        if (value === false || value === 0 || value === null || value === undefined) {
            return false;
        }

        const normalizedValue = value.toString().toLowerCase();

        return normalizedValue === "1"
            || normalizedValue === "true"
            || normalizedValue === "yes"
            || normalizedValue === "ja";
    };
    
    const getActionButtonUrl = (queryId) => {
        return `${window.dynamicItems.settings.wiserApiRoot}items/${encodeURIComponent(currentItemId)}/action-button/${encodeURIComponent(propertyId)}?queryId=${encodeURIComponent(queryId || dynamicItems.settings.zeroEncrypted)}&itemLinkId={itemLinkId}&userType=${encodeURIComponent(dynamicItems.settings.userType)}`;
    };

    const getReadUrl = () => {
        return getActionButtonUrl(!usesCustomQuery ? options.queryId : dynamicItems.settings.zeroEncrypted);
    };

    const getSaveUrl = () => {
        return getActionButtonUrl(options.queryIdOnChange);
    };

    const getLinkedItemsUrl = () => {
        const queryParameters = [];

        if (options.entityType) {
            queryParameters.push(`entityType=${encodeURIComponent(options.entityType)}`);
        }

        if (options.itemIdEntityType) {
            queryParameters.push(`itemIdEntityType=${encodeURIComponent(options.itemIdEntityType)}`);
        }

        if (options.linkTypeNumber !== undefined && options.linkTypeNumber !== null) {
            queryParameters.push(`linkType=${encodeURIComponent(options.linkTypeNumber)}`);
        } else if (options.linkType !== undefined && options.linkType !== null) {
            queryParameters.push(`linkType=${encodeURIComponent(options.linkType)}`);
        }

        if (options.reversed !== undefined && options.reversed !== null) {
            queryParameters.push(`reversed=${encodeURIComponent(options.reversed === true || options.reversed === "true")}`);
        }

        const queryString = queryParameters.length > 0
            ? `?${queryParameters.join("&")}`
            : "";

        return `${window.dynamicItems.settings.wiserApiRoot}items/${encodeURIComponent(currentItemId)}/linked/details${queryString}`;
    };

    const getOptionId = (item) => {
        return normalizeId(getValueFromItem(item, [idField, "id", "itemId", "itemid", "encryptedId", "encryptedid"], ""));
    };

    const getOptionTitle = (item) => {
        return getValueFromItem(item, [titleField, "title", "name", "text"], "");
    };

    const getOptionChecked = (item, optionId) => {
        if (useLinkedItemsForCheckedState) {
            return linkedItemIds.has(optionId);
        }

        return normalizeBoolean(getValueFromItem(item, [checkedField, "checked", "selected", "isChecked", "ischecked"], false));
    };

    const getStaticItems = () => {
        if (Array.isArray(options.dataSource)) {
            return options.dataSource;
        }

        if (options.dataSource && Array.isArray(options.dataSource.data)) {
            return options.dataSource.data;
        }

        return null;
    };

    const hasRequiredChecklistFields = (items) => {
        if (!Array.isArray(items) || items.length === 0) {
            return true;
        }

        const requiredFields = [
            idField,
            titleField
        ];

        if (!useLinkedItemsForCheckedState) {
            requiredFields.push(checkedField);
        }

        return items.every(item => {
            return requiredFields.every(fieldName => {
                return Object.prototype.hasOwnProperty.call(item, fieldName)
                    && item[fieldName] !== undefined
                    && item[fieldName] !== null;
            });
        });
    };

    const loadAvailableItems = async () => {
        const staticItems = getStaticItems();

        if (staticItems) {
            if (!hasRequiredChecklistFields(staticItems)) {
                console.error("Checklistbox dataSource is missing one or more required fields.", {
                    requiredFields: [
                        idField,
                        titleField,
                        ...(!useLinkedItemsForCheckedState ? [checkedField] : [])
                    ],
                    staticItems: staticItems
                });

                return [];
            }

            return staticItems;
        }

        const inputData = getInputData();

        const result = await Wiser.api({
            url: getReadUrl(),
            method: "POST",
            contentType: "application/json",
            dataType: "json",
            data: JSON.stringify(inputData)
        });

        const items = result.otherData || [];

        if (!hasRequiredChecklistFields(items)) {
            console.error("Checklistbox query result is missing one or more required fields.", {
                requiredFields: [
                    idField,
                    titleField,
                    ...(!useLinkedItemsForCheckedState ? [checkedField] : [])
                ],
                items: items
            });

            return [];
        }

        return items;
    };

    const loadLinkedItemIds = async () => {
        if (!useLinkedItemsForCheckedState) {
            return new Set();
        }

        const linkedItems = await Wiser.api({
            url: getLinkedItemsUrl(),
            method: "GET",
            dataType: "json"
        });

        const linkedIds = new Set();

        for (const linkedItem of linkedItems || []) {
            const linkedId = normalizeId(getValueFromItem(linkedItem, [
                "id",
                "itemId",
                "itemid",
                "encryptedId",
                "encryptedid"
            ], ""));

            if (linkedId !== "") {
                linkedIds.add(linkedId);
            }
        }

        return linkedIds;
    };

    const loadItems = async () => {
        try {
            setLoading(true);

            const availableItems = await loadAvailableItems();

            if (useLinkedItemsForCheckedState) {
                linkedItemIds = await loadLinkedItemIds();
            }

            renderItems(availableItems);
        } catch (exception) {
            console.error("read error - {title}", exception);
            kendo.alert("Er is iets fout gegaan tijdens het laden van het veld '{title}'. Probeer het a.u.b. nogmaals door de pagina te verversen.");
        } finally {
            setLoading(false);
        }
    };
    
    const renderItems = (items) => {
        checklistBox.empty();

        if (!items || items.length === 0) {
            checklistBox.append("<div class=\"checklist-box-empty\">Geen opties gevonden.</div>");
            return;
        }

        for (let index = 0; index < items.length; index++) {
            const item = items[index];

            const optionId = getOptionId(item);
            const title = getOptionTitle(item);
            const checked = getOptionChecked(item, optionId);

            const checkboxId = `checklist-box_{propertyIdWithSuffix}_${index}`;

            const optionElement = $("<span>")
                .addClass("checklist-box-option");

            const labelElement = $("<label>")
                .addClass("checkbox")
                .attr("for", checkboxId);

            const checkboxElement = $("<input>")
                .attr("type", "checkbox")
                .attr("id", checkboxId)
                .addClass("textField k-input checklist-box-checkbox")
                .attr("name", "{propertyName}")
                .attr("data-lpignore", "true")
                .data("option-id", optionId)
                .prop("checked", checked)
                .prop("disabled", readonly === true);

            const titleElement = $("<span>")
                .text(title);

            labelElement.append(checkboxElement);
            labelElement.append(titleElement);
            optionElement.append(labelElement);

            checklistBox.append(optionElement);
        }
    };

    const saveItem = async (optionId, checked, checkbox) => {
        if (readonly === true) {
            return;
        }

        try {
            setLoading(true);

            const inputData = getInputData();

            await Wiser.api({
                url: getSaveUrl(),
                method: "POST",
                contentType: "application/json",
                dataType: "json",
                data: JSON.stringify({
                    ...inputData,
                    optionId: optionId,
                    checked: checked ? 1 : 0
                })
            });

            if (useLinkedItemsForCheckedState) {
                if (checked) {
                    linkedItemIds.add(normalizeId(optionId));
                } else {
                    linkedItemIds.delete(normalizeId(optionId));
                }
            }
        } catch (exception) {
            console.error("save error - {title}", exception);
            checkbox.prop("checked", !checked);
            kendo.alert("Er is iets fout gegaan tijdens het opslaan van het veld '{title}'. Probeer het a.u.b. nogmaals.");
        } finally {
            setLoading(false);
        }
    };
    
    const renderSearchBar = () => {
        if (!showSearch || field.find(".checklist-box-search").length > 0) {
            return;
        }

        const searchElement = $(`
            <input type="text"
                   class="checklist-box-search k-input-inner"
                   placeholder="${options.searchPlaceholder || "Zoeken..."}">
        `);

        checklistBox.before(searchElement);

        searchElement.on("input", function () {
            const searchValue = $(this).val().toLowerCase();

            checklistBox.find(".checklist-box-option").each(function () {
                const optionElement = $(this);
                const optionText = optionElement.text().toLowerCase();

                optionElement.prop("hidden", !optionText.includes(searchValue));
            });
        });
    };

    // If a height is defined, change the max-height to avoid the container from spanning to high.
    if (options.height) {
        checklistBox.css({
            "max-height": `{height}px`,
            "min-height": `{height}px`,
            "overflow-y": "auto",
            "overflow-x": "hidden"
        });
    }
    
    checklistBox.on("click", ".checklist-box-option", function (event) {
        const checkboxContainer = $(this);
        const checkbox = checkboxContainer.find(".checklist-box-checkbox");

        if (!checkbox.length || checkbox.prop("disabled")) {
            return;
        }

        // If the user did not click the checkbox itself, toggle it manually.
        if (!$(event.target).is(".checklist-box-checkbox")) {
            event.preventDefault();
            checkbox.prop("checked", !checkbox.is(":checked"));
        }

        const optionId = checkbox.data("option-id");
        const checked = checkbox.is(":checked");

        saveItem(optionId, checked, checkbox);
    });

    renderSearchBar();
    loadItems();

    {customScript}
})();