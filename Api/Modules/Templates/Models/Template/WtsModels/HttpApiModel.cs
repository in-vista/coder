using System.Xml.Serialization;

namespace Api.Modules.Templates.Models.Template.WtsModels
{
    /// <summary>
    /// A model containing the definition of a HTTP request.
    /// </summary>
    public class HttpApiModel : ActionModel
    {
        /// <summary>
        /// The URL to make the request for.
        /// </summary>
        public string Url { get; set; }
        
        /// <summary>
        /// The name of the HTTP method used to make the request.
        /// </summary>
        public string Method { get; set; }
        
        /// <summary>
        /// The OAuth authorization value used for this request.
        /// </summary>
        public string OAuth { get; set; }
        
        /// <summary>
        /// Indicates whether this request is performed as a single request.
        /// </summary>
        public bool? SingleRequest { get; set; }
        
        /// <summary>
        /// <inheritdoc cref="SingleRequest"/>
        /// </summary>
        [XmlIgnore]
        public bool SingleRequestSpecified => SingleRequest.HasValue;
        
        /// <summary>
        /// Indicates whether execution is not stopped by any failed SSL validations.
        /// </summary>
        public bool? IgnoreSSLValidationErrors { get; set; }
        
        /// <summary>
        /// <inheritdoc cref="IgnoreSSLValidationErrors"/>
        /// </summary>
        [XmlIgnore]
        public bool IgnoreSSLValidationErrorsSpecified => IgnoreSSLValidationErrors.HasValue;
        
        /// <summary>
        /// The property that is being written to for the next url.
        /// </summary>
        public string NextUrlProperty { get; set; }
        
        /// <summary>
        /// A collection of request headers.
        /// </summary>
        public HeaderModel[] Headers { get; set; }
        
        /// <summary>
        /// The body of the request.
        /// </summary>
        public BodyModel Body { get; set; }
        
        /// <summary>
        /// Forces the content type the response of the request will give.
        /// </summary>
        public string ResultContentType { get; set; }
    }
}