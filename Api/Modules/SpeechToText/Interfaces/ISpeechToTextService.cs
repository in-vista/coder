using System.IO;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Api.Modules.SpeechToText.Models;

namespace Api.Modules.SpeechToText.Interfaces;

/// <summary>
/// Interface for the speech to text service.
/// </summary>
public interface ISpeechToTextService
{
    /// <summary>
    /// Converts an audio stream to text.
    /// </summary>
    /// <param name="audioStream">The audio stream to transcribe.</param>
    /// <param name="identity">The identity of the current user.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The speech recognition result.</returns>
    Task<SpeechToTextResult> GetTextFromSpeechAsync(Stream audioStream, ClaimsIdentity identity, CancellationToken cancellationToken = default
    );
}