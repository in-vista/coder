namespace Api.Modules.Topol.Models;

/// <summary>
/// A model containing request information for sending a test mail through the Topol service.
/// </summary>
public class SendTestMailRequest
{
    /// <summary>
    /// The e-mail of the recipient.
    /// </summary>
    public string Email { get; set; }
    
    /// <summary>
    /// The HTML content of the e-mail.
    /// </summary>
    public string Html { get; set; }
}