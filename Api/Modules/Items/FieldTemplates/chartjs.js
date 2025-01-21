(async () => {
    // Set up variables for elements in the document.
    const container = $("#container_{propertyIdWithSuffix}");
    const loader = container.find(".loader");
    
    // Show the loader.
    loader.addClass('loading');
    
    // Retrieve the settings of the entity property.
    const options = {options};
    
    // Get the chart element.
    const chartElement = document.getElementById('chart');
    
    // Retrieve data from query.
    let data = [];
    // Option 1: queryId parameter
    if(options.queryId) {
        const dataResults = await Wiser.api({
            method: 'POST',
            contentType: 'application/json',
            dataType: 'json',
            url: `${dynamicItems.settings.wiserApiRoot}items/${encodeURIComponent("{itemIdEncrypted}")}/action-button/{propertyId}?queryId=${encodeURIComponent(options.queryId || dynamicItems.settings.zeroEncrypted)}&itemLinkId={itemLinkId}&userType=${encodeURIComponent(dynamicItems.settings.userType)}`,
            data: JSON.stringify({})
        });

        data = dataResults.otherData;
    }
    // Option 2: url parameter.
    if(options.url) {
        let url = options.url;
        let method = 'GET';
        let body = {};
        
        if(typeof options.url === 'object') {
            url = options.url.url;
            method = options.url.method ?? method;
            body = options.body ?? body;
        }
        
        const requestSettings = {
            method: method,
            contentType: 'application/json',
            dataType: 'json',
            url: url
        }
        
        if(method !== 'GET')
            requestSettings['data'] = JSON.stringify(body);
        
        const dataResults = await Wiser.api(requestSettings);
        
        data = dataResults.otherData;
    }
    
    // Parse the data into grouped data sets.
    let datasets;
    if(options.group) {
        // Determine the type of group from the settings.
        const groupType = typeof options.group;

        /**
         * Function to find-or-create a group in the given array of group.
         * @param groupName - The name of group to find or create.
         * @param groups - The collection of groups to look for the group in.
         * @returns {Number} The index of the (newly created) group in the array of groups.
         */
        function findOrCreateGroup(groupName, groups) {
            let groupIndex = groups.findIndex(set => set.label === groupName);
            if(groupIndex === -1) {
                const newGroup = {
                    label: groupName,
                    data: []
                };
                groups.push(newGroup);
                groupIndex = groups.length - 1;
            }
            
            return groupIndex;
        }
        
        switch(groupType) {
            case 'string':
                datasets = data.reduce((current, dataEntry) => {
                    const groupName = dataEntry[options.group];
                    const groupIndex = findOrCreateGroup(groupName, current);
                    current[groupIndex].data.push(dataEntry);

                    return current;
                }, []);
                
                break;
            case 'object':
                datasets = data.reduce((current, dataEntry) => {
                    for(const groupName in options.group) {
                        const groupSettings = options.group[groupName];
                        const dataColumn = groupSettings.dataColumn;
                        
                        const groupIndex = findOrCreateGroup(groupName, current);
                        
                        const dataValue = dataEntry[dataColumn];
                        current[groupIndex].data.push(dataValue);
                    }

                    return current;
                }, []);

                for(const groupName in options.group) {
                    const groupSettings = options.group[groupName];
                    const datasetOptions = groupSettings.options;

                    const groupIndex = findOrCreateGroup(groupName, datasets);

                    datasets[groupIndex] = {
                        ...datasets[groupIndex],
                        ...datasetOptions
                    }
                }
                
                break;
        }
    } else {
        datasets = [
            {
                data: data
            }
        ]
    }
    
    // Apply custom options to all datasets.
    datasets = datasets.map(set => {
        return {
            ...set,
            ...options.datasetOptions
        }
    });
    
    // Initialize the chart.
    new Chart(chartElement, {
        type: options.type,
        data: {
            labels: data.map(row => row[options.labelsColumn]),
            datasets: datasets
        },
        options: {
            plugins: {
                legend: {
                    display: !!options.group
                }
            },
            ...options
        }
    });
    
    loader.removeClass('loading');

    // Inject custom Javascript code from the entity property's settings.
    {customScript}
})();