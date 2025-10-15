(() => {
const container = $("#container_{propertyIdWithSuffix}");
const options = $.extend({ change: function(event) { window.dynamicItems.fields.onFieldValueChange(event, {options}); }}, {options});
const field = $("#field_{propertyIdWithSuffix}");
const savedValue = field.val();
const readonly = {readonly};

let kendoComponent;

switch(options.type) {
	case "time":
        if (savedValue) {
            let date = Dates.parseTime(savedValue);
            if ((typeof date.isValid === "function" && !date.isValid()) || !date.isValid) {
                date = Dates.parseDateTime(savedValue);
                if ((typeof date.isValid === "function" && !date.isValid()) || !date.isValid) {
                    if (savedValue !== "NOW()") {
                        console.warn("Unable to parse time for field {title}", savedValue, date);
                        kendo.alert("De tijd in het veld '{title}' staat opgeslagen in een onbekend formaat. Let op dat de tijd daarom mogelijk niet klopt en verloren kan gaan bij opslaan van dit item.");
                    }
                    if (savedValue === "NOW()" || options.value === "NOW()") {
                        options.value = new Date();
                    }
                } else {
                    options.value = date.toDate ? date.toDate() : date.toJSDate();
                }
            } else {
                options.value = date.toDate ? date.toDate() : date.toJSDate();
            }
        } else if(options.value === "NOW()") {
            options.value = new Date();
        } else {
			options.value = null;
		}
        
        field.data("kendoControl", "kendoTimePicker");
		kendoComponent = field.kendoTimePicker(options).data("kendoTimePicker");
		break;
	case "date":
        if (savedValue) {
            let date = Dates.parseDate(savedValue);
            if ((typeof date.isValid === "function" && !date.isValid()) || !date.isValid) {
                date = Dates.parseDateTime(savedValue);
                if ((typeof date.isValid === "function" && !date.isValid()) || !date.isValid) {
                    if (savedValue !== "NOW()") {
                        console.warn("Unable to parse time for field {title}", savedValue, date);
                        kendo.alert("De datum in het veld '{title}' staat opgeslagen in een onbekend formaat. Let op dat de datum daarom mogelijk niet klopt en verloren kan gaan bij opslaan van dit item.");
                    }
                    if (savedValue === "NOW()" || options.value === "NOW()") {
                        options.value = new Date();
                    }
                } else {
                    options.value = date.toDate ? date.toDate() : date.toJSDate();
                }
            } else {
                options.value = date.toDate ? date.toDate() : date.toJSDate();
            }
        } else if(options.value === "NOW()") {
            options.value = new Date();
        } else {
			options.value = null;
		}
        
        field.data("kendoControl", "kendoDatePicker");
		kendoComponent = field.kendoDatePicker(options).data("kendoDatePicker");
		break;
	default:
        if (savedValue) {
            let date = Dates.parseDateTime(savedValue);
            if ((typeof date.isValid === "function" && !date.isValid()) || !date.isValid) {
                if (savedValue !== "NOW()") {
                    console.warn("Unable to parse time for field {title}", savedValue, date);
                    kendo.alert("De datum & tijd in het veld '{title}' staat opgeslagen in een onbekend formaat. Let op dat de datum & tijd daarom mogelijk niet klopt en verloren kan gaan bij opslaan van dit item.");
                }
                if (savedValue === "NOW()" || options.value === "NOW()") {
                    options.value = new Date();
                }
            } else {
                options.value = date.toDate ? date.toDate() : date.toJSDate();
            }
        } else if(options.value === "NOW()") {
            options.value = new Date();
        } else {
			options.value = null;
		}
        
		kendoComponent = field.kendoDateTimePicker(options).data("kendoDateTimePicker");
		break;
}

if (options.queryIdGetValue) {
    const itemIdEncrypted = window.dynamicItems.selectedItem && window.dynamicItems.selectedItem.plainItemId ? window.dynamicItems.selectedItem.id : window.dynamicItems.settings.initialItemId;
    const data = {};    
    data.userId = window.dynamicItems.base.settings.userId;
    data.propertyName = container.data().propertyName;

    Wiser.api({
        url: dynamicItems.settings.wiserApiRoot + "items/" + encodeURIComponent(itemIdEncrypted) + "/action-button/" + container.data().propertyId + "?queryId=" + encodeURIComponent(options.queryIdGetValue) + "&itemLinkId=" + encodeURIComponent(container.data().itemLinkId),
        contentType: "application/json",
        dataType: "json",
        method: "POST",
        data: JSON.stringify(data)
    }).then((result) => {
        console.log('Query get overrule value success', result);

        // Set the value from the query to the input
        if (result.otherData?.[0]?.id !== undefined) {
            kendoComponent.value(result.otherData[0].id.replace(' ','T'));
            
            // Handle dependency again after loading the value into the combobox
            window.dynamicItems.fields.handleAllDependenciesOfContainer(window.dynamicItems.mainTabStrip.element, options.entityType, "", "mainScreen");
        }
    }).catch((result) => {
        console.warn('Query get overrule value error', result);
    });
}

kendoComponent.readonly(readonly);

{customScript}
})();