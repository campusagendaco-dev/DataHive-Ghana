import { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RefreshCw, Check, Dice5 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface AvatarPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  currentAvatarUrl?: string;
}

const STYLES = [
  { id: "avataaars", name: "Classic" },
  { id: "bottts", name: "Robots" },
  { id: "pixel-art", name: "Pixel Art" },
  { id: "lorelei", name: "Modern" },
  { id: "notionists", name: "Minimal" },
  { id: "big-smile", name: "Happy" },
  { id: "identicon", name: "Abstract Logo" },
  { id: "shapes", name: "Geometric" },
  { id: "initials", name: "Monogram" },
  { id: "micah", name: "Illustrative" },
  { id: "miniavs", name: "Miniavs" },
  { id: "croodles", name: "Doodles" },
  { id: "adventurer", name: "Adventurer" },
  { id: "open-peeps", name: "Peeps" }
];

export const AvatarPicker = ({ isOpen, onClose, onSelect, currentAvatarUrl }: AvatarPickerProps) => {
  const [selectedStyle, setSelectedStyle] = useState("avataaars");
  const [seed, setSeed] = useState(Math.random().toString(36).substring(7));
  const [previewUrl, setPreviewUrl] = useState(currentAvatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`);
  const [saving, setSaving] = useState(false);

  const generateRandom = () => {
    const newSeed = Math.random().toString(36).substring(7);
    setSeed(newSeed);
    setPreviewUrl(`https://api.dicebear.com/7.x/${selectedStyle}/svg?seed=${newSeed}`);
  };

  const handleStyleChange = (style: string) => {
    setSelectedStyle(style);
    setPreviewUrl(`https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSelect(previewUrl);
      onClose();
    } catch (error) {
      toast.error("Failed to save avatar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-white/10 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black">Customize Avatar</DialogTitle>
          <DialogDescription className="text-muted-foreground font-medium">
            Express yourself with a unique profile picture.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-8 py-6">
          {/* Main Preview */}
          <div className="relative group">
            <div className="absolute -inset-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full blur opacity-40 group-hover:opacity-75 transition duration-500"></div>
            <Avatar className="w-32 h-32 border-4 border-card relative ring-1 ring-white/10">
              <AvatarImage src={previewUrl} />
              <AvatarFallback className="text-2xl bg-primary/10 font-bold">
                P
              </AvatarFallback>
            </Avatar>
            <Button 
              size="icon" 
              variant="secondary" 
              className="absolute bottom-0 right-0 rounded-full shadow-lg border-2 border-card hover:scale-110 transition-transform"
              onClick={generateRandom}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          {/* Style Selector */}
          <Tabs defaultValue="avataaars" onValueChange={handleStyleChange} className="w-full">
            <ScrollArea className="w-full pb-3">
              <TabsList className="bg-white/5 border border-white/10 p-1 h-auto flex-nowrap w-max min-w-full">
                {STYLES.map((style) => (
                  <TabsTrigger 
                    key={style.id} 
                    value={style.id}
                    className="font-bold px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    {style.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </ScrollArea>
          </Tabs>

          {/* Quick Seeds Grid */}
          <div className="w-full grid grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => {
              const testSeed = `preset-${i}-${selectedStyle}`;
              const testUrl = `https://api.dicebear.com/7.x/${selectedStyle}/svg?seed=${testSeed}`;
              return (
                <button
                  key={i}
                  onClick={() => {
                    setSeed(testSeed);
                    setPreviewUrl(testUrl);
                  }}
                  className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all hover:scale-105 active:scale-95 ${
                    previewUrl === testUrl ? 'border-primary shadow-lg shadow-primary/20 bg-primary/5' : 'border-white/10 bg-white/5 hover:border-white/30'
                  }`}
                >
                  <img src={testUrl} alt={`Option ${i}`} className="w-full h-full object-cover" />
                  {previewUrl === testUrl && (
                    <div className="absolute top-1 right-1 bg-primary text-white p-0.5 rounded-full">
                      <Check className="w-2.5 h-2.5" />
                    </div>
                  )}
                </button>
              );
            })}
            <button
              onClick={generateRandom}
              className="aspect-square rounded-xl border-2 border-dashed border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/40 transition-all flex flex-col items-center justify-center gap-1 group"
            >
              <Dice5 className="w-6 h-6 text-muted-foreground group-hover:text-primary group-hover:rotate-12 transition-all" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-primary">More</span>
            </button>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onClose} className="font-bold">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 font-bold px-8 shadow-lg shadow-primary/20">
            {saving ? (
              <><RefreshCw className="w-4 h-4 animate-spin mr-2" /> Saving...</>
            ) : (
              "Save Avatar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
