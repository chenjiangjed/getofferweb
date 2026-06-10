import { Mic, Square, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type AudioRecorderProps = {
  recording: boolean;
  onStart: () => void;
  onStop: (blob: Blob, durationSeconds: number) => void;
};

const preferredMimeTypes = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus"
];

function recorderOptions() {
  const mimeType = preferredMimeTypes.find((type) => MediaRecorder.isTypeSupported(type));
  return mimeType ? { mimeType } : undefined;
}

export function AudioRecorder({ recording, onStart, onStop }: AudioRecorderProps) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!recording && recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }, [recording]);

  async function start() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, recorderOptions());
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const rawBlob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const duration = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        stream.getTracks().forEach((track) => track.stop());
        onStop(rawBlob, duration);
      };
      recorderRef.current = recorder;
      recorder.start();
      onStart();
    } catch {
      setError("无法访问麦克风，请检查浏览器权限。");
    }
  }

  function stop() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {recording ? (
        <button
          onClick={stop}
          className="grid h-20 w-20 place-items-center rounded-full bg-coral text-white shadow-soft sm:h-24 sm:w-24"
          title="停止录音"
        >
          <Square size={30} />
        </button>
      ) : (
        <button
          onClick={start}
          className="grid h-20 w-20 place-items-center rounded-full bg-ink text-white shadow-soft sm:h-24 sm:w-24"
          title="开始录音"
        >
          <Mic size={32} />
        </button>
      )}
      <div className="inline-flex items-center gap-2 text-sm text-muted">
        <Upload size={15} />
        录音停止后自动上传，由后端转码并转写
      </div>
      {error && <p className="max-w-sm text-center text-sm text-coral">{error}</p>}
    </div>
  );
}
