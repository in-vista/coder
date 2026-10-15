(async () => {
    const container = $("#container_{propertyIdWithSuffix}");

    let resolveEditorReady;
    let rejectEditorReady;

    /*
     * This promise is resolved from the editor's onInit callback.
     * The iframe is not available yet when this promise is created.
     */
    const editorReady = new Promise((resolve, reject) => {
        resolveEditorReady = resolve;
        rejectEditorReady = reject;
    });

    container.data("topolLandingEditorReady", editorReady);

    container.attr("data-topol-landing-editor", "true");

    const loader = container.find(".loader");

    const readOnly = {readonly};
    const options = {options} || {};
    const value = {default_value};

    const editorSelector = "#field_{propertyIdWithSuffix}_container";

    const existingEditor = container.data("topolLandingEditor");

    if (readOnly) {
        if (existingEditor && typeof existingEditor.close === "function") {
            existingEditor.close();
        }

        container.removeData("topolLandingEditor");
        container.removeData("topolLandingEditorSave");
        container.removeData("topolLandingEditorReady");

        return;
    }

    let identifier = 0;
    let mergeTags = null;
    let pendingSave = null;
    let saveInProgress = null;

    /*
     * Load the Topol Landing Page Editor script.
     */
    function loadLandingEditorScript() {
        if (typeof window.LandingPageEditor === "function") {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const scriptUrl = "https://v1.page-assets.topol.io/loader/build.js";

            /*
             * Reuse an existing script element because multiple editor
             * instances may be initialized on the same page.
             */
            let script = document.querySelector(`script[src="${scriptUrl}"]`);

            if (!script) {
                script = document.createElement("script");
                script.src = scriptUrl;
                script.async = true;
                document.head.appendChild(script);
            }

            const checkLoaded = () => {
                if (typeof window.LandingPageEditor === "function") {
                    resolve();
                } else {
                    reject(
                        new Error(
                            "LandingPageEditor was not found after loading build.js.",
                        ),
                    );
                }
            };

            script.addEventListener("load", checkLoaded, {
                once: true,
            });

            script.addEventListener(
                "error",
                () => {
                    reject(new Error("Could not load the Topol Landing Page Editor."));
                },
                {
                    once: true,
                },
            );

            /*
             * The script may already have been loaded before the event
             * handlers were attached.
             */
            if (typeof window.LandingPageEditor === "function") {
                resolve();
            }
        });
    }

    /*
     * Hide the title when it is empty or contains only &nbsp;.
     */
    const titleElement = container.find(".title");
    const titleContentElement = titleElement.find(
        'label[for="field_{propertyIdWithSuffix}"]',
    );

    if (/^(&nbsp;)?$/.test(titleContentElement.text().trim())) {
        titleElement.hide();
    }

    /*
     * Load the identifier used by Topol for file-manager requests.
     */
    if (options.identifierQueryId) {
        const dataResult = await Wiser.api({
            method: "POST",
            contentType: "application/json",
            dataType: "json",
            url:
                `${dynamicItems.settings.wiserApiRoot}` +
                `items/${encodeURIComponent("{itemIdEncrypted}")}` +
                `/action-button/{propertyId}` +
                `?queryId=${encodeURIComponent(
                    options.identifierQueryId || dynamicItems.settings.zeroEncrypted,
                )}` +
                `&itemLinkId={itemLinkId}` +
                `&userType=${encodeURIComponent(dynamicItems.settings.userType)}`,
            data: JSON.stringify({}),
        });

        const rows = dataResult.otherData || [];
        const firstRow = rows[0];

        /*
         * Support both object-shaped and array-shaped API responses.
         */
        if (firstRow) {
            identifier = firstRow.identifier ?? firstRow[0] ?? 0;
        }
    }

    /*
     * Load merge tags.
     */
    if (options.mergeTagsQueryId) {
        const mergeTagsResult = await Wiser.api({
            method: "POST",
            contentType: "application/json",
            dataType: "json",
            url:
                `${dynamicItems.settings.wiserApiRoot}` +
                `items/${encodeURIComponent("{itemIdEncrypted}")}` +
                `/action-button/{propertyId}` +
                `?queryId=${encodeURIComponent(
                    options.mergeTagsQueryId || dynamicItems.settings.zeroEncrypted,
                )}` +
                `&itemLinkId={itemLinkId}` +
                `&userType=${encodeURIComponent(dynamicItems.settings.userType)}`,
            data: JSON.stringify({}),
        });

        const mergeTagsData = mergeTagsResult.otherData || [];

        /*
         * Convert the flat API response into the grouped structure expected
         * by the Topol editor.
         */
        mergeTags = mergeTagsData.reduce((groups, entry) => {
            const groupName = entry.group;
            let group = groups;

            if (groupName) {
                group =
                    groups.find((item) => item.name === groupName) ||
                    groups[
                    groups.push({
                        name: groupName,
                        items: [],
                    }) - 1
                        ];
            }

            if (!group.items) {
                group.items = [];
            }

            group.items.push({
                value: entry.value,
                text: entry.text,
                label: entry.label ?? entry.text,
            });

            return groups;
        }, []);
    }

    /*
     * Load the Topol Landing Page Editor.
     */
    loader.addClass("loading");

    try {
        await loadLandingEditorScript();

        /*
         * Load custom templates.
         */
        const customTemplatesContainer = container.find(
            ".custom-templates-container",
        );

        if (options.loadCustomTemplatesQueryId) {
            const customTemplatesButton = customTemplatesContainer.find(
                ".load-custom-template",
            );

            const customTemplatesResult = await Wiser.api({
                method: "POST",
                contentType: "application/json",
                dataType: "json",
                url:
                    `${dynamicItems.settings.wiserApiRoot}` +
                    `items/${encodeURIComponent("{itemIdEncrypted}")}` +
                    `/action-button/{propertyId}` +
                    `?queryId=${encodeURIComponent(
                        options.loadCustomTemplatesQueryId ||
                        dynamicItems.settings.zeroEncrypted,
                    )}` +
                    `&itemLinkId={itemLinkId}` +
                    `&userType=${encodeURIComponent(dynamicItems.settings.userType)}`,
                data: JSON.stringify({}),
            });

            customTemplatesButton.kendoDropDownList({
                optionLabel: "Selecteer een template...",
                clearButton: false,
                dataTextField: "text",
                dataValueField: "id",
                dataSource: customTemplatesResult.otherData || [],

                change: async function () {
                    const templateId = this.value();

                    if (!templateId) {
                        return;
                    }

                    const templateResult = await Wiser.api({
                        method: "GET",
                        contentType: "application/json",
                        dataType: "json",
                        url:
                            `${dynamicItems.settings.wiserApiRoot}` +
                            `topol/${encodeURIComponent(templateId)}`,
                    });

                    const json = templateResult.json;

                    if (!json) {
                        this.select(null);
                        kendo.alert("Deze template heeft nog geen content!");
                        return;
                    }

                    const editor = container.data("topolLandingEditor");

                    if (editor) {
                        editor.load(typeof json === "string" ? JSON.parse(json) : json);
                    }
                },
            });

            customTemplatesContainer.removeClass("hidden");
        }

        function saveEditorValue(result) {
            const jsonField = $("#field_{propertyIdWithSuffix}");
            const htmlField = $("#field_{propertyIdWithSuffix}_html");

            if (result?.json !== undefined && result.json !== null) {
                jsonField.val(JSON.stringify(result.json));
            }

            if (result?.html !== undefined && result.html !== null) {
                htmlField.val(encodeHtml(result.html));
            }

            /*
             * Resolve the promise created by saveLandingEditorAndWait()
             * when Topol reports that the save has completed.
             */
            if (pendingSave) {
                const pending = pendingSave;
                pendingSave = null;

                window.clearTimeout(pending.timer);
                pending.resolve(result);
            }
        }

        /*
         * Base configuration for the Landing Page Editor.
         */
        const landingConfig = {
            authorize: {
                apiKey: "{topolApiKey}",
                userId: String(identifier),
            },

            apiAuthorizationHeader: `Bearer ${localStorage.getItem("accessToken")}`,

            api: {
                FOLDERS: "{baseUrl}/api/v3/topol/folders",

                IMAGE_UPLOAD: "{baseUrl}/api/v3/topol/image-upload",
            },

            language: "nl",
            title: "Landing page editor",
            showUnsavedDialogBeforeExit: false,
            mergeTags: mergeTags,

            ...options,
        };

        /*
         * Apply entity-property settings first.
         */
        Object.assign(landingConfig, options);

        /*
         * Make sure email-editor settings cannot re-enable the top bar.
         */
        landingConfig.removeTopBar = true;
        landingConfig.title = "Landing page editor";

        const landingEditor = LandingPageEditor({
            config: landingConfig,

            onSave: saveEditorValue,

            onSaveAndClose: saveEditorValue,

            /*
             * Topol creates the iframe during render().
             * Therefore, configure it here rather than before render().
             */
            onInit: function () {
                loader.removeClass("loading");

                const iframe = container.find("iframe")[0];

                if (iframe) {
                    iframe.allowFullscreen = true;
                    iframe.setAttribute("allow", "fullscreen");
                    iframe.setAttribute("allowfullscreen", "");
                    iframe.setAttribute("webkitallowfullscreen", "");
                    iframe.setAttribute("mozallowfullscreen", "");
                }

                if (value && value !== "") {
                    try {
                        /*
                         * The stored value may be either a JSON string or
                         * an already-parsed object.
                         */
                        const savedValue =
                            typeof value === "string" ? JSON.parse(value) : value;

                        landingEditor.load(savedValue);
                    } catch (error) {
                        console.error(
                            "The stored landing-page value is invalid JSON.",
                            error,
                        );
                    }
                }

                resolveEditorReady(landingEditor);
            },

            onError: function (error) {
                loader.removeClass("loading");

                rejectEditorReady(error);

                console.error("Topol Landing Page Editor error:", error);
            },
        });

        container.data("topolLandingEditor", landingEditor);

        function saveLandingEditorAndWait(timeout = 30000) {
            /*
             * Reuse the existing promise if a save is already running.
             */
            if (saveInProgress) {
                return saveInProgress;
            }

            saveInProgress = new Promise((resolve, reject) => {
                const timer = window.setTimeout(() => {
                    pendingSave = null;

                    reject(
                        new Error(
                            "The Topol Landing Page Editor did not finish saving in time.",
                        ),
                    );
                }, timeout);

                pendingSave = {
                    resolve,
                    reject,
                    timer,
                };

                try {
                    landingEditor.save();
                } catch (error) {
                    window.clearTimeout(timer);
                    pendingSave = null;
                    reject(error);
                }
            }).finally(() => {
                saveInProgress = null;
            });

            return saveInProgress;
        }

        container.data("topolLandingEditorSave", saveLandingEditorAndWait);

        landingEditor.render(editorSelector);

        $("input#field_{propertyIdWithSuffix}").val(value || "");
    } catch (error) {
        loader.removeClass("loading");

        rejectEditorReady(error);

        console.error("Could not initialize the Topol Landing Page Editor.", error);

        kendo.alert("De landing-page editor kon niet worden geladen.");
    }

    function encodeHtml(input) {
        const div = document.createElement("div");
        div.textContent = input || "";
        return div.innerHTML;
    }
})();
