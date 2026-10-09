using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Api.Modules.SpeechToText.Interfaces;
using Api.Modules.SpeechToText.Models;
using GeeksCoreLibrary.Core.DependencyInjection.Interfaces;
using Microsoft.Extensions.Configuration;
using NAudio.Wave;
using NAudio.Wave.SampleProviders;
using SherpaOnnx;

namespace Api.Modules.SpeechToText.Services;

/// <summary>
/// Service for converting speech audio to text using a speech recognition model.
/// </summary>
public class SpeechToTextService : ISpeechToTextService, IScopedService
{
    private const int DefaultSampleRate = 16000;
    private const int DefaultFeatureDim = 80;
    private const int DefaultModelIdleTimeoutSeconds = 45;
    private const int MaxDefaultNumThreads = 4;
    private const int OpenAiMaxAudioFileSize = 25 * 1024 * 1024;

    private const int PostProcessingDictionaryInitialCapacity = 50000;
    private const int PostProcessingMaxEditDistance = 2;
    private const int PostProcessingCustomTermFrequency = int.MaxValue;

    private const byte PostProcessingCompactLevel = 10;

    private const float StreamingTailPaddingSeconds = 0.6F;

    private const string DefaultEngine = "Local";
    private const string DefaultLanguage = "nl";
    private const string DefaultProvider = "cpu";
    private const string DefaultDecodingMethod = "greedy_search";
    private const string DefaultOpenAiUrl = "https://api.openai.com/v1/audio/transcriptions";
    private const string DefaultOpenAiModel = "gpt-transcribe";
    private const string DefaultEncoderFileName = "encoder.int8.onnx";
    private const string DefaultDecoderFileName = "decoder.int8.onnx";
    private const string DefaultJoinerFileName = "joiner.int8.onnx";
    private const string DefaultTokensFileName = "tokens.txt";

    // Recognition is intentionally serialized because running multiple model
    // instances simultaneously significantly increases CPU and memory usage.
    private static readonly SemaphoreSlim RecognizerLock = new(1, 1);
    private static readonly HttpClient HttpClient = new();

    // The recognizer is shared between service instances to prevent the configured
    // model from being reloaded for every request.
    private static OnlineRecognizer _recognizer;
    private static SymSpell _postProcessor;
    private static Timer _modelUnloadTimer;
    private static DateTime _lastModelUseUtc;
    private static TimeSpan _modelIdleTimeout = TimeSpan.FromSeconds(DefaultModelIdleTimeoutSeconds);

    private readonly IConfiguration configuration;

    /// <summary>
    /// Initializes the speech-to-text service.
    /// </summary>
    /// <param name="configuration">Application configuration containing the speech recognition settings.</param>
    public SpeechToTextService(IConfiguration configuration)
    {
        this.configuration = configuration;
    }

    /// <inheritdoc />
    public async Task<SpeechToTextResult> GetTextFromSpeechAsync(
        Stream audioStream,
        ClaimsIdentity identity,
        CancellationToken cancellationToken = default)
    {
        try
        {
            byte[] audio = await ReadAudioBytesAsync(audioStream, cancellationToken);
            string engine = GetEngine();

            if (engine.Equals("OpenAI", StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    return await GetTextFromOpenAiAsync(audio, cancellationToken);
                }
                catch (Exception exception) when (
                    exception is not OperationCanceledException &&
                    GetOpenAiFallbackToLocal())
                {
                    return await GetTextFromLocalAsync(audio, cancellationToken);
                }
            }

            if (!engine.Equals("Local", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException(
                    $"Unsupported speech-to-text engine: {engine}"
                );
            }

            return await GetTextFromLocalAsync(audio, cancellationToken);
        }
        catch (OperationCanceledException)
        {
            return new SpeechToTextResult
            {
                Success = false,
                FailReason = "Speech recognition was cancelled."
            };
        }
        catch (Exception exception)
        {
            return new SpeechToTextResult
            {
                Success = false,
                FailReason = exception.Message
            };
        }
    }

    /// <summary>
    /// Converts WAV audio to text using the locally configured speech recognition model.
    /// </summary>
    /// <param name="audioBytes">The WAV audio to transcribe.</param>
    /// <param name="cancellationToken">Token used to cancel recognition.</param>
    /// <returns>The local speech recognition result.</returns>
    private async Task<SpeechToTextResult> GetTextFromLocalAsync(
        byte[] audioBytes,
        CancellationToken cancellationToken)
    {
        await using MemoryStream audioStream = new(audioBytes, writable: false);

        int sampleRate = GetSampleRate();
        AudioData audio = await ReadAudioAsync(audioStream, sampleRate, cancellationToken);

        await RecognizerLock.WaitAsync(cancellationToken);

        try
        {
            _modelIdleTimeout = GetModelIdleTimeout();

            OnlineRecognizer recognizer = GetOrCreateRecognizer();
            string language = GetLanguage();

            // Keep the complete recording in one recognition stream so the
            // configured model can use all available speech context.
            string rawText = DecodeAudio(
                recognizer,
                audio,
                language,
                cancellationToken
            );

            string text = PostProcessText(rawText);

            return new SpeechToTextResult
            {
                Success = true,
                Text = text,
                RawText = rawText
            };
        }
        finally
        {
            if (_recognizer != null)
            {
                _lastModelUseUtc = DateTime.UtcNow;
                ScheduleModelUnload();
            }

            RecognizerLock.Release();
        }
    }

    /// <summary>
    /// Converts WAV audio to text using the configured OpenAI transcription endpoint.
    /// </summary>
    /// <param name="audioBytes">The WAV audio to transcribe.</param>
    /// <param name="cancellationToken">Token used to cancel the request.</param>
    /// <returns>The OpenAI speech recognition result.</returns>
    private async Task<SpeechToTextResult> GetTextFromOpenAiAsync(
        byte[] audioBytes,
        CancellationToken cancellationToken)
    {
        string rawText = await DecodeOpenAiAsync(audioBytes, cancellationToken);

        return new SpeechToTextResult
        {
            Success = true,
            Text = rawText,
            RawText = rawText
        };
    }

    /// <summary>
    /// Sends WAV audio to an OpenAI-compatible transcription endpoint.
    /// </summary>
    /// <param name="audioBytes">The WAV audio to transcribe.</param>
    /// <param name="cancellationToken">Token used to cancel the request.</param>
    /// <returns>The transcription returned by the external endpoint.</returns>
    private async Task<string> DecodeOpenAiAsync(
        byte[] audioBytes,
        CancellationToken cancellationToken)
    {
        if (audioBytes.Length > OpenAiMaxAudioFileSize)
        {
            throw new InvalidOperationException(
                "The supplied audio exceeds the 25 MB OpenAI transcription limit."
            );
        }

        string url = GetOpenAiUrl();
        string apiKey = GetOpenAiApiKey();
        string model = GetOpenAiModel();
        string language = GetLanguage();

        using HttpRequestMessage request = new(HttpMethod.Post, url);

        request.Headers.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            apiKey
        );

        request.Headers.Accept.Add(
            new MediaTypeWithQualityHeaderValue("application/json")
        );

        using MultipartFormDataContent content = new();
        using ByteArrayContent audioContent = new(audioBytes);

        audioContent.Headers.ContentType = new MediaTypeHeaderValue("audio/wav");

        content.Add(
            audioContent,
            "file",
            "speech.wav"
        );

        content.Add(
            new StringContent(model),
            "model"
        );

        content.Add(
            new StringContent("json"),
            "response_format"
        );

        if (!string.IsNullOrWhiteSpace(language))
        {
            content.Add(
                new StringContent(language),
                "languages[]"
            );
        }

        string prompt = GetOpenAiPrompt();

        if (!string.IsNullOrWhiteSpace(prompt))
        {
            content.Add(
                new StringContent(prompt),
                "prompt"
            );
        }

        string customTerms = configuration["Api:SpeechToText:PostProcessingCustomTerms"];

        if (!string.IsNullOrWhiteSpace(customTerms))
        {
            foreach (string customTerm in customTerms.Split(
                         ',',
                         StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                content.Add(
                    new StringContent(customTerm),
                    "keywords[]"
                );
            }
        }

        request.Content = content;

        using HttpResponseMessage response = await HttpClient.SendAsync(
            request,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken
        );

        string responseText = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"OpenAI speech transcription failed ({(int)response.StatusCode}): {responseText}"
            );
        }

        using JsonDocument responseJson = JsonDocument.Parse(responseText);

        if (!responseJson.RootElement.TryGetProperty("text", out JsonElement textElement) ||
            textElement.ValueKind != JsonValueKind.String)
        {
            throw new InvalidOperationException(
                "OpenAI speech transcription returned no text."
            );
        }

        return textElement.GetString() ?? string.Empty;
    }

    /// <summary>
    /// Decodes normalized mono PCM samples using the configured streaming recognizer.
    /// </summary>
    /// <param name="recognizer">The speech recognizer.</param>
    /// <param name="audio">The normalized audio supplied to the recognizer.</param>
    /// <param name="language">The language hint supplied to models that support it.</param>
    /// <param name="cancellationToken">Token used to cancel recognition.</param>
    /// <returns>The recognized text.</returns>
    private static string DecodeAudio(
        OnlineRecognizer recognizer,
        AudioData audio,
        string language,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        using OnlineStream stream = recognizer.CreateStream();

        if (!string.IsNullOrWhiteSpace(language))
            stream.SetOption("language", language);

        stream.AcceptWaveform(audio.SampleRate, audio.Samples);

        // Give streaming models a short trailing silence so the final spoken
        // tokens can be completed before the input stream is closed.
        float[] tailPadding = new float[(int)(audio.SampleRate * StreamingTailPaddingSeconds)];
        stream.AcceptWaveform(audio.SampleRate, tailPadding);

        stream.InputFinished();

        while (recognizer.IsReady(stream))
        {
            cancellationToken.ThrowIfCancellationRequested();

            recognizer.Decode(stream);
        }

        cancellationToken.ThrowIfCancellationRequested();

        OnlineRecognizerResult result = recognizer.GetResult(stream);

        return result.Text ?? string.Empty;
    }

    /// <summary>
    /// Corrects likely Dutch speech recognition errors using a lightweight frequency dictionary.
    /// Valid words are left unchanged to avoid altering correctly recognized speech.
    /// </summary>
    /// <param name="text">The text returned by the speech recognizer.</param>
    /// <returns>The corrected transcription.</returns>
    private string PostProcessText(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return text;

        SymSpell postProcessor = GetOrCreatePostProcessor();

        int wordCount = 0;
        int correctionCount = 0;

        string correctedText = Regex.Replace(
            text,
            @"[\p{L}][\p{L}'’\-]*",
            match =>
            {
                wordCount++;

                string correctedWord = CorrectWord(
                    postProcessor,
                    match.Value
                );

                if (!string.Equals(
                        correctedWord,
                        match.Value,
                        StringComparison.Ordinal))
                {
                    correctionCount++;
                }

                return correctedWord;
            }
        );

        if (correctionCount == 0)
            return text;

        double correctionRatio =
            (double)correctionCount / wordCount;

        // If the dictionary wants to rewrite a significant portion of what the
        // recognizer heard, trust the recognizer instead.
        if (correctionCount >= 3 &&
            correctionRatio > 0.15)
        {
            return text;
        }

        return correctedText;
    }

    /// <summary>
    /// Corrects a single word when it is not present in the Dutch frequency dictionary.
    /// </summary>
    /// <param name="postProcessor">The initialized spelling corrector.</param>
    /// <param name="word">The recognized word.</param>
    /// <returns>The original word or its most likely correction.</returns>
    private static string CorrectWord(SymSpell postProcessor, string word)
    {
        if (word.Length <= 2)
            return word;

        // Proper names, locations and domain terminology are more dangerous to
        // automatically correct than they are useful to correct.
        if (char.IsUpper(word[0]))
            return word;

        string normalizedWord = word.ToLowerInvariant();

        List<SymSpell.SuggestItem> suggestions = postProcessor.Lookup(
            normalizedWord,
            SymSpell.Verbosity.Top,
            PostProcessingMaxEditDistance
        );

        if (suggestions.Count == 0)
            return word;

        SymSpell.SuggestItem suggestion = suggestions[0];

        // The word already exists in the dictionary.
        if (suggestion.distance == 0)
            return word;

        // Only allow one-character corrections when the replacement is a
        // reasonably common Dutch word.
        if (suggestion.distance == 1)
        {
            if (suggestion.count < 20000)
                return word;

            return PreserveWordCasing(word, suggestion.term);
        }

        // Two-character corrections are only accepted for short words when the
        // replacement is extremely common. This catches obvious errors such as
        // "bitje" -> "beetje" without aggressively rewriting longer words.
        if (suggestion.distance == 2 &&
            word.Length <= 6 &&
            suggestion.count >= 50000)
        {
            return PreserveWordCasing(word, suggestion.term);
        }

        return word;
    }

    /// <summary>
    /// Preserves the casing style of a recognized word after correction.
    /// </summary>
    /// <param name="originalWord">The word returned by the speech recognizer.</param>
    /// <param name="correctedWord">The corrected lower-case dictionary term.</param>
    /// <returns>The corrected word using the original casing style.</returns>
    private static string PreserveWordCasing(string originalWord, string correctedWord)
    {
        if (string.Equals(
                originalWord,
                originalWord.ToUpperInvariant(),
                StringComparison.Ordinal))
        {
            return correctedWord.ToUpperInvariant();
        }

        if (char.IsUpper(originalWord[0]))
        {
            return char.ToUpperInvariant(correctedWord[0]) +
                   correctedWord.Substring(1);
        }

        return correctedWord;
    }

    /// <summary>
    /// Gets the shared Dutch transcription post-processor or loads its frequency dictionary when required.
    /// </summary>
    /// <returns>The initialized spelling corrector.</returns>
    private SymSpell GetOrCreatePostProcessor()
    {
        if (_postProcessor != null)
            return _postProcessor;

        string dictionaryPath = GetPostProcessingDictionaryPath();

        ValidatePostProcessingDictionaryFile(dictionaryPath);

        SymSpell postProcessor = new(
            PostProcessingDictionaryInitialCapacity,
            PostProcessingMaxEditDistance,
            compactLevel: PostProcessingCompactLevel
        );

        if (!postProcessor.LoadDictionary(dictionaryPath, 0, 1))
        {
            throw new InvalidOperationException(
                $"Speech-to-text post-processing dictionary could not be loaded: {dictionaryPath}"
            );
        }

        string customTerms = configuration["Api:SpeechToText:PostProcessingCustomTerms"];

        if (!string.IsNullOrWhiteSpace(customTerms))
        {
            foreach (string customTerm in customTerms.Split(
                         ',',
                         StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                postProcessor.CreateDictionaryEntry(
                    customTerm.ToLowerInvariant(),
                    PostProcessingCustomTermFrequency
                );
            }
        }

        _postProcessor = postProcessor;

        return _postProcessor;
    }

    /// <summary>
    /// Gets the shared speech recognizer or loads the configured model when required.
    /// </summary>
    /// <returns>The initialized recognizer.</returns>
    private OnlineRecognizer GetOrCreateRecognizer()
    {
        if (_recognizer != null)
            return _recognizer;

        string modelPath = GetModelPath();
        string encoderPath = Path.Combine(
            modelPath,
            GetModelFileName("EncoderFileName", DefaultEncoderFileName)
        );
        string decoderPath = Path.Combine(
            modelPath,
            GetModelFileName("DecoderFileName", DefaultDecoderFileName)
        );
        string joinerPath = Path.Combine(
            modelPath,
            GetModelFileName("JoinerFileName", DefaultJoinerFileName)
        );
        string tokensPath = Path.Combine(
            modelPath,
            GetModelFileName("TokensFileName", DefaultTokensFileName)
        );

        ValidateModelFile(encoderPath);
        ValidateModelFile(decoderPath);
        ValidateModelFile(joinerPath);
        ValidateModelFile(tokensPath);

        OnlineRecognizerConfig recognizerConfig = new();

        recognizerConfig.FeatConfig.SampleRate = GetSampleRate();
        recognizerConfig.FeatConfig.FeatureDim = GetFeatureDim();

        recognizerConfig.ModelConfig.Transducer.Encoder = encoderPath;
        recognizerConfig.ModelConfig.Transducer.Decoder = decoderPath;
        recognizerConfig.ModelConfig.Transducer.Joiner = joinerPath;
        recognizerConfig.ModelConfig.Tokens = tokensPath;
        recognizerConfig.ModelConfig.Provider = GetProvider();
        recognizerConfig.ModelConfig.NumThreads = GetNumThreads();
        recognizerConfig.ModelConfig.Debug = 0;

        recognizerConfig.DecodingMethod = GetDecodingMethod();
        recognizerConfig.EnableEndpoint = 0;
        recognizerConfig.BlankPenalty = 0.1F;

        _recognizer = new OnlineRecognizer(recognizerConfig);
        _lastModelUseUtc = DateTime.UtcNow;

        return _recognizer;
    }

    /// <summary>
    /// Schedules loaded speech recognition resources to be unloaded after the configured idle timeout.
    /// </summary>
    private static void ScheduleModelUnload()
    {
        if (_recognizer == null && _postProcessor == null)
            return;

        if (_modelUnloadTimer == null)
        {
            _modelUnloadTimer = new Timer(
                TryUnloadModels,
                null,
                _modelIdleTimeout,
                Timeout.InfiniteTimeSpan
            );

            return;
        }

        _modelUnloadTimer.Change(
            _modelIdleTimeout,
            Timeout.InfiniteTimeSpan
        );
    }

    /// <summary>
    /// Unloads speech recognition resources when they have not been used for the configured period.
    /// </summary>
    /// <param name="state">Unused timer state.</param>
    private static void TryUnloadModels(object state)
    {
        // Never dispose native model resources while a transcription is active.
        if (!RecognizerLock.Wait(0))
        {
            _modelUnloadTimer?.Change(
                TimeSpan.FromSeconds(5),
                Timeout.InfiniteTimeSpan
            );

            return;
        }

        try
        {
            if (_recognizer == null && _postProcessor == null)
                return;

            TimeSpan idleDuration = DateTime.UtcNow - _lastModelUseUtc;

            // Another request may have used the model since the timer was created.
            // In that case, schedule the timer again for the remaining idle period.
            if (idleDuration < _modelIdleTimeout)
            {
                _modelUnloadTimer?.Change(
                    _modelIdleTimeout - idleDuration,
                    Timeout.InfiniteTimeSpan
                );

                return;
            }

            _recognizer?.Dispose();
            _recognizer = null;

            // The post-processing dictionary is only used by speech-to-text, so
            // release it together with the recognizer when the feature is idle.
            _postProcessor = null;

            _modelUnloadTimer?.Change(
                Timeout.InfiniteTimeSpan,
                Timeout.InfiniteTimeSpan
            );
        }
        finally
        {
            RecognizerLock.Release();
        }
    }

    /// <summary>
    /// Gets the speech recognition engine used for transcription.
    /// </summary>
    /// <returns>The configured engine or the local engine by default.</returns>
    private string GetEngine()
    {
        string value = configuration["Api:SpeechToText:Engine"];

        return string.IsNullOrWhiteSpace(value) ? DefaultEngine : value;
    }

    /// <summary>
    /// Gets the OpenAI-compatible transcription endpoint.
    /// </summary>
    /// <returns>The configured endpoint or the default OpenAI endpoint.</returns>
    private string GetOpenAiUrl()
    {
        string value = configuration["Api:SpeechToText:OpenAI:Url"];

        return string.IsNullOrWhiteSpace(value) ? DefaultOpenAiUrl : value;
    }

    /// <summary>
    /// Gets the API key used by the OpenAI transcription endpoint.
    /// </summary>
    /// <returns>The configured API key.</returns>
    /// <exception cref="InvalidOperationException">Thrown when no API key is configured.</exception>
    private string GetOpenAiApiKey()
    {
        string value = configuration["Api:SpeechToText:OpenAI:ApiKey"];

        if (string.IsNullOrWhiteSpace(value))
            value = Environment.GetEnvironmentVariable("OPENAI_API_KEY");

        if (string.IsNullOrWhiteSpace(value))
        {
            throw new InvalidOperationException(
                "Api:SpeechToText:OpenAI:ApiKey must be configured when the OpenAI engine is used."
            );
        }

        return value;
    }

    /// <summary>
    /// Gets the model used by the OpenAI transcription endpoint.
    /// </summary>
    /// <returns>The configured model or the default transcription model.</returns>
    private string GetOpenAiModel()
    {
        string value = configuration["Api:SpeechToText:OpenAI:Model"];

        return string.IsNullOrWhiteSpace(value) ? DefaultOpenAiModel : value;
    }

    /// <summary>
    /// Gets optional context supplied to the OpenAI transcription model.
    /// </summary>
    /// <returns>The configured transcription prompt.</returns>
    private string GetOpenAiPrompt()
    {
        return configuration["Api:SpeechToText:OpenAI:Prompt"];
    }

    /// <summary>
    /// Determines whether local speech recognition is used when the OpenAI request fails.
    /// </summary>
    /// <returns><see langword="true"/> when local fallback is enabled.</returns>
    private bool GetOpenAiFallbackToLocal()
    {
        string value = configuration["Api:SpeechToText:OpenAI:FallbackToLocal"];

        return bool.TryParse(value, out bool fallbackToLocal) && fallbackToLocal;
    }

    /// <summary>
    /// Gets the externally configured directory containing the speech recognition model files.
    /// </summary>
    /// <returns>The absolute model directory path.</returns>
    /// <exception cref="InvalidOperationException">
    /// Thrown when the model path is missing or is not an absolute path.
    /// </exception>
    private string GetModelPath()
    {
        string configuredPath = configuration["Api:SpeechToText:ModelPath"];

        if (string.IsNullOrWhiteSpace(configuredPath))
        {
            throw new InvalidOperationException(
                "Api:SpeechToText:ModelPath must be configured."
            );
        }

        if (!Path.IsPathRooted(configuredPath))
        {
            throw new InvalidOperationException(
                $"Api:SpeechToText:ModelPath must be an absolute path. Received: {configuredPath}"
            );
        }

        return configuredPath;
    }

    /// <summary>
    /// Gets the externally configured Dutch frequency dictionary used for transcription post-processing.
    /// </summary>
    /// <returns>The absolute dictionary file path.</returns>
    /// <exception cref="InvalidOperationException">
    /// Thrown when the dictionary path is missing or is not an absolute path.
    /// </exception>
    private string GetPostProcessingDictionaryPath()
    {
        string configuredPath = configuration["Api:SpeechToText:PostProcessingDictionaryPath"];

        if (string.IsNullOrWhiteSpace(configuredPath))
        {
            throw new InvalidOperationException(
                "Api:SpeechToText:PostProcessingDictionaryPath must be configured."
            );
        }

        if (!Path.IsPathRooted(configuredPath))
        {
            throw new InvalidOperationException(
                $"Api:SpeechToText:PostProcessingDictionaryPath must be an absolute path. Received: {configuredPath}"
            );
        }

        return configuredPath;
    }

    /// <summary>
    /// Gets a configured model file name or falls back to the supplied default.
    /// </summary>
    /// <param name="settingName">The speech-to-text setting containing the model file name.</param>
    /// <param name="defaultFileName">The file name used when no value is configured.</param>
    /// <returns>The configured or default model file name.</returns>
    private string GetModelFileName(string settingName, string defaultFileName)
    {
        string value = configuration[$"Api:SpeechToText:{settingName}"];

        return string.IsNullOrWhiteSpace(value) ? defaultFileName : value;
    }

    /// <summary>
    /// Gets the language hint supplied to recognition models that support language selection.
    /// </summary>
    /// <returns>The configured language or the default language.</returns>
    private string GetLanguage()
    {
        string value = configuration["Api:SpeechToText:Language"];

        return string.IsNullOrWhiteSpace(value) ? DefaultLanguage : value;
    }

    /// <summary>
    /// Gets the ONNX Runtime execution provider used by the speech recognition model.
    /// </summary>
    /// <returns>The configured execution provider.</returns>
    private string GetProvider()
    {
        string value = configuration["Api:SpeechToText:Provider"];

        return string.IsNullOrWhiteSpace(value) ? DefaultProvider : value;
    }

    /// <summary>
    /// Gets the decoding method used by the configured speech recognition model.
    /// </summary>
    /// <returns>The configured decoding method.</returns>
    private string GetDecodingMethod()
    {
        string value = configuration["Api:SpeechToText:DecodingMethod"];

        return string.IsNullOrWhiteSpace(value) ? DefaultDecodingMethod : value;
    }

    /// <summary>
    /// Gets the sample rate expected by the configured speech recognition model.
    /// </summary>
    /// <returns>The configured sample rate.</returns>
    private int GetSampleRate()
    {
        string value = configuration["Api:SpeechToText:SampleRate"];

        if (int.TryParse(value, out int sampleRate) && sampleRate >= 1)
            return sampleRate;

        return DefaultSampleRate;
    }

    /// <summary>
    /// Gets the feature dimension expected by the configured speech recognition model.
    /// </summary>
    /// <returns>The configured feature dimension.</returns>
    private int GetFeatureDim()
    {
        string value = configuration["Api:SpeechToText:FeatureDim"];

        if (int.TryParse(value, out int featureDim) && featureDim >= 1)
            return featureDim;

        return DefaultFeatureDim;
    }

    /// <summary>
    /// Gets the amount of time the loaded models may remain unused before being unloaded.
    /// </summary>
    /// <returns>The configured model idle timeout.</returns>
    private TimeSpan GetModelIdleTimeout()
    {
        string value = configuration["Api:SpeechToText:ModelIdleTimeoutSeconds"];

        if (int.TryParse(value, out int seconds) && seconds >= 1)
            return TimeSpan.FromSeconds(seconds);

        return TimeSpan.FromSeconds(DefaultModelIdleTimeoutSeconds);
    }

    /// <summary>
    /// Gets the number of computation threads available to the recognizer.
    /// </summary>
    /// <returns>The configured number of recognition threads.</returns>
    private int GetNumThreads()
    {
        string value = configuration["Api:SpeechToText:NumThreads"];

        if (int.TryParse(value, out int numThreads) && numThreads >= 1)
            return numThreads;

        return Math.Max(1, Math.Min(Environment.ProcessorCount, MaxDefaultNumThreads));
    }

    /// <summary>
    /// Verifies that a required speech recognition model file exists.
    /// </summary>
    /// <param name="filePath">The path of the model file.</param>
    /// <exception cref="FileNotFoundException">Thrown when the model file cannot be found.</exception>
    private static void ValidateModelFile(string filePath)
    {
        if (File.Exists(filePath))
            return;

        throw new FileNotFoundException(
            $"Speech recognition model file was not found: {filePath}",
            filePath
        );
    }

    /// <summary>
    /// Verifies that the Dutch frequency dictionary required for transcription post-processing exists.
    /// </summary>
    /// <param name="filePath">The path of the frequency dictionary.</param>
    /// <exception cref="FileNotFoundException">Thrown when the dictionary file cannot be found.</exception>
    private static void ValidatePostProcessingDictionaryFile(string filePath)
    {
        if (File.Exists(filePath))
            return;

        throw new FileNotFoundException(
            $"Speech-to-text post-processing dictionary was not found: {filePath}",
            filePath
        );
    }

    /// <summary>
    /// Reads and validates the supplied WAV stream so it can be used by either recognition engine.
    /// </summary>
    /// <param name="audioStream">The WAV audio stream to read.</param>
    /// <param name="cancellationToken">Token used to cancel audio processing.</param>
    /// <returns>The validated WAV file bytes.</returns>
    private static async Task<byte[]> ReadAudioBytesAsync(
        Stream audioStream,
        CancellationToken cancellationToken)
    {
        if (audioStream.CanSeek)
            audioStream.Position = 0;

        await using MemoryStream inputBuffer = new();

        await audioStream.CopyToAsync(inputBuffer, cancellationToken);

        switch (inputBuffer.Length)
        {
            case < 12:
                throw new InvalidOperationException(
                    $"The supplied audio is too small. Received {inputBuffer.Length} bytes."
                );
            case > int.MaxValue:
                throw new InvalidOperationException("The supplied audio file is too large.");
        }

        byte[] audioBytes = inputBuffer.ToArray();

        if (!IsWaveFile(audioBytes, audioBytes.Length))
        {
            throw new InvalidOperationException(
                $"Unsupported audio format. Expected WAV, but received: {GetAudioFormat(audioBytes, audioBytes.Length)}."
            );
        }

        RepairWaveHeader(audioBytes, audioBytes.Length);

        return audioBytes;
    }

    /// <summary>
    /// Reads a WAV stream, converts it to mono floating-point PCM at the configured
    /// sample rate and returns the normalized audio required by the speech recognizer.
    /// </summary>
    /// <param name="audioStream">The WAV audio stream to read.</param>
    /// <param name="targetSampleRate">The sample rate required by the configured recognizer.</param>
    /// <param name="cancellationToken">Token used to cancel audio processing.</param>
    /// <returns>The normalized audio samples and metadata.</returns>
    private static async Task<AudioData> ReadAudioAsync(
        Stream audioStream,
        int targetSampleRate,
        CancellationToken cancellationToken)
    {
        if (audioStream.CanSeek)
            audioStream.Position = 0;

        await using MemoryStream inputBuffer = new();

        await audioStream.CopyToAsync(inputBuffer, cancellationToken);

        switch (inputBuffer.Length)
        {
            case < 12:
                throw new InvalidOperationException(
                    $"The supplied audio is too small. Received {inputBuffer.Length} bytes."
                );
            case > int.MaxValue:
                throw new InvalidOperationException("The supplied audio file is too large.");
        }

        int audioLength = (int)inputBuffer.Length;
        byte[] audioBytes = inputBuffer.GetBuffer();

        if (!IsWaveFile(audioBytes, audioLength))
        {
            throw new InvalidOperationException(
                $"Unsupported audio format. Expected WAV, but received: {GetAudioFormat(audioBytes, audioLength)}."
            );
        }

        RepairWaveHeader(audioBytes, audioLength);

        inputBuffer.Position = 0;

        await using WaveFileReader reader = new(inputBuffer);

        if (reader.TotalTime < TimeSpan.FromMilliseconds(250))
            throw new InvalidOperationException("The supplied audio recording is too short.");

        ISampleProvider sampleProvider = reader.ToSampleProvider();

        // Speech recognition uses mono audio. Stereo channels are mixed equally.
        if (sampleProvider.WaveFormat.Channels == 2)
        {
            sampleProvider = new StereoToMonoSampleProvider(sampleProvider)
            {
                LeftVolume = 0.5F,
                RightVolume = 0.5F
            };
        }
        else if (sampleProvider.WaveFormat.Channels != 1)
        {
            throw new InvalidOperationException(
                $"Unsupported channel count: {sampleProvider.WaveFormat.Channels}."
            );
        }

        // Normalize all recordings before inference so Sherpa does not have to
        // perform sample-rate conversion internally.
        if (sampleProvider.WaveFormat.SampleRate != targetSampleRate)
            sampleProvider = new WdlResamplingSampleProvider(sampleProvider, targetSampleRate);

        int estimatedSampleCount = Math.Max(
            4000,
            (int)Math.Ceiling(reader.TotalTime.TotalSeconds * targetSampleRate)
        );

        // Preallocate based on the recording duration to avoid repeated growth
        // and copying for normal WAV recordings.
        float[] samples = new float[estimatedSampleCount];
        float[] buffer = new float[8192];
        int sampleCount = 0;

        while (true)
        {
            cancellationToken.ThrowIfCancellationRequested();

            int samplesRead = sampleProvider.Read(buffer, 0, buffer.Length);

            if (samplesRead == 0)
                break;

            int requiredSize = sampleCount + samplesRead;

            // The exact number of resampled samples can differ slightly from the
            // estimate, so only grow the array when actually required.
            if (requiredSize > samples.Length)
            {
                Array.Resize(
                    ref samples,
                    Math.Max(requiredSize, samples.Length * 2)
                );
            }

            Array.Copy(buffer, 0, samples, sampleCount, samplesRead);

            sampleCount += samplesRead;
        }

        if (sampleCount == 0)
            throw new InvalidOperationException("No audio samples could be read from the supplied audio.");

        // Avoid retaining unused capacity after resampling.
        if (sampleCount != samples.Length)
            Array.Resize(ref samples, sampleCount);

        return new AudioData
        {
            Samples = samples,
            SampleRate = targetSampleRate
        };
    }

    /// <summary>
    /// Determines whether the supplied bytes contain a RIFF/WAVE audio file.
    /// </summary>
    /// <param name="data">The audio file bytes.</param>
    /// <param name="length">The number of valid bytes in the buffer.</param>
    /// <returns><see langword="true"/> when the data represents a WAV file.</returns>
    private static bool IsWaveFile(byte[] data, int length)
    {
        return
            length >= 12 &&
            data[0] == 'R' &&
            data[1] == 'I' &&
            data[2] == 'F' &&
            data[3] == 'F' &&
            data[8] == 'W' &&
            data[9] == 'A' &&
            data[10] == 'V' &&
            data[11] == 'E';
    }

    /// <summary>
    /// Attempts to identify common audio formats from their file signature.
    /// </summary>
    /// <param name="data">The audio file bytes.</param>
    /// <param name="length">The number of valid bytes in the buffer.</param>
    /// <returns>The detected audio format or a hexadecimal representation of the header.</returns>
    private static string GetAudioFormat(byte[] data, int length)
    {
        if (length < 4) return $"Unknown ({Convert.ToHexString(data.AsSpan(0, Math.Min(12, length)))})";

        if (data[0] == 0x1A &&
            data[1] == 0x45 &&
            data[2] == 0xDF &&
            data[3] == 0xA3)
        {
            return "WebM/Matroska";
        }

        if (data[0] == 'O' &&
            data[1] == 'g' &&
            data[2] == 'g' &&
            data[3] == 'S')
        {
            return "OGG";
        }

        if (data[0] == 'I' &&
            data[1] == 'D' &&
            data[2] == '3')
        {
            return "MP3";
        }

        return IsWaveFile(data, length) ? 
            "WAV" : $"Unknown ({Convert.ToHexString(data.AsSpan(0, Math.Min(12, length)))})";
    }

    /// <summary>
    /// Repairs invalid RIFF and data chunk lengths commonly found in streamed
    /// or incompletely finalized WAV recordings.
    /// </summary>
    /// <param name="data">The WAV file bytes.</param>
    /// <param name="length">The actual number of bytes in the WAV file.</param>
    private static void RepairWaveHeader(byte[] data, int length)
    {
        if (!IsWaveFile(data, length))
            return;

        // The RIFF size describes the complete file excluding the first 8 bytes.
        BitConverter.GetBytes(length - 8).CopyTo(data, 4);

        int offset = 12;

        while (offset + 8 <= length)
        {
            string chunkId = Encoding.ASCII.GetString(data, offset, 4);
            int chunkSize = BitConverter.ToInt32(data, offset + 4);
            int chunkDataOffset = offset + 8;

            if (chunkId == "data")
            {
                int actualDataSize = length - chunkDataOffset;

                // Only replace the declared data size when it is clearly invalid.
                if (chunkSize < 0 || chunkSize > actualDataSize || chunkSize == 0)
                    BitConverter.GetBytes(actualDataSize).CopyTo(data, offset + 4);

                return;
            }

            if (chunkSize < 0)
                return;

            // RIFF chunks are word-aligned, so odd-sized chunks contain one
            // additional padding byte.
            long nextOffset = (long)chunkDataOffset + chunkSize + (chunkSize % 2);

            if (nextOffset > length)
                return;

            offset = (int)nextOffset;
        }
    }

    /// <summary>
    /// Contains normalized audio samples and their associated metadata.
    /// </summary>
    private sealed class AudioData
    {
        /// <summary>
        /// Gets the normalized mono PCM samples.
        /// </summary>
        public float[] Samples { get; init; }

        /// <summary>
        /// Gets the audio sample rate.
        /// </summary>
        public int SampleRate { get; init; }
    }
}
