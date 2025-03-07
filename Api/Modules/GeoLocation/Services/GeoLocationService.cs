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
    
    /// <inheritdoc/>
    public async Task<ServiceResult<Pro6PPAddress>> GetPro6PPAddress(string zipCode, int? houseNumber, string premise)
    {
        // Retrieve the API key for Pro6PP.
        string apiKey = await objectsService.GetSystemObjectValueAsync("pro6pp_key");
        
        // Check if the API key is non-existent. If it isn't, throw an unauthorized error.
        if (string.IsNullOrEmpty(apiKey))
            return new ServiceResult<Pro6PPAddress>
            {
                StatusCode = HttpStatusCode.Unauthorized,
                ErrorMessage = "Unauthorized"
            };
        
        // Prepare an empty address response.
        Pro6PPAddress address = new Pro6PPAddress();
        
        // Start a HTTP client to make a request towards the Pro6PP API.
        using (HttpClient client = new HttpClient())
        {
            // Prepare the base URL to request to the Pro6PP API.
            string baseUrl = "https://api.pro6pp.nl/v2/autocomplete/nl";
            
            // Prepare the query parameters to be sent with the request.
            Dictionary<string, string> queryParameters = new Dictionary<string, string>()
            {
                { "authKey", apiKey }
            };
            
            // Check for each query parameter of address information if it is given, and add it if it was.
            if(!string.IsNullOrEmpty(zipCode))
                queryParameters.Add("postalCode", zipCode);
            if(houseNumber.HasValue)
                queryParameters.Add("streetNumber", houseNumber.Value.ToString());
            if(!string.IsNullOrEmpty(premise))
                queryParameters.Add("premise", premise);
            
            // Combine the base request URL with the query parameters.
            string requestUrl = QueryHelpers.AddQueryString(baseUrl, queryParameters);
            
            // Request the address information from the Pro6PP API.
            HttpResponseMessage addressResponse = await client.GetAsync(requestUrl);
            
            // Check if the request was not successful. If not, throw an error with the response of the request.
            if (!addressResponse.IsSuccessStatusCode)
                return new ServiceResult<Pro6PPAddress>
                {
                    StatusCode = addressResponse.StatusCode,
                    ErrorMessage = await addressResponse.Content.ReadAsStringAsync()
                };
            
            // Retrieve the content of the response and deserialize it into the address model.
            string jsonResponse = await addressResponse.Content.ReadAsStringAsync();
            address = JsonConvert.DeserializeObject<Pro6PPAddress>(jsonResponse);
        }
        
        // Return the fetched address model.
        return new ServiceResult<Pro6PPAddress>(address);
    }
}