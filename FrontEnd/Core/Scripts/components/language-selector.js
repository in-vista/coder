export default {
    name: "language-selector",

    props: {
        loggedOut: {
            type: Boolean,
            default: false
        }
    },

    computed: {
        selectedLanguage: {
            get() {
                return this.getLanguage();
            },
            set(language) {
                this.setLanguage(language);
            }
        }
    },

    template: `
        <select
            class="language-selector"
            :class="{ 'language-selector-logged-out': loggedOut }"
            v-model="selectedLanguage"
        >
            <option value="nl-NL">Nederlands</option>
            <option value="en-US">English</option>
        </select>
    `
};