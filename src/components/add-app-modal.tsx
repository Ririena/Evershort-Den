import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { invoke } from '@tauri-apps/api/tauri'
interface AddAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (app: { name: string; icon: string; path: string }) => void;
}

export default function AddAppModal({ isOpen, onClose, onAdd }: AddAppModalProps) {
  const [name, setName] = useState('')
  const [path, setPath] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const icon = await invoke('get_icon', { path });
      await onAdd({ name, icon: `data:image/png;base64,${icon}`, path });
      setName('');
      setPath('');
      onClose();
    } catch (error) {
      alert(`Failed to fetch icon: ${error}`);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New App</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">App Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="path">Executable Path</Label>
            <Input
              id="path"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              required
            />
          </div>
          <Button type="submit">Add App</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

