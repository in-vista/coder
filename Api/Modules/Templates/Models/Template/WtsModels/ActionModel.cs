using Api.Modules.Templates.Attributes;
using GeeksCoreLibrary.Core.Enums;
using GeeksCoreLibrary.Core.Models;
using JetBrains.Annotations;

namespace Api.Modules.Templates.Models.Template.WtsModels
{
    /// <summary>
    /// A model that holds information on the base information of an action performed by a CTS configuration.
    /// </summary>
    public abstract class ActionModel
    {
        /// <summary>
        /// The ID of the time configuration of this CTS configuration that is used for this action.
        /// </summary>
        public int TimeId { get; set; }
        
        /// <summary>
        /// A numeric value to indicate the order on when this action should perform. The lower the value, the higher the priority.
        /// </summary>
        public int Order { get; set; }
        
        /// <summary>
        /// The name of the result set that this action will give as output.
        /// </summary>
        [CanBeNull]
        public string ResultSetName { get; set; }
        
        /// <summary>
        /// The name of the result set that this action can utilize that was fetched in a previously performed action.
        /// </summary>
        [CanBeNull]
        public string UseResultSet { get; set; }
        
        /// <summary>
        /// A model containing hash settings.
        /// </summary>
        [CanBeNull]
        public HashSettingsModel HashSettings { get; set; } = new()
        {
            Algorithm = HashAlgorithms.SHA256,
            Representation = HashRepresentations.Base64
        };
        
        /// <summary>
        /// The HTTP status code the output of this action has to return to continue execution of this CTS configuration.
        /// </summary>
        [CanBeNull]
        public string OnlyWithStatusCode { get; set; }
        
        /// <summary>
        /// The output this action has to return to continue execution of this CTS configuration.
        /// </summary>
        [CanBeNull]
        public string OnlyWithSuccessState { get; set; }
        
        /// <summary>
        /// A model containing information on how this action is logged during execution.
        /// </summary>
        [CanBeNull]
        public LogSettings LogSettings { get; set; }
    }
}