export default {
    name: "language-selector",

    props: {
        localization: {
            type: Object,
            required: true
        },

        loggedOut: {
            type: Boolean,
            default: false
        }
    },

    computed: {
        selectedLanguage: {
            get() {
                return this.localization.language;
            },

            async set(language) {
                await this.localization.setLanguage(language);
            }
        },

        supportedLanguages() {
            return this.localization.supportedLanguages;
        }
    },

    template: `
      <select
          class="language-selector"
          :class="{ 'language-selector-logged-out': loggedOut }"
          v-model="selectedLanguage"
      >
        <option
            v-for="language in supportedLanguages"
            :key="language.code"
            :value="language.code"
        >
          {{ language.name }}
        </option>
      </select>
    `
};