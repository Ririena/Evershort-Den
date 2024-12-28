use std::fs;
use std::path::Path;

fn main() {
    if cfg!(target_os = "windows") {
        let mut res = winres::WindowsResource::new();
        res.set_icon("icons/icon.ico");
        res.compile().expect("Failed to compile resources");

        // Rename the executable
        let old_path = Path::new("target/debug/markdown-editor.exe");
        let new_path = Path::new("target/debug/Evershort Den.exe");

        if old_path.exists() {
            match fs::rename(&old_path, &new_path) {
                Ok(_) => println!("Successfully renamed the executable."),
                Err(e) => {
                    eprintln!("Failed to rename the executable: {}", e);
                    if e.kind() == std::io::ErrorKind::PermissionDenied {
                        eprintln!("Permission denied. Please ensure the file is not in use and you have the necessary permissions.");
                    }
                }
            }
        } else {
            eprintln!("Old executable path does not exist: {:?}", old_path);
        }
    } else {
        tauri_build::build()
    }
}
