using System;
using System.IO;
using System.Security.Claims;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Api.Modules.SpeechToText.Interfaces;
using Api.Modules.SpeechToText.Models;
using GeeksCoreLibrary.Core.DependencyInjection.Interfaces;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using NAudio.Wave;
using NAudio.Wave.SampleProviders;
using SherpaOnnx;

namespace Api.Modules.SpeechToText.Services;

/// <summary>
/// Service for converting speech audio to text using the Parakeet speech recognition model.
/// </summary>
public class SpeechToTextService : ISpeechToTextService, IScopedService
{
    private const int TargetSampleRate = 16000;
    private const int VadWindowSize = 512;
    private const int DefaultDirectDecodeMaxDurationSeconds = 12;
    private const int DefaultModelIdleTimeoutSeconds = 45;
    private const int DefaultNumThreads = 1;

    private const float DefaultVadThreshold = 0.3F;
    private const float DefaultVadMinSilenceDuration = 0.5F;
    private const float DefaultVadMinSpeechDuration = 0.25F;
    private const float DefaultVadMaxSpeechDuration = 20.0F;

    // Recognition is intentionally serialized because running multiple Parakeet
    // instances simultaneously significantly increases CPU and memory usage.
    private static readonly SemaphoreSlim RecognizerLock = new(1, 1);

    // The models are shared between service instances to prevent them from
    // being reloaded for every request.
    private static OfflineRecognizer _recognizer;
    private static VoiceActivityDetector _vad;
    private static Timer _modelUnloadTimer;
    private static DateTime _lastModelUseUtc;
    private static TimeSpan _modelIdleTimeout = TimeSpan.FromSeconds(DefaultModelIdleTimeoutSeconds);

    private readonly IConfiguration configuration;
    private readonly IWebHostEnvironment webHostEnvironment;

    /// <summary>
    /// Initializes the speech-to-text service.
    /// </summary>
    /// <param name="configuration">Application configuration containing the speech recognition settings.</param>
    /// <param name="webHostEnvironment">The current web hosting environment.</param>
    public SpeechToTextService(IConfiguration configuration, IWebHostEnvironment webHostEnvironment)
    {
        this.configuration = configuration;
        this.webHostEnvironment = webHostEnvironment;
    }

    /// <inheritdoc />
    public async Task<SpeechToTextResult> GetTextFromSpeechAsync(
        Stream audioStream,
        ClaimsIdentity identity,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var audio = await ReadAudioAsync(audioStream, cancellationToken);

            await RecognizerLock.WaitAsync(cancellationToken);

            try
            {
                _modelIdleTimeout = GetModelIdleTimeout();

                var recognizer = GetOrCreateRecognizer();
                var directDecodeMaxDuration = GetDirectDecodeMaxDuration();

                // Short recordings are decoded directly to preserve as much context
                // as possible. Longer recordings are split on natural speech pauses
                // by the voice activity detector to limit peak memory usage.
                var text = audio.Duration.TotalSeconds <= directDecodeMaxDuration
                    ? DecodeSegment(recognizer, audio.Samples, cancellationToken)
                    : DecodeWithVad(recognizer, audio, cancellationToken);

                return new SpeechToTextResult
                {
                    Success = true,
                    Text = text
                };
            }
            finally
            {
                if (_recognizer != null || _vad != null)
                {
                    _lastModelUseUtc = DateTime.UtcNow;
                    ScheduleModelUnload();
                }

                RecognizerLock.Release();
            }
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
    /// Splits longer audio into speech segments using Silero VAD and decodes each
    /// detected segment separately to reduce peak memory usage.
    /// </summary>
    /// <param name="recognizer">The Parakeet speech recognizer.</param>
    /// <param name="audio">The normalized audio data.</param>
    /// <param name="cancellationToken">Token used to cancel recognition.</param>
    /// <returns>The combined transcription of all detected speech segments.</returns>
    private string DecodeWithVad(
        OfflineRecognizer recognizer,
        AudioData audio,
        CancellationToken cancellationToken)
    {
        var vad = GetOrCreateVad();
        var result = new StringBuilder();
        var window = new float[VadWindowSize];

        // The detector is reused between requests, so clear any state left by
        // a previous recording before accepting new samples.
        vad.Reset();

        try
        {
            var offset = 0;

            while (offset + VadWindowSize <= audio.Samples.Length)
            {
                cancellationToken.ThrowIfCancellationRequested();

                Array.Copy(audio.Samples, offset, window, 0, VadWindowSize);
                vad.AcceptWaveform(window);

                // Decode finished segments immediately instead of allowing them
                // to accumulate in the VAD's internal buffer.
                DecodeAvailableSegments(vad, recognizer, result, cancellationToken);

                offset += VadWindowSize;
            }

            if (offset < audio.Samples.Length)
            {
                Array.Clear(window, 0, VadWindowSize);
                Array.Copy(audio.Samples, offset, window, 0, audio.Samples.Length - offset);

                vad.AcceptWaveform(window);
            }

            // Flush forces the detector to emit any speech that was still active
            // when the recording ended.
            vad.Flush();

            DecodeAvailableSegments(vad, recognizer, result, cancellationToken);

            return result.ToString();
        }
        finally
        {
            vad.Reset();
        }
    }

    /// <summary>
    /// Decodes all speech segments currently available from the voice activity detector.
    /// </summary>
    /// <param name="vad">The voice activity detector containing detected speech segments.</param>
    /// <param name="recognizer">The Parakeet speech recognizer.</param>
    /// <param name="result">Builder used to combine the transcription results.</param>
    /// <param name="cancellationToken">Token used to cancel recognition.</param>
    private static void DecodeAvailableSegments(
        VoiceActivityDetector vad,
        OfflineRecognizer recognizer,
        StringBuilder result,
        CancellationToken cancellationToken)
    {
        while (!vad.IsEmpty())
        {
            cancellationToken.ThrowIfCancellationRequested();

            var segment = vad.Front();

            // Remove the segment before decoding so its samples can be released
            // by the VAD while Parakeet is processing them.
            vad.Pop();

            if (segment.Samples == null || segment.Samples.Length == 0)
                continue;

            var text = DecodeSegment(recognizer, segment.Samples, cancellationToken);

            if (string.IsNullOrWhiteSpace(text))
                continue;

            if (result.Length > 0)
                result.Append(' ');

            result.Append(text.Trim());
        }
    }

    /// <summary>
    /// Decodes a single block of 16 kHz mono PCM samples using Parakeet.
    /// </summary>
    /// <param name="recognizer">The Parakeet speech recognizer.</param>
    /// <param name="samples">The normalized audio samples.</param>
    /// <param name="cancellationToken">Token used to cancel recognition.</param>
    /// <returns>The recognized text.</returns>
    private static string DecodeSegment(
        OfflineRecognizer recognizer,
        float[] samples,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        using var stream = recognizer.CreateStream();

        stream.AcceptWaveform(TargetSampleRate, samples);

        cancellationToken.ThrowIfCancellationRequested();

        // Sherpa's decoding call itself is synchronous and cannot be interrupted
        // until control returns from the native runtime.
        recognizer.Decode(stream);

        cancellationToken.ThrowIfCancellationRequested();

        return stream.Result.Text ?? string.Empty;
    }

    /// <summary>
    /// Gets the shared Parakeet recognizer or loads it when it is not currently in memory.
    /// </summary>
    /// <returns>The initialized Parakeet recognizer.</returns>
    private OfflineRecognizer GetOrCreateRecognizer()
    {
        if (_recognizer != null)
            return _recognizer;

        var modelPath = GetModelPath();
        var encoderPath = Path.Combine(modelPath, "encoder.int8.onnx");
        var decoderPath = Path.Combine(modelPath, "decoder.int8.onnx");
        var joinerPath = Path.Combine(modelPath, "joiner.int8.onnx");
        var tokensPath = Path.Combine(modelPath, "tokens.txt");

        ValidateModelFile(encoderPath);
        ValidateModelFile(decoderPath);
        ValidateModelFile(joinerPath);
        ValidateModelFile(tokensPath);

        var recognizerConfig = new OfflineRecognizerConfig();

        recognizerConfig.ModelConfig.Transducer.Encoder = encoderPath;
        recognizerConfig.ModelConfig.Transducer.Decoder = decoderPath;
        recognizerConfig.ModelConfig.Transducer.Joiner = joinerPath;
        recognizerConfig.ModelConfig.Tokens = tokensPath;
        recognizerConfig.ModelConfig.ModelType = "nemo_transducer";
        recognizerConfig.ModelConfig.Provider = "cpu";
        recognizerConfig.ModelConfig.NumThreads = GetNumThreads();
        recognizerConfig.ModelConfig.Debug = 0;
        recognizerConfig.DecodingMethod = "greedy_search";

        _recognizer = new OfflineRecognizer(recognizerConfig);
        _lastModelUseUtc = DateTime.UtcNow;

        return _recognizer;
    }

    /// <summary>
    /// Gets the shared Silero voice activity detector or loads it when required.
    /// </summary>
    /// <returns>The initialized voice activity detector.</returns>
    private VoiceActivityDetector GetOrCreateVad()
    {
        if (_vad != null)
            return _vad;

        var vadPath = Path.Combine(GetModelPath(), "silero_vad.onnx");

        ValidateModelFile(vadPath);

        var maxSpeechDuration = GetVadMaxSpeechDuration();

        var vadConfig = new VadModelConfig();

        vadConfig.SileroVad.Model = vadPath;
        vadConfig.SileroVad.Threshold = GetVadThreshold();
        vadConfig.SileroVad.MinSilenceDuration = GetVadMinSilenceDuration();
        vadConfig.SileroVad.MinSpeechDuration = GetVadMinSpeechDuration();
        vadConfig.SileroVad.MaxSpeechDuration = maxSpeechDuration;
        vadConfig.SileroVad.WindowSize = VadWindowSize;

        vadConfig.SampleRate = TargetSampleRate;
        vadConfig.NumThreads = 1;
        vadConfig.Provider = "cpu";
        vadConfig.Debug = 0;

        // Keep enough internal VAD capacity for the largest allowed speech
        // segment without reserving excessive memory.
        var bufferSize = Math.Max(20.0F, maxSpeechDuration + 5.0F);

        _vad = new VoiceActivityDetector(vadConfig, bufferSize);
        _lastModelUseUtc = DateTime.UtcNow;

        return _vad;
    }

    /// <summary>
    /// Schedules the loaded speech recognition models to be unloaded after the configured idle timeout.
    /// </summary>
    private static void ScheduleModelUnload()
    {
        if (_recognizer == null && _vad == null)
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
    /// Unloads the speech recognition models when they have not been used for the configured period.
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
            if (_recognizer == null && _vad == null)
                return;

            var idleDuration = DateTime.UtcNow - _lastModelUseUtc;

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

            _vad?.Dispose();
            _vad = null;

            _recognizer?.Dispose();
            _recognizer = null;

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
    /// Gets the directory containing the Parakeet and Silero model files.
    /// </summary>
    /// <returns>The absolute model directory path.</returns>
    private string GetModelPath()
    {
        var configuredModelPath =
            configuration["Api:SpeechToText:ParakeetModelPath"];

        if (string.IsNullOrWhiteSpace(configuredModelPath))
            return @"C:\Coder\SpeechToText\Models\Parakeet\sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8";
        
        return Path.IsPathRooted(configuredModelPath) ? 
            configuredModelPath : Path.Combine(webHostEnvironment.ContentRootPath, configuredModelPath);
    }

    /// <summary>
    /// Gets the maximum recording duration that is decoded directly without VAD segmentation.
    /// </summary>
    /// <returns>The maximum direct decoding duration in seconds.</returns>
    private int GetDirectDecodeMaxDuration()
    {
        var value = configuration["Api:SpeechToText:ParakeetDirectDecodeMaxDurationSeconds"];

        if (Int32.TryParse(value, out var seconds) && seconds >= 1)
            return seconds;

        return DefaultDirectDecodeMaxDurationSeconds;
    }

    /// <summary>
    /// Gets the amount of time the loaded models may remain unused before being unloaded.
    /// </summary>
    /// <returns>The configured model idle timeout.</returns>
    private TimeSpan GetModelIdleTimeout()
    {
        var value = configuration["Api:SpeechToText:ParakeetModelIdleTimeoutSeconds"];

        if (int.TryParse(value, out var seconds) && seconds >= 1)
            return TimeSpan.FromSeconds(seconds);

        return TimeSpan.FromSeconds(DefaultModelIdleTimeoutSeconds);
    }

    /// <summary>
    /// Gets the number of CPU threads available to the Parakeet recognizer.
    /// </summary>
    /// <returns>The configured number of recognition threads.</returns>
    private int GetNumThreads()
    {
        var value = configuration["Api:SpeechToText:ParakeetNumThreads"];

        if (Int32.TryParse(value, out var numThreads) && numThreads >= 1)
            return numThreads;

        return DefaultNumThreads;
    }

    /// <summary>
    /// Gets the minimum confidence required for Silero to consider audio as speech.
    /// </summary>
    /// <returns>The configured VAD confidence threshold.</returns>
    private float GetVadThreshold()
    {
        var value = configuration["Api:SpeechToText:VadThreshold"];

        if (float.TryParse(
                value,
                System.Globalization.NumberStyles.Float,
                System.Globalization.CultureInfo.InvariantCulture,
                out var threshold)
            && threshold is > 0 and < 1)
        {
            return threshold;
        }

        return DefaultVadThreshold;
    }

    /// <summary>
    /// Gets the duration of silence required for the VAD to end the current speech segment.
    /// </summary>
    /// <returns>The silence duration in seconds.</returns>
    private float GetVadMinSilenceDuration()
    {
        var value = configuration["Api:SpeechToText:VadMinSilenceDuration"];

        if (float.TryParse(
                value,
                System.Globalization.NumberStyles.Float,
                System.Globalization.CultureInfo.InvariantCulture,
                out var duration)
            && duration >= 0)
        {
            return duration;
        }

        return DefaultVadMinSilenceDuration;
    }

    /// <summary>
    /// Gets the minimum duration required for detected audio to be considered speech.
    /// </summary>
    /// <returns>The minimum speech duration in seconds.</returns>
    private float GetVadMinSpeechDuration()
    {
        var value = configuration["Api:SpeechToText:VadMinSpeechDuration"];

        if (float.TryParse(
                value,
                System.Globalization.NumberStyles.Float,
                System.Globalization.CultureInfo.InvariantCulture,
                out var duration)
            && duration >= 0)
        {
            return duration;
        }

        return DefaultVadMinSpeechDuration;
    }

    /// <summary>
    /// Gets the maximum duration of a single VAD speech segment.
    /// </summary>
    /// <returns>The maximum speech segment duration in seconds.</returns>
    private float GetVadMaxSpeechDuration()
    {
        var value = configuration["Api:SpeechToText:VadMaxSpeechDuration"];

        if (Single.TryParse(
                value,
                System.Globalization.NumberStyles.Float,
                System.Globalization.CultureInfo.InvariantCulture,
                out var duration)
            && duration >= 2)
        {
            return duration;
        }

        return DefaultVadMaxSpeechDuration;
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
    /// Reads a WAV stream, converts it to mono 16 kHz floating-point PCM and returns
    /// the normalized samples required by Parakeet and Silero.
    /// </summary>
    /// <param name="audioStream">The WAV audio stream to read.</param>
    /// <param name="cancellationToken">Token used to cancel audio processing.</param>
    /// <returns>The normalized audio samples and metadata.</returns>
    private static async Task<AudioData> ReadAudioAsync(
        Stream audioStream,
        CancellationToken cancellationToken)
    {
        if (audioStream.CanSeek)
            audioStream.Position = 0;

        await using var inputBuffer = new MemoryStream();

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

        var audioLength = (int)inputBuffer.Length;
        var audioBytes = inputBuffer.GetBuffer();

        if (!IsWaveFile(audioBytes, audioLength))
        {
            throw new InvalidOperationException(
                $"Unsupported audio format. Expected WAV, but received: {GetAudioFormat(audioBytes, audioLength)}."
            );
        }

        RepairWaveHeader(audioBytes, audioLength);

        inputBuffer.Position = 0;

        using var reader = new WaveFileReader(inputBuffer);

        if (reader.TotalTime < TimeSpan.FromMilliseconds(250))
            throw new InvalidOperationException("The supplied audio recording is too short.");

        ISampleProvider sampleProvider = reader.ToSampleProvider();

        // Parakeet expects mono audio. Stereo channels are mixed equally.
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
        if (sampleProvider.WaveFormat.SampleRate != TargetSampleRate)
            sampleProvider = new WdlResamplingSampleProvider(sampleProvider, TargetSampleRate);

        var estimatedSampleCount = Math.Max(
            4000,
            (int)Math.Ceiling(reader.TotalTime.TotalSeconds * TargetSampleRate)
        );

        // Preallocate based on the recording duration to avoid repeated growth
        // and copying for normal WAV recordings.
        var samples = new float[estimatedSampleCount];
        var buffer = new float[8192];
        var sampleCount = 0;

        while (true)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var samplesRead = sampleProvider.Read(buffer, 0, buffer.Length);

            if (samplesRead == 0)
                break;

            var requiredSize = sampleCount + samplesRead;

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
            SampleRate = TargetSampleRate,
            Duration = TimeSpan.FromSeconds(sampleCount / (double)TargetSampleRate)
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

        var offset = 12;

        while (offset + 8 <= length)
        {
            var chunkId = Encoding.ASCII.GetString(data, offset, 4);
            var chunkSize = BitConverter.ToInt32(data, offset + 4);
            var chunkDataOffset = offset + 8;

            if (chunkId == "data")
            {
                var actualDataSize = length - chunkDataOffset;

                // Only replace the declared data size when it is clearly invalid.
                if (chunkSize < 0 || chunkSize > actualDataSize || chunkSize == 0)
                    BitConverter.GetBytes(actualDataSize).CopyTo(data, offset + 4);

                return;
            }

            if (chunkSize < 0)
                return;

            // RIFF chunks are word-aligned, so odd-sized chunks contain one
            // additional padding byte.
            var nextOffset = (long)chunkDataOffset + chunkSize + (chunkSize % 2);

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

        /// <summary>
        /// Gets the duration of the normalized audio.
        /// </summary>
        public TimeSpan Duration { get; init; }
    }
}