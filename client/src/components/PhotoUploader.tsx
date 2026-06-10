import { ImagePlus, Loader2 } from "lucide-react";
import { ChangeEvent, useState } from "react";
import { ossApi } from "../services/ossApi";

type PhotoUploaderProps = {
  userId: string;
  onUploaded: (key: string) => void;
};

export function PhotoUploader({ userId, onUploaded }: PhotoUploaderProps) {
  const [preview, setPreview] = useState("");
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setLoading(true);
    setPreview(URL.createObjectURL(file));
    try {
      const token = await ossApi.getPhotoUploadToken(userId, file.name, file.type || "image/jpeg");
      await ossApi.uploadPhoto(token.uploadUrl, file, token.headers);
      setKey(token.photo_oss_key);
      onUploaded(token.photo_oss_key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "证件照上传失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-[18px] border border-line bg-white p-5">
      <h3 className="text-base font-semibold text-ink">证件照上传</h3>
      <label className="mt-4 flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-paper text-center transition hover:bg-slate-50">
        {preview ? (
          <img src={preview} alt="证件照预览" className="h-36 w-28 rounded-xl object-cover" />
        ) : (
          <>
            <ImagePlus size={28} className="text-muted" />
            <span className="mt-2 text-sm text-muted">点击选择 jpg/png 文件</span>
          </>
        )}
        <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleFile} />
      </label>
      {loading && (
        <p className="mt-3 inline-flex items-center gap-2 text-sm text-muted">
          <Loader2 size={15} className="animate-spin" />
          正在请求 /api/oss/photo-upload-token 并上传
        </p>
      )}
      {key && <p className="mt-3 break-all text-xs text-muted">photo_oss_key: {key}</p>}
      {error && <p className="mt-3 text-sm text-coral">{error}</p>}
    </div>
  );
}
