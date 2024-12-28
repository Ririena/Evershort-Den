import { Card, CardContent } from '@/components/ui/card'
import { invoke } from '@tauri-apps/api';
import { Button } from './ui/button';
import { Trash2 } from "lucide-react";

interface App {
  name: string;
  icon: string;
}

interface AppCardProps {
    app: { id: number; name: string; icon: string; path: string };
    onLaunch: () => void;
    onDelete: () => void;
  }

  export default function AppCard({ app, onLaunch, onDelete }: AppCardProps) {
    const handleLaunch = async () => {
        try {
          const message: string = await invoke('launch_app', { path: app.path });
          alert(message); // Success message
        } catch (error) {
          alert(`Error: ${error}`); // Error handling
        }
      };

  return (
    <Card  onClick={(e) => { e.stopPropagation(); onLaunch(); }} className="hover:bg-accent cursor-pointer transition-colors relative">
      <Button className="absolute top-2 right-2" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
        <Trash2 className="h-4 w-4" />
      </Button>
      <CardContent className="flex flex-col items-center justify-center p-4">
        <img src={app.icon} alt={app.name} width={64} height={64} className="mb-2" />
        <p className="text-center text-sm font-medium">{app.name}</p>
      </CardContent>
    </Card>
  )
}

