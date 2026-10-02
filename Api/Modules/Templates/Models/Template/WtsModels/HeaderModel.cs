namespace Api.Modules.Templates.Models.Template.WtsModels
{
    /// <summary>
    /// A model that defines a HTTP header in a request.
    /// </summary>
    public class HeaderModel
    {
        /// <summary>
        /// The name of the header.
        /// </summary>
        public string Name { get; set; }
        
        /// <summary>
        /// The value of the header.
        /// </summary>
        public string Value { get; set; }
        
        /// <summary>
        /// The name of a result set from previously executed actions that can be utilized in the definition of this header.
        /// </summary>
        public string UseResultSet { get; set; }
    }
}