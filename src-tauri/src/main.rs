// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::sync::Mutex;
use std::collections::HashMap;
use std::process::Command;
use base64::encode;
use winapi::um::shellapi::ExtractIconW;
use winapi::um::winuser::{GetIconInfo, DestroyIcon, ICONINFO};
use winapi::shared::windef::HICON;
use std::ptr;
use std::ffi::OsStr;
use std::os::windows::ffi::OsStrExt;
use image::{ImageBuffer, Rgba};
use image::codecs::png::PngEncoder;
use image::ImageEncoder;
use std::fs;
use std::path::PathBuf;
use std::fs::File;
use std::io::Write;

#[derive(Default)]
struct AppManager {
    apps: Mutex<HashMap<String, String>>, // Stores app names and paths
}

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn add_app(manager: tauri::State<AppManager>, name: String, path: String) -> Result<String, String> {
    println!("Adding app from modal: {} with path: {}", name, path);
    let mut apps = manager.apps.lock().unwrap();
    if apps.contains_key(&name) {
        Err(format!("App '{}' already exists!", name))
    } else {
        apps.insert(name.clone(), path.clone());

        // Save the app details to a file
        let file_path = PathBuf::from("data/apps.txt");
        if let Ok(mut file) = fs::OpenOptions::new().append(true).create(true).open(&file_path) {
            use std::io::Write;
            writeln!(file, "{}:{}", name, path).map_err(|e| e.to_string())?;
        }

        Ok(format!("App '{}' added successfully!", name))
    }
}

#[tauri::command]
fn add_app_from_drop(manager: tauri::State<AppManager>, name: String, path: String) -> Result<String, String> {
    println!("Adding app from drop: {} with path: {}", name, path);
    let mut apps = manager.apps.lock().unwrap();
    if apps.contains_key(&name) {
        Err(format!("App '{}' already exists!", name))
    } else {
        let _icon = get_icon(path.clone()).unwrap_or_else(|_| get_default_icon());
        apps.insert(name.clone(), path.clone());

        // Save the app details to a file
        let file_path = PathBuf::from("data/apps.txt");
        if let Ok(mut file) = fs::OpenOptions::new().append(true).create(true).open(&file_path) {
            use std::io::Write;
            writeln!(file, "{}:{}", name, path).map_err(|e| e.to_string())?;
        }

        Ok(format!("App '{}' added successfully with icon!", name))
    }
}

#[tauri::command]
fn get_apps(manager: tauri::State<AppManager>) -> Vec<(String, String)> {
    let apps = manager.apps.lock().unwrap();
    apps.iter().map(|(name, path)| (name.clone(), path.clone())).collect()
}

#[tauri::command]
fn launch_app(manager: tauri::State<AppManager>, path: String) -> Result<String, String> {
    println!("Launching app with path: {}", path);
    Command::new(&path)
        .spawn()
        .map_err(|e| {
            println!("Failed to launch app: {}", e);
            e.to_string()
        })?;
    Ok(format!("Launched: {}", path))
}

fn to_wide_string(s: &str) -> Vec<u16> {
    OsStr::new(s).encode_wide().chain(Some(0).into_iter()).collect()
}

fn hicon_to_base64(h_icon: HICON) -> Result<String, String> {
    unsafe {
        let mut icon_info: ICONINFO = std::mem::zeroed();
        if GetIconInfo(h_icon, &mut icon_info) == 0 {
            return Err("Failed to get icon info.".to_string());
        }

        let bitmap = icon_info.hbmColor;
        let mut bitmap_info = winapi::um::wingdi::BITMAP {
            bmType: 0,
            bmWidth: 0,
            bmHeight: 0,
            bmWidthBytes: 0,
            bmPlanes: 0,
            bmBitsPixel: 0,
            bmBits: std::ptr::null_mut(),
        };
        if winapi::um::wingdi::GetObjectW(
            bitmap as *mut _,
            std::mem::size_of::<winapi::um::wingdi::BITMAP>() as i32,
            &mut bitmap_info as *mut _ as *mut _,
        ) == 0
        {
            return Err("Failed to get bitmap info.".to_string());
        }

        let width = bitmap_info.bmWidth;
        let height = bitmap_info.bmHeight;
        let mut buffer = vec![0u8; (width * height * 4) as usize];

        if winapi::um::wingdi::GetBitmapBits(
            bitmap,
            buffer.len() as i32,
            buffer.as_mut_ptr() as *mut _,
        ) == 0
        {
            return Err("Failed to get bitmap bits.".to_string());
        }

        // Convert BGRA to RGBA
        for chunk in buffer.chunks_exact_mut(4) {
            chunk.swap(0, 2);
        }

        let _img = ImageBuffer::<Rgba<u8>, _>::from_raw(width as u32, height as u32, buffer.clone())
            .ok_or("Failed to create image buffer.")?;
        let mut buf = Vec::new();
        PngEncoder::new(&mut buf).write_image(
            &buffer,
            width as u32,
            height as u32,
            image::ColorType::Rgba8,
        ).map_err(|e| e.to_string())?;
        DestroyIcon(h_icon);
        Ok(base64::encode(&buf))
    }
}

#[tauri::command]
fn get_icon(path: String) -> Result<String, String> {
    println!("Getting icon for path: {}", path);
    let full_path = std::fs::canonicalize(&path).unwrap_or_else(|_| PathBuf::from(&path));
    println!("Full path: {:?}", full_path);
    unsafe {
        let wide_path = to_wide_string(full_path.to_str().unwrap());
        println!("Wide path: {:?}", wide_path);
        let h_icon: HICON = ExtractIconW(ptr::null_mut(), wide_path.as_ptr(), 0);
        if h_icon.is_null() {
            println!("Failed to load icon for path: {}", path);
            return Err("Failed to load icon.".to_string());
        }
        hicon_to_base64(h_icon)
    }
}

fn get_default_icon() -> String {
    // Provide a base64-encoded default icon
    let default_icon = include_bytes!("../icons/32x32.png");
    encode(default_icon)
}

#[tauri::command]
fn set_wallpaper(path: String) -> Result<String, String> {
    println!("Setting wallpaper with path: {}", path);
    let wallpaper_path = PathBuf::from("data/wallpaper.txt");
    let mut file = File::create(&wallpaper_path).map_err(|e| e.to_string())?;
    file.write_all(path.as_bytes()).map_err(|e| e.to_string())?;
    Ok("Wallpaper set successfully!".to_string())
}

#[tauri::command]
fn remove_wallpaper() -> Result<String, String> {
    println!("Removing wallpaper");
    let wallpaper_path = PathBuf::from("data/wallpaper.txt");
    if wallpaper_path.exists() {
        fs::remove_file(&wallpaper_path).map_err(|e| e.to_string())?;
    }
    Ok("Wallpaper removed successfully!".to_string())
}

fn main() {
    let manager = AppManager::default();

    tauri::Builder::default()
        .manage(manager) // Share AppManager state across commands
        .invoke_handler(tauri::generate_handler![
            add_app, 
            add_app_from_drop, 
            get_apps, 
            launch_app, 
            get_icon, 
            set_wallpaper, 
            remove_wallpaper
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}