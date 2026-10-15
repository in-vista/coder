using System.Xml.Serialization;

namespace Api.Modules.Templates.Models.Template.WtsModels
{
    /// <summary>
    /// A loose element to define content in the HTTP body.
    /// </summary>
    public class BodyPartModel
    {
        /// <summary>
        /// The content to evaluate in the HTTP body.
        /// </summary>
        public string Text { get; set; }
        
        /// <summary>
        /// Indication whether this element uses a single item or not.
        /// </summary>
        public bool? SingleItem { get; set; }
        
        /// <summary>
        /// <inheritdoc cref="SingleItem"/>
        /// </summary>
        [XmlIgnore]
        public bool SingleItemSpecified => SingleItem.HasValue;
        
        /// <summary>
        /// The name of the result set from previously executed actions to utilize in this body's content.
        /// </summary>
        public string UseResultSet { get; set; }
        
        /// <summary>
        /// Indication whether to force an index.
        /// </summary>
        public bool? ForceIndex { get; set; }
        
        /// <summary>
        /// <inheritdoc cref="ForceIndex"/>
        /// </summary>
        [XmlIgnore]
        public bool ForceIndexSpecified => ForceIndex.HasValue;
        
        /// <summary>
        /// Indication whether to evaluate logic snippets in the content of the body's content.
        /// </summary>
        public bool? EvaluateLogicSnippets { get; set; }
        
        /// <summary>
        /// <inheritdoc cref="EvaluateLogicSnippets"/>
        /// </summary>
        [XmlIgnore]
        public bool EvaluateLogicSnippetsSpecified => EvaluateLogicSnippets.HasValue;
    }
}