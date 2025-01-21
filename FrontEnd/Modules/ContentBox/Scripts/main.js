"use strict";

import { TrackJS } from "trackjs";
import ContentBox from "@innovastudio/contentbox"
import { createApp, ref, isProxy, toRaw } from "vue";
import axios from "axios";

import ContentBuildersService from "../../../Core/Scripts/shared/contentBuilders.service";
import {AUTH_LOGOUT, AUTH_REQUEST} from "../../../Core/Scripts/store/mutation-types";
import store from "../../../Core/Scripts/store";
import UsersService from "../../../Core/Scripts/shared/users.service";
import ModulesService from "../../../Core/Scripts/shared/modules.service";
import TenantsService from "../../../Core/Scripts/shared/tenants.service";
import ItemsService from "../../../Core/Scripts/shared/items.service";
import DataSelectorsService from "../../../Core/Scripts/shared/dataSelectors.service";

(() => {
    class Main {
        constructor(settings) {
            this.vueApp = null;
            this.appSettings = null;

            this.usersService = new UsersService(this);
            this.modulesService = new ModulesService(this);
            this.tenantsService = new TenantsService(this);
            this.itemsService = new ItemsService(this);
            this.contentBuildersService = new ContentBuildersService(this);
            this.dataSelectorsService = new DataSelectorsService(this);

            // Fire event on page ready for direct actions
            document.addEventListener("DOMContentLoaded", () => {
                this.onPageReady();
            });
        }

        /**
         * Do things that need to wait until the DOM has been fully loaded.
         */
        onPageReady() {
            const configElement = document.getElementById("vue-config");
            this.appSettings = JSON.parse(configElement.innerHTML);

            if (this.appSettings.trackJsToken) {
                TrackJS.install({
                    token: this.appSettings.trackJsToken
                });
            }

            this.api = axios.create({
                baseURL: this.appSettings.apiBase
            });

            this.api.defaults.headers.common["Authorization"] = `Bearer ${localStorage.getItem("accessToken")}`;

            this.api.interceptors.response.use(undefined, async (error) => {
                // Automatically re-authenticate with refresh token if login token expired or logout if that doesn't work or it is otherwise invalid.
                if (error.response.status === 401) {
                    // If we ever get an unauthorized, logout the user.
                    if (error.response.config.url === "/connect/token") {
                        this.vueApp.$store.dispatch(AUTH_LOGOUT);
                    } else {
                        await this.vueApp.$store.dispatch(AUTH_REQUEST, { gotUnauthorized: true });
                    }
                }

                return Promise.reject(error);
            });

            this.initVue();
        }
        
        initVue() {
            this.vueApp = createApp({
                data: () => {
                    return {
                        appSettings: this.appSettings,
                        contentBox: null,
                        html: ""
                    }
                },
                mounted: async function () {
                    // Create object with settings for content box.
                    //screenMode: 'fullview',
                    const settings = {                         
                        wrapper: ".is-wrapper",
                        controlPanel: true,
                        slider: "glide",
                        navbar: true,
                        scriptPath: "/ContentBox/scripts/",
                        pluginPath: "/ContentBox/contentbuilder/",
                        assetPath: "/ContentBox/assets/",
                        modulePath: "/ContentBox/assets/modules/",
                        fontAssetPath: "/ContentBox/assets/fonts/",
                        contentStylePath: "/ContentBox/assets/styles/",
                        zoom: 0.97,
                        plugins: [
                            {name: 'WiserDataSelector', showInMainToolbar: true, showInElementToolbar: true}
                        ]
                    };

                    // Get data we need from database.
                    const promises = [];
                    promises.push(main.contentBuildersService.getHtml(this.appSettings.wiserItemId, this.appSettings.languageCode, this.appSettings.propertyName));
                    promises.push(main.contentBuildersService.getTenantSnippets());
                    promises.push(main.contentBuildersService.getTemplateCategories());
                    promises.push(main.contentBuildersService.getFramework());
                    const data = await Promise.all(promises);
                    this.html = data[0].data || "";
                    const snippetJson = data[1].data.tenantSnippets;
                    const snippetCategories = data[1].data.snippetCategories;
                    const mainDomain = data[1].data.mainDomain;
                    const templateCategories = data[2].data;
                    settings.framework = (data[3].data || "").toLowerCase();
                    if (settings.framework === "contentbuilder") {
                        settings.framework = "";
                    }
                    settings.iframeSrc = settings.framework !== "" ? `/ContentBox/blank-${settings.framework}.html` : '/ContentBox/blank.html';

                    // Add default content builder snippets                    
                    settings.snippetUrl = "/ContentBox/assets/minimalist-blocks/content.js";                    

                    // Default content builder categories.
                    settings.snippetCategories = [[120, "Basic"], [118, "Article"], [101, "Headline"], [119, "Buttons"], [102, "Photos"], [103, "Profile"], [116, "Contact"], [104, "Products"], [105, "Features"], [106, "Process"], [107, "Pricing"], [108, "Skills"], [109, "Achievements"], [110, "Quotes"], [111, "Partners"], [112, "As Featured On"], [113, "Page Not Found"], [114, "Coming Soon"], [115, "Help, FAQ"]];
                                        
                    // Add customer specific content builder snippet categories
                    if (snippetJson && snippetJson.length && snippetCategories && snippetCategories.length) {
                        // If we have snippets from database, only use those and not the default ones of the ContentBox.
                        settings.snippetCategories.unshift(...snippetCategories);
                        
                        // Get all images (of customer specific snippets and the default snippets) from the customer domain
                        settings.snippetPath = mainDomain;
                    }
                    
                    // Select the first category
                    settings.defaultSnippetCategory = settings.snippetCategories[0][0];

                    // Add default ContentBox templates
                    settings.templates = [
                        {
                            url: "/ContentBox/assets/templates-simple/templates.js",
                            path: "/ContentBox/assets/templates-simple/",
                            pathReplace: []
                        },
                        {
                            url: "/ContentBox/assets/templates-quick/templates.js",
                            path: "/ContentBox/assets/templates-quick/",
                            pathReplace: []
                        }
                    ];

                    settings.featuredCategories = [
                        {id: 1, designId: 1, name: 'Basic'},
                        {id: 1, designId: 2, name: 'Header'},
                        {id: 2, designId: 1, name: 'Slider'},
                        {id: 2, designId: 2, name: 'Article'},
                        {id: 3, designId: 2, name: 'Photos'},
                    ];

                    // Add customer specific ContentBox templates
                    if (templateCategories && templateCategories.length) {
                        settings.templates.push(
                            {
                                url: `${this.appSettings.apiRoot}content-builder/template.js?encryptedUserId=${encodeURIComponent(this.appSettings.encryptedUserId)}&subDomain=${encodeURIComponent(this.appSettings.subDomain)}`,
                                path: "",
                                pathReplace: []
                            });
                        settings.featuredCategories.unshift(...templateCategories); // Add as the first of the array
                        settings.defaultCategory = {
                            id: templateCategories[0].id,
                            designId: 3
                        };
                    }

                    // Workaround for combining the default snippets with the customer specific snippets
                    settings.onStart = function() {
                        if (snippetJson && snippetJson.length && snippetCategories && snippetCategories.length) {                                                     
                            if (window.data_basic?.snippets?.length >0) {
                                // Add asset path to default content builder snippets
                                for (let key in window.data_basic.snippets) {                                                                        
                                    window.data_basic.snippets[key].thumbnail = `ContentBox/assets/minimalist-blocks/${window.data_basic.snippets[key].thumbnail}`;
                                }

                                // Add customer specific snippets
                                window.data_basic.snippets.push(...snippetJson);                                
                            }                                                         
                        }

                        // Load customer styling
                        fetch(window.parent.dynamicItems.settings.htmlEditorCssUrl)
                            .then(response => {
                                if (!response.ok) {
                                    throw new Error(`HTTP error! Status: ${response.status}`);
                                }
                                return response.text(); // Retrieve the file as text
                            })
                            .then(cssContent => {                                
                                // You can manipulate or use the CSS content here
                                contentbox.addCustomStyle('customerStyling',cssContent)
                                
                            })
                            .catch(error => {
                                console.error('Error fetching the CSS file:', error);
                            });
                    };

                    settings.onImageBrowseClick = () => {         
                        window.parent.dynamicItems.fields.onHtmlEditorImageExec(null, null, null, contentbox.editor);
                        window.focus(); // so that document.click on parent works without have to click to focus

                        /*let img = contentbox.editor.activeImage;
                        img.setAttribute('src', 'https://html.com/wp-content/uploads/flamingo.jpg');
                        contentbox.editor.onChange();
                        contentbox.editor.onRender();
                        if (contentbox.editor.onImageChange) contentbox.editor.onImageChange();*/
                    };
                    /*settings.onImageSelectClick = () => {
                        window.parent.dynamicItems.fields.onHtmlEditorImageExec(null, null, null, contentbox.editor);
                        window.focus(); // so that document.click on parent works without have to click to focus
                    };*/

                    this.contentBox = new ContentBox(settings);
                    this.contentBox.loadHtml(this.html);
                },
                computed: {
                },
                components: {
                },
                methods: {
                }
            });

            // Let Vue know about our store.
            this.vueApp.use(store);

            // Mount our app to the main HTML element.
            this.vueApp = this.vueApp.mount("#app");
        }
    }

    window.main = new Main();
})();