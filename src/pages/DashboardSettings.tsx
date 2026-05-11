import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { generateSlug } from "@/lib/data";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Store, User, Phone, Mail, MessageCircle, Link2,
  Palette, Smartphone, CreditCard, Globe, CheckCircle2, Loader2, Upload, X, Image,
} from "lucide-react";

const SECTION = ({ icon: Icon, title, description, children }: {
  icon: typeof Store; title: string; description: string; children: React.ReactNode;
}) => (
  <div className="rounded-3xl border border-white/8 overflow-hidden" style={{ background: "#111116" }}>
    <div className="flex items-center gap-3 px-5 py-4 border-b border-white/6">
      <div className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.2)" }}>
        <Icon className="w-4 h-4 text-amber-400" />
      </div>
      <div>
        <p className="text-sm font-black text-white">{title}</p>
        <p className="text-[11px] text-white/40">{description}</p>
      </div>
    </div>
    <div className="p-5 space-y-4">{children}</div>
  </div>
);

const Field = ({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <label className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-white/40">
      {label}
      {required && <span className="text-amber-400">*</span>}
    </label>
    {children}
    {hint && <p className="text-[10px] text-white/30 leading-relaxed">{hint}</p>}
  </div>
);

const StyledInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className="w-full h-11 rounded-2xl px-4 text-sm font-medium text-white border outline-none transition-all focus:border-amber-400/50 placeholder:text-white/20"
    style={{ background: "#1a1a24", borderColor: "rgba(255,255,255,0.08)", ...props.style as React.CSSProperties }}
  />
);

const MOMO_NETWORKS = [
  { id: "MTN", label: "MTN MoMo", color: "#fbbf24" },
  { id: "Telecel", label: "Telecel Cash", color: "#ef4444" },
  { id: "AirtelTigo", label: "AirtelTigo Money", color: "#3b82f6" },
];

const PRESET_COLORS = [
  "#fbbf24", "#f59e0b", "#ef4444", "#ec4899",
  "#8b5cf6", "#6366f1", "#3b82f6", "#06b6d4",
  "#10b981", "#84cc16", "#f97316", "#ffffff",
];

const DashboardSettings = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    store_name: "",
    full_name: "",
    email: "",
    phone: "",
    whatsapp_number: "",
    support_number: "",
    whatsapp_group_link: "",
    momo_number: "",
    momo_network: "",
    momo_account_name: "",
    store_logo_url: "",
    store_primary_color: "#fbbf24",
  });

  useEffect(() => {
    if (profile) {
      setForm({
        store_name: profile.store_name || "",
        full_name: profile.full_name || "",
        email: profile.email || "",
        phone: profile.phone || "",
        whatsapp_number: profile.whatsapp_number || "",
        support_number: profile.support_number || "",
        whatsapp_group_link: profile.whatsapp_group_link || "",
        momo_number: profile.momo_number || "",
        momo_network: profile.momo_network || "",
        momo_account_name: profile.momo_account_name || "",
        store_logo_url: profile.store_logo_url || "",
        store_primary_color: profile.store_primary_color || "#fbbf24",
      });
    }
  }, [profile]);

  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleLogoUpload = async (file: File) => {
    const MAX_MB = 5;
    if (file.size > MAX_MB * 1024 * 1024) {
      toast({ title: `Image too large — max ${MAX_MB}MB`, variant: "destructive" });
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast({ title: "Only image files are allowed", variant: "destructive" });
      return;
    }
    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `store-logos/${user?.id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("site-assets")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("site-assets").getPublicUrl(path);
      update("store_logo_url", data.publicUrl);
      toast({ title: "Logo uploaded!" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const required = [
      form.store_name, form.full_name, form.whatsapp_number,
      form.support_number, form.momo_number, form.momo_network, form.momo_account_name,
    ];
    if (required.some((v) => !v.trim())) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    setSaving(true);
    const slug = generateSlug(form.store_name);

    const { error } = await supabase.from("profiles").update({
      store_name: form.store_name.trim(),
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      whatsapp_number: form.whatsapp_number.trim(),
      support_number: form.support_number.trim(),
      whatsapp_group_link: form.whatsapp_group_link.trim() || null,
      momo_number: form.momo_number.trim(),
      momo_network: form.momo_network.trim(),
      momo_account_name: form.momo_account_name.trim(),
      store_logo_url: form.store_logo_url,
      store_primary_color: form.store_primary_color,
      slug,
    }).eq("user_id", user.id);

    if (error) {
      toast({ title: "Error saving settings", description: error.message, variant: "destructive" });
    } else {
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      toast({ title: "Store settings saved!" });
    }
    setSaving(false);
  };

  const storeUrl = profile?.slug ? `${window.location.origin}/store/${profile.slug}` : null;
  const previewSlug = form.store_name ? generateSlug(form.store_name) : null;

  return (
    <div className="min-h-screen p-4 md:p-6 pb-24" style={{ background: "#0a0a0f" }}>
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Store Settings</h1>
          <p className="text-sm text-white/40 mt-0.5">Manage your store identity, contact info, and branding.</p>
        </div>

        {/* Live URL banner */}
        {storeUrl && (
          <div className="rounded-2xl px-4 py-3 flex items-center gap-3 border border-emerald-500/20" style={{ background: "rgba(16,185,129,0.08)" }}>
            <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400/70 mb-0.5">Live Store URL</p>
              <p className="text-xs text-white/70 font-medium truncate">{storeUrl}</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">

          {/* Identity */}
          <SECTION icon={User} title="Identity" description="Your name and store display information">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full Name" required>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <StyledInput
                    value={form.full_name}
                    onChange={(e) => update("full_name", e.target.value)}
                    placeholder="Kwame Asante"
                    maxLength={100}
                    style={{ paddingLeft: "2.25rem" }}
                  />
                </div>
              </Field>
              <Field label="Store Name" required hint={previewSlug ? `URL slug: /store/${previewSlug}` : "Changing this updates your store URL"}>
                <div className="relative">
                  <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <StyledInput
                    value={form.store_name}
                    onChange={(e) => update("store_name", e.target.value)}
                    placeholder="Kwame's Data Hub"
                    maxLength={100}
                    style={{ paddingLeft: "2.25rem" }}
                  />
                </div>
              </Field>
              <Field label="Email Address">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <StyledInput
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    placeholder="kwame@example.com"
                    maxLength={255}
                    style={{ paddingLeft: "2.25rem" }}
                  />
                </div>
              </Field>
              <Field label="Phone Number">
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <StyledInput
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    placeholder="024 XXX XXXX"
                    maxLength={20}
                    style={{ paddingLeft: "2.25rem" }}
                  />
                </div>
              </Field>
            </div>
          </SECTION>

          {/* Contact */}
          <SECTION icon={MessageCircle} title="Contact & Support" description="How customers reach you">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="WhatsApp Number" required>
                <div className="relative">
                  <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <StyledInput
                    value={form.whatsapp_number}
                    onChange={(e) => update("whatsapp_number", e.target.value)}
                    placeholder="024 XXX XXXX"
                    maxLength={20}
                    style={{ paddingLeft: "2.25rem" }}
                  />
                </div>
              </Field>
              <Field label="Support Number" required>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <StyledInput
                    value={form.support_number}
                    onChange={(e) => update("support_number", e.target.value)}
                    placeholder="020 XXX XXXX"
                    maxLength={20}
                    style={{ paddingLeft: "2.25rem" }}
                  />
                </div>
              </Field>
            </div>
            <Field label="WhatsApp Group / Channel Link" hint="Optional — add a link to your customer WhatsApp group or channel">
              <div className="relative">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <StyledInput
                  value={form.whatsapp_group_link}
                  onChange={(e) => update("whatsapp_group_link", e.target.value)}
                  placeholder="https://chat.whatsapp.com/..."
                  maxLength={500}
                  style={{ paddingLeft: "2.25rem" }}
                />
              </div>
            </Field>
          </SECTION>

          {/* Branding */}
          <SECTION icon={Palette} title="Branding" description="Customize how your store looks">
            <Field label="Store Logo" hint="PNG, JPG or WebP — max 5MB">
              {/* hidden file input */}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                aria-label="Upload store logo"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoUpload(file);
                  e.target.value = "";
                }}
              />

              {form.store_logo_url ? (
                /* Preview with replace / remove */
                <div className="flex items-center gap-3">
                  <div className="w-20 h-20 rounded-2xl border border-white/10 overflow-hidden bg-white flex items-center justify-center shrink-0">
                    <img src={form.store_logo_url} alt="Logo" className="w-full h-full object-contain" />
                  </div>
                  <div className="flex flex-col gap-2 flex-1">
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                      className="flex items-center gap-2 h-9 px-4 rounded-xl text-xs font-black text-amber-400 border border-amber-400/30 bg-amber-400/10 hover:bg-amber-400/20 transition-all disabled:opacity-50"
                    >
                      {uploadingLogo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      {uploadingLogo ? "Uploading…" : "Replace Logo"}
                    </button>
                    <button
                      type="button"
                      onClick={() => update("store_logo_url", "")}
                      className="flex items-center gap-2 h-9 px-4 rounded-xl text-xs font-bold text-white/40 border border-white/8 bg-white/4 hover:bg-white/8 transition-all"
                    >
                      <X className="w-3.5 h-3.5" /> Remove
                    </button>
                  </div>
                </div>
              ) : (
                /* Drop zone */
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleLogoUpload(file);
                  }}
                  className="w-full h-28 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all disabled:opacity-50"
                  style={{ borderColor: "rgba(255,255,255,0.12)", background: "#1a1a24" }}
                >
                  {uploadingLogo ? (
                    <>
                      <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                      <span className="text-xs font-bold text-white/40">Uploading…</span>
                    </>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "rgba(251,191,36,0.12)" }}>
                        <Upload className="w-5 h-5 text-amber-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-black text-white/70">Tap to upload logo</p>
                        <p className="text-[10px] text-white/30">or drag and drop · PNG, JPG, WebP · max 5MB</p>
                      </div>
                    </>
                  )}
                </button>
              )}
            </Field>

            <Field label="Primary Brand Color" hint="Used for buttons and accents on your store page">
              {/* Preset swatches */}
              <div className="flex flex-wrap gap-2 mb-3">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    aria-label={`Select color ${c}`}
                    onClick={() => update("store_primary_color", c)}
                    className="w-8 h-8 rounded-xl border-2 transition-all hover:scale-110 active:scale-95"
                    style={{
                      background: c,
                      borderColor: form.store_primary_color === c ? "white" : "transparent",
                      boxShadow: form.store_primary_color === c ? `0 0 0 3px ${c}55` : "none",
                    }}
                  />
                ))}
              </div>
              {/* Custom picker row */}
              <div className="flex gap-2 items-center">
                <div
                  className="w-11 h-11 rounded-2xl border-2 border-white/20 overflow-hidden shrink-0 cursor-pointer relative"
                  style={{ background: form.store_primary_color }}
                >
                  <input
                    type="color"
                    title="Pick a custom color"
                    aria-label="Pick a custom color"
                    value={form.store_primary_color}
                    onChange={(e) => update("store_primary_color", e.target.value)}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  />
                </div>
                <StyledInput
                  value={form.store_primary_color}
                  onChange={(e) => update("store_primary_color", e.target.value)}
                  placeholder="#fbbf24"
                  maxLength={7}
                  className="font-mono"
                />
              </div>
            </Field>
          </SECTION>

          {/* MoMo */}
          <SECTION icon={CreditCard} title="Mobile Money" description="Payment details shown to your customers">
            {/* Network selector */}
            <Field label="MoMo Network" required>
              <div className="grid grid-cols-3 gap-2">
                {MOMO_NETWORKS.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => update("momo_network", n.id)}
                    className="h-11 rounded-2xl flex items-center justify-center gap-1.5 text-xs font-black border-2 transition-all"
                    style={
                      form.momo_network === n.id
                        ? { background: `${n.color}22`, borderColor: n.color, color: n.color }
                        : { background: "#1a1a24", borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }
                    }
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    {n.id}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="MoMo Account Name" required>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <StyledInput
                    value={form.momo_account_name}
                    onChange={(e) => update("momo_account_name", e.target.value)}
                    placeholder="Kwame Asante"
                    maxLength={100}
                    style={{ paddingLeft: "2.25rem" }}
                  />
                </div>
              </Field>
              <Field label="MoMo Number" required>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <StyledInput
                    value={form.momo_number}
                    onChange={(e) => update("momo_number", e.target.value)}
                    placeholder="024 XXX XXXX"
                    maxLength={20}
                    style={{ paddingLeft: "2.25rem" }}
                  />
                </div>
              </Field>
            </div>
          </SECTION>

          {/* Save button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full h-14 rounded-3xl font-black text-base transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            style={{
              background: saved
                ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                : "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
              color: "#000",
              boxShadow: saved
                ? "0 4px 24px rgba(16,185,129,0.35)"
                : "0 4px 24px rgba(251,191,36,0.35)",
            }}
          >
            {saving ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</>
            ) : saved ? (
              <><CheckCircle2 className="w-5 h-5" /> Saved!</>
            ) : (
              "Save Store Settings"
            )}
          </button>

        </form>
      </div>
    </div>
  );
};

export default DashboardSettings;
