namespace Api.Modules.Templates.Models.Template.WtsModels
{
    /// <summary>
    /// A model that defines how characters are handled in a configuration.
    /// </summary>
    public class CharacterEncodingModel
    {
        /// <summary>
        /// The character set that is used.
        /// </summary>
        public string CharacterSet { get; set; }
        
        /// <summary>
        /// The collation that is used.
        /// </summary>
        public string Collation { get; set; }
    }
}