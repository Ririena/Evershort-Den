import "./App.css";
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api"; // Import invoke for Tauri commands
import { Search, Plus, Trash2, Image, X, Github, AArrowDown as Discord } from "lucide-react"; // Import Github icon
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AppCard from "./components/app-card";
import AddAppModal from "./components/add-app-modal";
import { ThemeProvider } from "./components/theme-provider";
import { ModeToggle } from "./components/mode-toggle";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { open } from '@tauri-apps/api/dialog';
import { Card } from "./components/ui/card";

interface App {
  id: number;
  name: string;
  icon: string;
  path: string;
  lastUsed?: number; // Add lastUsed property
}

const saveAppsToLocalStorage = (apps: App[]) => {
  localStorage.setItem("apps", JSON.stringify(apps));
};

const loadAppsFromLocalStorage = (): App[] => {
  const apps = localStorage.getItem("apps");
  return apps ? JSON.parse(apps) : [];
};

const saveWallpaperToLocalStorage = (wallpaper: string | null) => {
  if (wallpaper) {
    localStorage.setItem("wallpaper", wallpaper);
  } else {
    localStorage.removeItem("wallpaper");
  }
};

const loadWallpaperFromLocalStorage = (): string | null => {
  return localStorage.getItem("wallpaper");
};

export const App = () => {
  const [apps, setApps] = useState<App[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [appToDelete, setAppToDelete] = useState<App | null>(null);
  const [sortCriteria, setSortCriteria] = useState<string>("name-asc");
  const [droppedApp, setDroppedApp] = useState<{ name: string; path: string } | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [wallpaper, setWallpaper] = useState<string | null>(loadWallpaperFromLocalStorage());

  useEffect(() => {
    const fetchApps = async () => {
      try {
        const result: { name: string; path: string }[] = await invoke('get_apps');
        const appsWithIcons = await Promise.all(result.map(async (app, index) => {
          const icon = await invoke('get_icon', { path: app.path });
          return { id: index + 1, name: app.name, icon: `data:image/png;base64,${icon}`, path: app.path };
        }));
        setApps(appsWithIcons);
        saveAppsToLocalStorage(appsWithIcons);
      } catch (error) {
        console.error("Failed to fetch apps:", error);
      }
    };

    const localApps = loadAppsFromLocalStorage();
    if (localApps.length > 0) {
      setApps(localApps);
    } else {
      fetchApps();
    }
  }, []);

  useEffect(() => {
    if (wallpaper) {
      const formattedWallpaper = wallpaper.startsWith('file://') ? wallpaper : `file://${wallpaper}`;
      document.body.style.backgroundImage = `url(${formattedWallpaper})`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundColor = 'transparent';
      document.body.classList.remove('bg-background', 'text-foreground'); // Remove default theme classes
    } else {
      document.body.style.backgroundImage = '';
      document.body.style.backgroundColor = ''; // Revert to default theme
      document.body.classList.add('bg-background', 'text-foreground'); // Add default theme classes
    }
  }, [wallpaper]);

  const addAppFromModal = async (newApp: { name: string; icon: string; path: string }) => {
    try {
      const message: string = await invoke('add_app', { name: newApp.name, path: newApp.path });
      alert(message); // Show a success message
      const updatedApps = [...apps, { id: apps.length + 1, ...newApp }];
      setApps(updatedApps);
      saveAppsToLocalStorage(updatedApps);
    } catch (error) {
      alert(error); // Handle errors
    }
  };

  const addAppFromDrop = async (droppedApp: { name: string; path: string }) => {
    try {
      console.log("Adding app from drop:", droppedApp);
      const icon = await invoke('get_icon', { path: droppedApp.path });
      const newApp = { name: droppedApp.name, icon: `data:image/png;base64,${icon}`, path: droppedApp.path };
      const message: string = await invoke('add_app_from_drop', { name: newApp.name, path: newApp.path });
      alert(message); // Show a success message
      const updatedApps = [...apps, { id: apps.length + 1, ...newApp }];
      setApps(updatedApps);
      saveAppsToLocalStorage(updatedApps);
      setDroppedApp(null);
    } catch (error) {
      alert(`Failed to fetch icon: ${error}`);
    }
  };

  const launchApp = async (name: string) => {
    try {
      const app = apps.find(app => app.name === name);
      if (app) {
        console.log("Launching app:", app);
        await invoke("launch_app", { path: app.path }); // Call the Tauri backend command
        alert(`Launched app: ${name}`);
      } else {
        alert(`App not found: ${name}`);
      }
    } catch (error) {
      alert(`Failed to launch app: ${error}`);
    }
  };

  const confirmDeleteApp = (app: App) => {
    setAppToDelete(app);
  };

  const handleDeleteApp = () => {
    if (appToDelete) {
      const updatedApps = apps.filter(app => app.id !== appToDelete.id);
      setApps(updatedApps);
      saveAppsToLocalStorage(updatedApps);
      setAppToDelete(null);
    }
  };

  const sortApps = (apps: App[]) => {
    switch (sortCriteria) {
      case "name-asc":
        return [...apps].sort((a, b) => a.name.localeCompare(b.name));
      case "name-desc":
        return [...apps].sort((a, b) => b.name.localeCompare(a.name));
      case "latest-used":
        return [...apps].sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
      case "no-longer-used":
        return [...apps].sort((a, b) => (a.lastUsed || 0) - (b.lastUsed || 0));
      default:
        return apps;
    }
  };

  const filteredApps = sortApps(apps.filter((app) =>
    app.name.toLowerCase().includes(searchTerm.toLowerCase())
  ));

 

  const handleConfirmAddDroppedApp = async () => {
    if (droppedApp) {
      console.log("Confirming add dropped app:", droppedApp);
      await addAppFromDrop(droppedApp);
      setIsConfirmOpen(false); // Close the confirmation dialog after adding the app
    }
  };

  const handleSetWallpaper = async () => {
    try {
      const selectedPath = await open({
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png'] }]
      });
      if (selectedPath) {
        const imageUrl = `file://${selectedPath}`;
        console.log(`Selected wallpaper path: ${imageUrl}`);
        await invoke('set_wallpaper', { path: imageUrl });
        setWallpaper(imageUrl);
        saveWallpaperToLocalStorage(imageUrl);
      }
    } catch (error) {
      console.error(`Failed to select wallpaper: ${error}`);
      alert(`Failed to select wallpaper: ${error}`);
    }
  };

  const handleRemoveWallpaper = async () => {
    try {
      console.log("Removing wallpaper");
      await invoke('remove_wallpaper');
      setWallpaper(null);
      saveWallpaperToLocalStorage(null);
    } catch (error) {
      console.error(`Failed to remove wallpaper: ${error}`);
      alert(`Failed to remove wallpaper: ${error}`);
    }
  };

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background text-foreground">
        <div className="container mx-auto p-4">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">App Launcher</h1>
            <div className="flex space-x-2">
              <ModeToggle />
              <Button onClick={handleSetWallpaper} size="icon">
                <Image className="h-4 w-4" />
              </Button>
              <Button onClick={handleRemoveWallpaper} size="icon">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
       
          <div className="flex space-x-2 mb-6">
            <div className="relative flex-grow">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search apps..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Add App
            </Button>
          </div>
          <div className="flex space-x-2 mb-6">
            <Button onClick={() => setSortCriteria("name-asc")}>Sort A-Z</Button>
            <Button onClick={() => setSortCriteria("name-desc")}>Sort Z-A</Button>
            <Button onClick={() => setSortCriteria("latest-used")}>Sort by Latest Used</Button>
            <Button onClick={() => setSortCriteria("no-longer-used")}>Sort by No Longer Used</Button>
          </div>
        
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredApps.map((app) => (
              <AppCard key={app.id} app={app} onLaunch={() => launchApp(app.name)} onDelete={() => confirmDeleteApp(app)} />
            ))}
          </div>
        </div>
        <div className="fixed bottom-16 right-4 flex flex-col space-y-2">
        <a href="https://github.com/Ririena/Evershort-Den" target="_blank" rel="noopener noreferrer" className="no-underline">
  <Card className="p-4 flex items-center space-x-2">
    <Github className="h-6 w-6" />
    <span>Checkout My Repository</span>
  </Card>
</a>
        </div>
        <footer className="fixed bottom-0 left-0 right-0 text-center py-4 bg-background/80 backdrop-blur-sm">
          <p className="text-sm text-muted-foreground">
            Made with ❤️ by YueLin
          </p>
        </footer>
        <AddAppModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onAdd={addAppFromModal} />
        {appToDelete && (
          <Dialog open={true} onOpenChange={() => setAppToDelete(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Delete</DialogTitle>
              </DialogHeader>
              <p>Are you sure you want to delete the app "{appToDelete.name}"?</p>
              <div className="flex justify-end space-x-2 mt-4">
                <Button variant="outline" onClick={() => setAppToDelete(null)}>Cancel</Button>
                <Button variant="destructive" onClick={handleDeleteApp}>Delete</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
        {isConfirmOpen && (
          <Dialog open={true} onOpenChange={() => setIsConfirmOpen(false)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Add App</DialogTitle>
              </DialogHeader>
              <p>Do you want to add the app "{droppedApp?.name}"?</p>
              <div className="flex justify-end space-x-2 mt-4">
                <Button variant="outline" onClick={() => setIsConfirmOpen(false)}>Cancel</Button>
                <Button onClick={handleConfirmAddDroppedApp}>Add</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </ThemeProvider>
  );
};

export default App;