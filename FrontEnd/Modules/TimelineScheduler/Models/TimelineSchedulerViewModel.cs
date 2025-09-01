using FrontEnd.Core.Models;

namespace FrontEnd.Modules.TimelineScheduler.Models;

public class TimelineSchedulerViewModel : BaseViewModel
{
    // TODO: Rinus: Deze properties opruimen als ik die niet nodig heb
    
    /// <summary>
    ///  Gets or sets the ID of the Wiser item to load the HTML from.
    /// </summary>
    public ulong WiserItemId { get; set; }
    
    /// <summary>
    /// Gets or sets the property name of the item that contains the HTML to load.
    /// </summary>
    public string PropertyName { get; set; }
    
    /// <summary>
    /// Gets or sets the HTML code of the HTML to load.
    /// </summary>
    public string LanguageCode { get; set; }
    
    /// <summary>
    /// Gets or sets the encrypted user ID. This is used for loading the CSS for the content box.
    /// </summary>
    public string UserId { get; set; }

    public object ZeroEncrypted { get; set; }
    public string ResourcesQueryId { get; set; }
}