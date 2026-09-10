using System;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Api.Modules.SpeechToText.Interfaces;
using Api.Modules.SpeechToText.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace Api.Modules.SpeechToText.Controllers;

/// <summary>
/// Controller for converting uploaded speech audio to text.
/// </summary>
[Route("api/v3/whisper")]
[ApiController]
public class SpeechToTextController : ControllerBase
{
    private readonly ISpeechToTextService speechToTextService;
    private readonly ILogger<SpeechToTextController> logger;

    /// <summary>
    /// Initializes the speech-to-text controller.
    /// </summary>
    /// <param name="speechToTextService">Service responsible for processing and transcribing speech.</param>
    /// <param name="logger">Logger used for reporting unexpected errors.</param>
    public SpeechToTextController(ISpeechToTextService speechToTextService, ILogger<SpeechToTextController> logger)
    {
        this.speechToTextService = speechToTextService;
        this.logger = logger;
    }

    /// <summary>
    /// Converts a WAV audio stream to text.
    /// </summary>
    /// <param name="cancellationToken">Token used to cancel speech processing when the request is aborted.</param>
    /// <returns>A result containing the recognized text or the reason transcription failed.</returns>
    [HttpPost("speech-to-text")]
    [Consumes("audio/wav","audio/x-wav", "audio/wave", "audio/vnd.wave")]
    public async Task<IActionResult> GetTextFromSpeech(CancellationToken cancellationToken)
    {
        SpeechToTextResult speechToTextResult;

        try
        {
            speechToTextResult = await speechToTextService.GetTextFromSpeechAsync(
                Request.Body,
                User.Identity as ClaimsIdentity,
                cancellationToken
            );
        }
        catch (Exception exception)
        {
            logger.LogCritical(
                exception,
                "An error occurred while converting speech to text."
            );

            return BadRequest(new SpeechToTextResult
            {
                Success = false,
                FailReason = exception.Message
            });
        }

        if (!speechToTextResult.Success)
            return BadRequest(speechToTextResult);

        return new JsonResult(speechToTextResult);
    }
}