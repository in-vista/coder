using JetBrains.Annotations;

namespace Api.Modules.SpeechToText.Models;

public sealed class SpeechToTextResult
{
    /// <summary>
    /// Gets or sets the returned text from the speech.
    /// </summary>
    public string Text { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the reason the request failed.
    /// </summary>
    [CanBeNull]
    public string FailReason { get; set; }

    /// <summary>
    /// Gets or sets whether the request was successful.
    /// </summary>
    public bool Success { get; set; }
}