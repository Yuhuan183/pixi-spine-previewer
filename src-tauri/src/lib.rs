use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::Serialize;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{Emitter, Manager, State};

/// Extensions a Spine asset can be built from; everything else stays out of the payload.
const SCAN_EXTS: [&str; 9] = ["atlas", "skel", "bin", "json", "png", "webp", "jpg", "jpeg", "avif"];
/// Wrapper extensions some pipelines append, e.g. `Foo.atlas.txt`.
const WRAPPER_EXTS: [&str; 2] = ["txt", "bytes"];
const SKIP_DIRS: [&str; 5] = ["node_modules", ".git", ".svn", ".hg", "__MACOSX"];
const MAX_FILES: usize = 20_000;
const MAX_DEPTH: usize = 12;
const RECENT_LIMIT: usize = 8;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ScannedFile {
    path: String,
    rel_path: String,
    rel_dir: String,
    name: String,
    ext: String,
    size: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanResult {
    files: Vec<ScannedFile>,
    truncated: bool,
    dir_count: usize,
}

/// Directories the user opened in this session. Every read is checked against them, so a
/// compromised webview cannot turn `read_file` into a read-anything primitive.
#[derive(Default)]
struct Allowed(Mutex<HashSet<PathBuf>>);

/// Directory passed on the command line, if any.
struct InitialRoot(Mutex<Option<String>>);

fn recent_file(app: &tauri::AppHandle) -> Option<PathBuf> {
    let dir = app.path().app_config_dir().ok()?;
    fs::create_dir_all(&dir).ok()?;
    Some(dir.join("recent-roots.json"))
}

fn read_recent(app: &tauri::AppHandle) -> Vec<String> {
    recent_file(app)
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|text| serde_json::from_str::<Vec<String>>(&text).ok())
        .unwrap_or_default()
}

fn remember_root(app: &tauri::AppHandle, root: &str) {
    let mut recent = read_recent(app);

    recent.retain(|item| item != root);
    recent.insert(0, root.to_string());
    recent.truncate(RECENT_LIMIT);

    // A previewer that cannot persist its recent list is still perfectly usable.
    if let Some(path) = recent_file(app) {
        if let Ok(text) = serde_json::to_string_pretty(&recent) {
            let _ = fs::write(path, text);
        }
    }
}

fn is_allowed(allowed: &Allowed, target: &Path) -> bool {
    allowed
        .0
        .lock()
        .map(|roots| roots.iter().any(|root| target.starts_with(root)))
        .unwrap_or(false)
}

/// Resolves a path the webview handed over and checks it against the session's roots.
///
/// Canonicalising first is what makes the check meaningful: `Path::starts_with` compares
/// components literally, so `<root>/../../.ssh/id_rsa` would pass a plain prefix test, and a
/// symlink inside the root could point anywhere. The roots themselves are stored canonical.
fn resolve_allowed(allowed: &Allowed, path: &str) -> Result<PathBuf, String> {
    let resolved = fs::canonicalize(path).map_err(|error| format!("{path}：{error}"))?;

    if !is_allowed(allowed, &resolved) {
        return Err(format!("拒絕存取授權範圍外的路徑：{path}"));
    }

    Ok(resolved)
}

/// `Foo.atlas.txt` -> `atlas`, `Foo.webp` -> `webp`.
fn effective_ext(name: &str) -> String {
    let lower = name.to_ascii_lowercase();
    let unwrapped = WRAPPER_EXTS
        .iter()
        .find_map(|ext| lower.strip_suffix(&format!(".{ext}")))
        .unwrap_or(&lower);

    unwrapped
        .rsplit_once('.')
        .map(|(_, ext)| ext.to_string())
        .unwrap_or_default()
}

fn walk(root: &Path, dir: &Path, depth: usize, out: &mut Vec<ScannedFile>, dirs: &mut usize) -> bool {
    *dirs += 1;

    let Ok(entries) = fs::read_dir(dir) else {
        return false;
    };

    for entry in entries.flatten() {
        if out.len() >= MAX_FILES {
            return true;
        }

        let name = entry.file_name().to_string_lossy().to_string();

        if name.starts_with('.') {
            continue;
        }

        let path = entry.path();
        let Ok(kind) = entry.file_type() else { continue };

        if kind.is_dir() {
            if depth >= MAX_DEPTH || SKIP_DIRS.contains(&name.as_str()) {
                continue;
            }

            if walk(root, &path, depth + 1, out, dirs) {
                return true;
            }

            continue;
        }

        if !kind.is_file() || !SCAN_EXTS.contains(&effective_ext(&name).as_str()) {
            continue;
        }

        let Ok(meta) = entry.metadata() else { continue };
        let rel_path = path
            .strip_prefix(root)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");
        let rel_dir = rel_path
            .rsplit_once('/')
            .map(|(dir, _)| dir.to_string())
            .unwrap_or_default();

        out.push(ScannedFile {
            path: path.to_string_lossy().to_string(),
            rel_path,
            rel_dir,
            ext: name.rsplit_once('.').map(|(_, e)| e.to_ascii_lowercase()).unwrap_or_default(),
            name,
            size: meta.len(),
        });
    }

    false
}

/// Marks a directory readable for this session and records it in the recent list.
#[tauri::command]
fn authorize_root(app: tauri::AppHandle, allowed: State<Allowed>, path: String) -> Result<String, String> {
    let resolved = fs::canonicalize(&path).map_err(|error| format!("{path}：{error}"))?;

    if !resolved.is_dir() {
        return Err(format!("不是目錄：{path}"));
    }

    let text = resolved.to_string_lossy().to_string();

    allowed.0.lock().map_err(|_| "狀態鎖定失敗")?.insert(resolved);
    remember_root(&app, &text);

    Ok(text)
}

/// Async so the walk runs off the main thread: a synchronous command would block the event
/// loop for the whole 20 000-file scan and freeze the window.
#[tauri::command]
async fn scan_directory(allowed: State<'_, Allowed>, root: String) -> Result<ScanResult, String> {
    let path = resolve_allowed(&allowed, &root)?;

    tauri::async_runtime::spawn_blocking(move || {
        let mut files = Vec::new();
        let mut dirs = 0;
        let truncated = walk(&path, &path, 0, &mut files, &mut dirs);

        ScanResult { files, truncated, dir_count: dirs }
    })
    .await
    .map_err(|error| error.to_string())
}

/// Returns raw bytes over the IPC's binary channel; a JSON number array would be unusable
/// for a multi-megabyte atlas page.
#[tauri::command]
async fn read_file(allowed: State<'_, Allowed>, path: String) -> Result<tauri::ipc::Response, String> {
    let target = resolve_allowed(&allowed, &path)?;

    tauri::async_runtime::spawn_blocking(move || fs::read(&target))
        .await
        .map_err(|error| error.to_string())?
        .map(tauri::ipc::Response::new)
        .map_err(|error| format!("{path}：{error}"))
}

#[tauri::command]
fn recent_roots(app: tauri::AppHandle) -> Vec<String> {
    read_recent(&app)
}

#[tauri::command]
fn initial_root(initial: State<InitialRoot>) -> Option<String> {
    initial.0.lock().ok().and_then(|value| value.clone())
}

/// `Spine Previewer /path/to/assets` opens straight onto that folder.
fn resolve_cli_root(app: &tauri::AppHandle, allowed: &Allowed) -> Option<String> {
    for argument in std::env::args().skip(1).rev() {
        if argument.starts_with('-') {
            continue;
        }

        let Ok(resolved) = fs::canonicalize(&argument) else { continue };

        if !resolved.is_dir() {
            continue;
        }

        let text = resolved.to_string_lossy().to_string();

        allowed.0.lock().ok()?.insert(resolved);
        remember_root(app, &text);

        return Some(text);
    }

    None
}

fn build_menu(app: &tauri::AppHandle) -> tauri::Result<()> {
    let open = MenuItemBuilder::new("開啟目錄…").id("open").accelerator("CmdOrCtrl+O").build(app)?;
    let rescan = MenuItemBuilder::new("重新掃描").id("rescan").accelerator("CmdOrCtrl+R").build(app)?;
    let file = SubmenuBuilder::new(app, "檔案").items(&[&open, &rescan]).separator().close_window().build()?;
    let view = SubmenuBuilder::new(app, "檢視").fullscreen().build()?;
    let window = SubmenuBuilder::new(app, "視窗").minimize().build()?;
    let mut menu = MenuBuilder::new(app);

    #[cfg(target_os = "macos")]
    {
        let about = SubmenuBuilder::new(app, "Spine Previewer")
            .about(None)
            .separator()
            .hide()
            .hide_others()
            .separator()
            .quit()
            .build()?;

        menu = menu.item(&about);
    }

    app.set_menu(menu.items(&[&file, &view, &window]).build()?)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Allowed::default())
        .manage(InitialRoot(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            authorize_root,
            scan_directory,
            read_file,
            recent_roots,
            initial_root
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let handle = app.handle().clone();
            let allowed = app.state::<Allowed>();

            if let Some(root) = resolve_cli_root(&handle, &allowed) {
                *app.state::<InitialRoot>().0.lock().unwrap() = Some(root);
            }

            build_menu(&handle)?;

            Ok(())
        })
        .on_menu_event(|app, event| {
            let command = match event.id().as_ref() {
                "open" => "open",
                "rescan" => "rescan",
                _ => return,
            };

            let _ = app.emit("previewer:command", command);
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
