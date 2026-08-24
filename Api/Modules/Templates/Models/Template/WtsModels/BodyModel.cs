using System.Collections.Generic;

namespace Api.Modules.Templates.Models.Template.WtsModels
{
    /// <summary>
    /// A model containing information on how HTTP requests should build represent the body.
    /// </summary>
    public class BodyModel
    {
        /// <summary>
        /// The HTTP content type of the body.
        /// </summary>
        public string ContentType { get; set; }
        
        /// <summary>
        /// The loose parts of the HTTP body's content.
        /// </summary>
        public List<BodyPartModel> BodyParts { get; set; }
    }
}