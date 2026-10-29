import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Settings as SettingsIcon,
  ImagePlus,
  Save,
  MessageSquare,
  LogOut,
  LoaderCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { Avatar } from '../components/Avatar';
import { updateUserProfile } from '../lib/store';
import { openTelegramChat, triggerHaptic } from '../lib/telegram';

async function uploadToImgBB(file: File, apiKey: string): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);

  const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
    method: "POST",
    body: formData
  });

  if (!res.ok) throw new Error("Image upload failed");
  const data = await res.json();
  const url = data?.data?.display_url || data?.data?.url;
  if (!url) throw new Error("Image URL missing in response");
  return url;
}

export function Settings() {
  const { user, config, logout } = useAuth();
  const navigate = useNavigate();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [photoUrl, setPhotoUrl] = useState(user?.photoUrl ?? "");
  const [uploading, setUploading] = useState(false);

  if (!user) return null;

  const handlePhotoUpload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    triggerHaptic("light");
    try {
      const url = await uploadToImgBB(file, config.imgbbApiKey);
      setPhotoUrl(url);
      toast.success("প্রোফাইল ছবি আপলোড হয়েছে!");
    } catch {
      toast.error("ছবি আপলোড ব্যর্থ হয়েছে।");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    updateUserProfile(user.telegramId, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      bio: bio.trim(),
      photoUrl
    });
    triggerHaptic("success");
    toast.success("প্রোফাইল তথ্য সফলভাবে সেভ হয়েছে!");
    navigate("/profile");
  };

  return (
    <main className="px-3 pt-3 pb-8">
      {/* Header */}
      <header className="mb-3 flex items-center gap-2">
        <button
          onClick={() => navigate("/profile")}
          aria-label="Back"
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-white shadow-card active:scale-95 transition"
        >
          <ArrowLeft className="h-4 w-4 text-ink" />
        </button>
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white shadow-card">
          <SettingsIcon className="h-4 w-4 text-brand-500" />
        </span>
        <h1 className="text-[15px] font-extrabold text-ink">Settings</h1>
      </header>

      {/* Edit Profile Form */}
      <section className="rounded-2xl bg-white p-3 shadow-card">
        <div className="flex items-center gap-3">
          <Avatar src={photoUrl} name={firstName} size={56} ring="ring-brand-100" />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => handlePhotoUpload(e.target.files?.[0])}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex h-8 items-center gap-1.5 rounded-xl bg-cream px-3 text-[12px] font-semibold text-brand-600 transition active:scale-95"
          >
            {uploading ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImagePlus className="h-3.5 w-3.5" />
            )}
            Change Photo
          </button>
        </div>

        <div className="mt-3 space-y-2.5">
          <InputField label="First Name" value={firstName} onChange={setFirstName} />
          <InputField label="Last Name" value={lastName} onChange={setLastName} />
          <InputField label="Bio" value={bio} onChange={setBio} placeholder="Tell something about you" />
        </div>

        <button
          onClick={handleSave}
          className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-brand-500 text-[13px] font-bold text-white transition active:scale-98 shadow-sm"
        >
          <Save className="h-4 w-4" /> Save changes
        </button>
      </section>

      {/* Account Details & Danger */}
      <h2 className="mt-4 text-[15px] font-extrabold text-ink">Account Settings</h2>
      <section className="mt-2 space-y-2">
        <ReadOnlyField label="Telegram ID" value={user.telegramId} />
        <ReadOnlyField label="Username" value={user.username ? `@${user.username}` : "Not set"} />
        <ReadOnlyField label="Binance ID" value={user.binanceId || "Not set"} />

        <button
          onClick={() => openTelegramChat(config.supportUrl)}
          className="flex h-11 w-full items-center gap-2.5 rounded-2xl bg-white px-3 text-[12px] font-semibold text-ink shadow-card transition active:scale-98"
        >
          <MessageSquare className="h-4 w-4 text-brand-500" /> Telegram Support Group
        </button>

        <button
          onClick={() => {
            if (confirm("Are you sure you want to log out?")) {
              logout();
            }
          }}
          className="flex h-11 w-full items-center gap-2.5 rounded-2xl bg-white px-3 text-[12px] font-semibold text-rose-500 shadow-card transition active:scale-98"
        >
          <LogOut className="h-4 w-4" /> Log out
        </button>
      </section>
    </main>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder = ""
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-gray-400">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-0.5 h-9 w-full rounded-xl bg-cream px-3 text-[12px] text-ink outline-none border border-black/5 focus:ring-1 focus:ring-brand-300"
      />
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white px-3 py-2.5 shadow-card">
      <span className="text-[11px] text-gray-400">{label}</span>
      <span className="text-[12px] font-bold text-ink font-mono">{value}</span>
    </div>
  );
}
