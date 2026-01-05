using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Api.Core.Interfaces;
using Api.Core.Models;
using GeeksCoreLibrary.Core.DependencyInjection.Interfaces;
using GeeksCoreLibrary.Core.Extensions;
using Microsoft.Extensions.Options;
using Newtonsoft.Json.Linq;

namespace Api.Core.Services
{
    /// <inheritdoc cref="IJsonService" />
    public class JsonService : IJsonService, ITransientService
    {
        private readonly ApiSettings apiSettings;

        /// <summary>
        /// Creates a new instance of JsonService.
        /// </summary>
        public JsonService(IOptions<ApiSettings> apiSettings)
        {
            this.apiSettings = apiSettings.Value;
        }

        /// <inheritdoc />
        public void EncryptValuesInJson(JToken jsonObject, string encryptionKey, List<string> extraPropertiesToEncrypt = null)
        {
            if (apiSettings.JsonPropertiesToAlwaysEncrypt == null || !apiSettings.JsonPropertiesToAlwaysEncrypt.Any())
            {
                // No point in executing this function if there are no properties to encrypt.
                return;
            }

            if (jsonObject == null)
            {
                return;
            }

            foreach (var child in jsonObject.Children())
            {
                switch (child)
                {
                    case JArray childAsArray:
                        {
                            foreach (var item in childAsArray)
                            {
                                EncryptValuesInJson(item, encryptionKey, extraPropertiesToEncrypt);
                            }

                            break;
                        }
                    case JObject childAsObject:
                        {
                            EncryptValuesInJson(childAsObject, encryptionKey, extraPropertiesToEncrypt);
                            break;
                        }
                    case JProperty childAsProperty:
                        {
                            switch (childAsProperty.Value)
                            {
                                case JObject valueAsObject:
                                    {
                                        EncryptValuesInJson(valueAsObject, encryptionKey, extraPropertiesToEncrypt);
                                        break;
                                    }
                                case JArray valueAsArray:
                                {
                                    foreach (var item in valueAsArray)
                                    {
                                        // Check whether the value is a primitive type and whether we have to encrypt it.
                                        // If so, we want to directly encrypt the value in the array.
                                        if(item is JValue value && ShouldEncryptProperty(childAsProperty.Name))
                                            value.Value = value.ToString(CultureInfo.InvariantCulture).EncryptWithAesWithSalt(encryptionKey, true);
                                        // Otherwise, recursively search for possibly nested properties to encrypt.
                                        else
                                            EncryptValuesInJson(item, encryptionKey, extraPropertiesToEncrypt);
                                    }

                                    break;
                                }
                                case JValue value:
                                    {
                                        if (ShouldEncryptProperty(childAsProperty.Name, extraPropertiesToEncrypt))
                                            value.Value = value.ToString(CultureInfo.InvariantCulture).EncryptWithAesWithSalt(encryptionKey, true);

                                        break;
                                    }
                                default:
                                    throw new Exception($"Unsupported JSON value type in 'EncryptValuesInJson': {childAsProperty.Value.GetType().Name}");
                            }


                            break;
                        }
                    default:
                        throw new Exception($"Unsupported JSON type in 'EncryptValuesInJson': {child.GetType().Name}");
                }
            }
        }
        
        /// <summary>
        /// Checks whether the given property name is present in the list of JSON properties to encrypt.
        /// </summary>
        /// <param name="propertyName">The property name to check whether to encrypt.</param>
        /// <param name="extraPropertiesToEncrypt">Optional: If you need to encrypt any extra properties, that are not in the web.config, you can enter them here.</param>
        /// <returns>True if the values is present in the list of JSON properties to encrypt. False otherwise.</returns>
        private bool ShouldEncryptProperty(string propertyName, List<string> extraPropertiesToEncrypt = null)
        {
            bool Matches(IEnumerable<string> patterns) =>
                patterns != null && patterns.Any(p => MatchesPattern(propertyName, p));

            return
                Matches(apiSettings.JsonPropertiesToAlwaysEncrypt) ||
                Matches(extraPropertiesToEncrypt);
        }
        
        private bool MatchesPattern(string propertyName, string pattern)
        {
            // Geen wildcard → exacte match
            if (!pattern.Contains('*'))
                return string.Equals(propertyName, pattern, StringComparison.OrdinalIgnoreCase);

            var parts = pattern.Split('*');
            if (pattern.EndsWith("*") && parts.Length == 2)
                return propertyName.StartsWith(parts[0], StringComparison.OrdinalIgnoreCase);

            // fallback (zou normaal niet gebeuren)
            return false;
        }
    }
}