/**
 * - Defaults to nl-NL so existing/legacy code keeps working.
 * - Falls back to nl-NL when a translation is missing.
 * - Never throws because a translation is missing.
 */
export default class Localization {
    static DEFAULT_LANGUAGE = "nl-NL";
    static CULTURE_COOKIE = ".AspNetCore.Culture";
    
    static SUPPORTED_LANGUAGES = [
        "nl-NL",
        "en-US"
    ];

    constructor(base, language = Localization.DEFAULT_LANGUAGE) {
        this.base = base;
        
        this.language = language || Localization.DEFAULT_LANGUAGE;
        this.fallbackLanguage = Localization.DEFAULT_LANGUAGE;

        this.translations = {};
        this.fallbackTranslations = {};
    }

    /**
     * Initialize localization.
     */
    async initialize() {
        let language = this.getLanguageFromCookie();

        const databaseLanguage = await this.loadLanguageFromDatabase();

        if (Localization.SUPPORTED_LANGUAGES.includes(databaseLanguage)) {
            language = databaseLanguage;
            this.setLanguageCookie(language);
        }

        this.language = Localization.SUPPORTED_LANGUAGES.includes(language)
            ? language
            : Localization.DEFAULT_LANGUAGE;

        this.translations = await this.loadLanguage(this.language);

        return this;
    }

    /**
     * Change language at runtime.
     *
     * @param {string} language
     */
    async setLanguage(language) {
        this.setLanguageCookie(language)
        await this.saveLanguage(language);
        window.location.reload();
    }

    async saveLanguage(language) {
        const apiUrl = this.base.appSettings.apiBase + "api/v3/";

        const userData = JSON.parse(localStorage.getItem("userData"));

        if (!userData || !userData?.refresh_token) {
            return;
        }

        await Wiser.api({
            url: `${apiUrl}users/language`,
            method: "PUT",
            contentType: "application/json",
            data: JSON.stringify(language)
        });
    }

    /**
     * Store the selected language in a cookie.
     * @param {string} language
     */
    setLanguageCookie(language) {
        const value = `c=${language}|uic=${language}`;

        document.cookie = `${Localization.CULTURE_COOKIE}=${encodeURIComponent(value)}; path=/; SameSite=Lax`;
    }
    
    getLanguage() {
        return this.language;
    }

    getLanguageFromCookie() {
        const cookie = document.cookie.split("; ").find(row => row.startsWith(".AspNetCore.Culture="));

        if (!cookie) {
            return null;
        }

        const value = decodeURIComponent(cookie.split("=")[1]);

        const uiCulture = value.split("|").find(part => part.startsWith("uic="));

        return uiCulture ? uiCulture.substring(4) : null;
    }

    async loadLanguageFromDatabase() {
        const userData = JSON.parse(localStorage.getItem("userData"));

        if (!userData?.refresh_token) {
            return null;
        }

        try {
            const apiUrl = this.base.appSettings.apiBase + "api/v3/";

            return await Wiser.api({
                url: `${apiUrl}users/language`,
                method: "GET"
            });
        } catch (error) {
            console.warn("Could not load language from database", error);
            return null;
        }
    }

    /**
     * Apply the langues retreived from the user when logging in
     * @param language
     * @returns {Promise<void>}
     */
    async applyLanguage(language) {
        if (!Localization.SUPPORTED_LANGUAGES.includes(language)) {
            return;
        }

        this.setLanguageCookie(language);
        window.location.reload();
    }

    isUserLoggedIn() {
        const userSettings = sessionStorage.getItem("userSettings");

        if (!userSettings) {
            return false;
        }

        try {
            return !!JSON.parse(userSettings);
        } catch {
            return false;
        }
    }

    /**
     * Translate a key.
     *
     * @param {string} key
     * @param {Object} params
     * @returns {string}
     */
    t(key, params = {}) {
        if (!key) {
            return "";
        }

        const [module, ...keyParts] = key.split(".");
        const translationKey = keyParts.join(".");

        let value = this.getValue(
            this.translations[module],
            translationKey
        );

        if (value === undefined) {
            value = this.getValue(
                this.fallbackTranslations[module],
                translationKey
            );
        }

        // If the key points to a group, use "" as its base value
        if (value && typeof value === "object") {
            value = value[""];
        }

        if (value === undefined) {
            console.warn(`Missing translation: ${key}`);
            return key;
        }

        return this.interpolate(value, params);
    }

    /**
     * Load all translation files for a language.
     *
     * Expected structure:
     *
     * Localization/
     * ├── nl-NL/
     * │   ├── common.json
     * │   ├── admin.json
     * │   └── dashboard.json
     * └── en-US/
     *     ├── common.json
     *     ├── admin.json
     *     └── dashboard.json
     */
    async loadLanguage(language) {
        const translations = {};

        const modules = [
            "common"
        ];

        for (const module of modules) {
            try {
                const moduleTranslations = await import(
                    `./${language}/${module}.json`
                    );

                translations[module] =
                    moduleTranslations.default || moduleTranslations;
            } catch (error) {
                console.warn(
                    `Could not load ${module} translations for ${language}`,
                    error
                );
            }
        }

        return translations;
    }

    /**
     * Resolve a dotted key such as:
     *
     * admin.module.add.title
     */
    getValue(object, key) {
        return key.split(".").reduce((current, part) => {
            if (current === undefined || current === null) {
                return undefined;
            }

            return current[part];
        }, object);
    }

    /**
     * Replace {name}, {count}, etc.
     */
    interpolate(value, params) {
        return value.replace(/\{([^}]+)\}/g, (match, key) => {
            return params[key] !== undefined
                ? params[key]
                : match;
        });
    }
}