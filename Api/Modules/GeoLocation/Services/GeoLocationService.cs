using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using Api.Core.Services;
using Api.Modules.GeoLocation.Interfaces;
using Api.Modules.GeoLocation.Models;
using GeeksCoreLibrary.Core.DependencyInjection.Interfaces;
using GeeksCoreLibrary.Modules.Objects.Interfaces;
using Microsoft.AspNetCore.WebUtilities;
using Newtonsoft.Json;

namespace Api.Modules.GeoLocation.Services;

public class GeoLocationService : IGeoLocationService, IScopedService
{
    private readonly IObjectsService objectsService;

    public GeoLocationService(IObjectsService objectsService)
    {
        this.objectsService = objectsService;
    }
    
    public async Task<ServiceResult<Pro6PPAddress>> GetPro6PPAddress(string zipCode, int? houseNumber, string premise)
    {
        string apiKey = await objectsService.GetSystemObjectValueAsync("pro6pp_key");
        if (string.IsNullOrEmpty(apiKey))
            return new ServiceResult<Pro6PPAddress>
            {
                StatusCode = HttpStatusCode.Unauthorized,
                ErrorMessage = "Unauthorized"
            };

        Pro6PPAddress address = new Pro6PPAddress();

        using (HttpClient client = new HttpClient())
        {
            string baseUrl = "https://api.pro6pp.nl/v2/autocomplete/nl";

            Dictionary<string, string> queryParameters = new Dictionary<string, string>()
            {
                { "authKey", apiKey }
            };
            
            if(!string.IsNullOrEmpty(zipCode))
                queryParameters.Add("postalCode", zipCode);
            if(houseNumber.HasValue)
                queryParameters.Add("streetNumber", houseNumber.Value.ToString());
            if(!string.IsNullOrEmpty(premise))
                queryParameters.Add("premise", premise);

            string requestUrl = QueryHelpers.AddQueryString(baseUrl, queryParameters);
            
            HttpResponseMessage addressResponse = await client.GetAsync(requestUrl);

            if (!addressResponse.IsSuccessStatusCode)
                return new ServiceResult<Pro6PPAddress>
                {
                    StatusCode = addressResponse.StatusCode,
                    ErrorMessage = await addressResponse.Content.ReadAsStringAsync()
                };
            
            string jsonResponse = await addressResponse.Content.ReadAsStringAsync();
            address = JsonConvert.DeserializeObject<Pro6PPAddress>(jsonResponse);
        }

        return new ServiceResult<Pro6PPAddress>(address);
    }
}