use serde::Serialize;
use std::path::PathBuf;
use std::process::Command;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

#[derive(Serialize)]
pub struct ConvertResult {
    pub ok: bool,
    pub layout_id: Option<String>,
    pub output: Option<String>,
    pub message: Option<String>,
    pub error: Option<String>,
    pub aufschlag: Option<f64>,
    pub preview: Option<serde_json::Value>,
}

fn dev_python_script() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../extractor/main.py")
}

fn parse_last_json_line(stdout: &str) -> Result<serde_json::Value, String> {
    let line = stdout
        .lines()
        .filter(|l| !l.trim().is_empty())
        .last()
        .ok_or_else(|| "Keine Ausgabe vom Extractor".to_string())?;
    serde_json::from_str(line).map_err(|e| format!("JSON parse error: {e} — line: {line}"))
}

fn map_json(mut parsed: serde_json::Value, output: &str) -> ConvertResult {
    ConvertResult {
        ok: parsed.get("ok").and_then(|v| v.as_bool()).unwrap_or(false),
        layout_id: parsed
            .get("layout_id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        output: parsed
            .get("output")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .or_else(|| Some(output.to_string())),
        message: parsed
            .get("message")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        error: parsed
            .get("error")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        aufschlag: parsed.get("aufschlag").and_then(|v| v.as_f64()),
        preview: parsed.get("preview").cloned(),
    }
}

async fn run_sidecar(
    app: &AppHandle,
    input_path: &str,
    output_path: &str,
    aufschlag: &str,
) -> Result<String, String> {
    let sidecar = app
        .shell()
        .sidecar("extractor-sidecar")
        .map_err(|e| e.to_string())?
        .args([
            "--input",
            input_path,
            "--output",
            output_path,
            "--aufschlag",
            aufschlag,
        ]);
    let output = sidecar.output().await.map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn run_python_dev(input_path: &str, output_path: &str, aufschlag: &str) -> Result<String, String> {
    let script = dev_python_script();
    if !script.exists() {
        return Err(format!("Extractor nicht gefunden: {}", script.display()));
    }
    let output = Command::new("python")
        .arg(&script)
        .arg("--input")
        .arg(input_path)
        .arg("--output")
        .arg(output_path)
        .arg("--aufschlag")
        .arg(aufschlag)
        .output()
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub async fn convert_pdf(
    app: AppHandle,
    input_path: String,
    aufschlag: f64,
) -> Result<ConvertResult, String> {
    let output_path = std::env::temp_dir().join(format!("diart_{}.xlsx", uuid::Uuid::new_v4()));
    let output_str = output_path.to_string_lossy().to_string();
    let aufschlag_str = aufschlag.to_string();

    let stdout = match run_sidecar(&app, &input_path, &output_str, &aufschlag_str).await {
        Ok(s) => s,
        Err(_) => run_python_dev(&input_path, &output_str, &aufschlag_str)?,
    };

    let parsed = parse_last_json_line(&stdout)?;
    Ok(map_json(parsed, &output_str))
}
