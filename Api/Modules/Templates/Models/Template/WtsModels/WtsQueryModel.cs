using System.Xml.Serialization;

namespace Api.Modules.Templates.Models.Template.WtsModels
{
    /// <summary>
    /// A model definition for a SQL query action.
    /// </summary>
    [XmlType("Query")]
    public class WtsQueryModel : ActionModel
    {
        /// <summary>
        /// The query to execute.
        /// </summary>
        public string Query { get; set; }
        
        /// <summary>
        /// The timeout the query has to adhere to, or it will be canceled.
        /// </summary>
        public int? Timeout { get; set; }
        
        /// <summary>
        /// The character encoding settings for the query.
        /// </summary>
        public CharacterEncodingModel CharacterEncoding { get; set; }
        
        /// <summary>
        /// Indication whether to use a transaction when executing this query.
        /// </summary>
        public bool? UseTransaction { get; set; }
        
        /// <summary>
        /// <inheritdoc cref="UseTransaction"/>
        /// </summary>
        [XmlIgnore]
        public bool UseTransactionSpecified => UseTransaction.HasValue;
    }
}