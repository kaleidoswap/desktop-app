use dotenv::dotenv;
use serde_json::Value;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, ExitStatus};
use std::thread;
use std::time::Duration;

// --------------------------------------------------
// Main entrypoint of the build script
// --------------------------------------------------
fn main() {
    dotenv().ok();

    // Read the ENV that decides whether to build/run rgb-lightning-node
    // On Windows, rgb-lightning-node is not supported, so skip building it
    let build_rgb_lightning_node = if cfg!(target_os = "windows") {
        false
    } else {
        env::var("BUILD_AND_RUN_RGB_LIGHTNING_NODE")
            .unwrap_or_else(|_| "true".to_string())
            == "true"
    };

    // Path to the current Cargo.toml directory
    let manifest_dir = env!("CARGO_MANIFEST_DIR");

    // Load the Tauri configuration template
    let template_path = PathBuf::from(manifest_dir).join("tauri.conf.json");
    let mut config = TauriConfig::load(&template_path);

    // If we need to build rgb-lightning-node
    if build_rgb_lightning_node {
        let build_manager = BuildManager::new();

        // Determine the project paths
        let project_root = build_manager.project_builder.find_project_root();
        let bin_dir = project_root.join("bin");
        let executable_path = if cfg!(target_os = "windows") {
            bin_dir.join("rgb-lightning-node.exe")
        } else {
            bin_dir.join("rgb-lightning-node")
        };

        // Monitor the sources of rgb-lightning-node
        let src_dir = project_root.join("src-tauri").join("rgb-lightning-node");
        visit_dirs(&src_dir, &|path: &Path| {
            if path.is_file() && path.extension().unwrap_or_default() != "toml" {
                println!("cargo:rerun-if-changed={}", path.display());
            }
        });

        // If the executable does not already exist, build the project
        if !executable_path.exists() {
            build_manager.build_rgb_lightning_node();
        }

        // Add the resource (executable) dynamically to the config
        let resource_name = if cfg!(target_os = "windows") {
            "../bin/rgb-lightning-node.exe"
        } else {
            "../bin/rgb-lightning-node"
        };
        if !cfg!(target_os = "windows") {
            config.add_resource(resource_name);
        }
    } else {
        //  In case we do NOT want to build/run the executable, we remove it from the config
        let resource_name = if cfg!(target_os = "windows") {
            "../bin/rgb-lightning-node.exe"
        } else {
            "../bin/rgb-lightning-node"
        };
        config.remove_resource(resource_name);
        
        // On Windows, also remove the Unix version to be safe
        if cfg!(target_os = "windows") {
            config.remove_resource("../bin/rgb-lightning-node");
        }
    }

    // Use the TAURI_CONFIG environment variable
    let final_config_str = config.to_pretty_json();
    env::set_var("TAURI_CONFIG", &final_config_str);

    // launch the Tauri build
    tauri_build::build();
}

// --------------------------------------------------
// Recursive function to monitor rgb-lightning-node files
// --------------------------------------------------
fn visit_dirs(dir: &Path, cb: &dyn Fn(&Path)) {
    if dir.is_dir() {
        for entry in fs::read_dir(dir).expect("read_dir failed") {
            let entry = entry.expect("read_dir entry failed");
            let path = entry.path();
            if path.is_dir() {
                visit_dirs(&path, cb);
            } else {
                cb(&path);
            }
        }
    }
}

// --------------------------------------------------
// Tauri configuration management
// --------------------------------------------------
struct TauriConfig {
    config: Value,
}

impl TauriConfig {
    // Load the template file (tauri.conf.template.json)
    fn load(path: &Path) -> Self {
        let config_str = fs::read_to_string(path).expect("Failed to read tauri.conf.template.json");
        let config: Value =
            serde_json::from_str(&config_str).expect("Failed to parse tauri.conf.template.json");
        TauriConfig { config }
    }

    // Adds a resource (path to a file) to the `tauri.bundle.resources` array
    fn add_resource(&mut self, resource: &str) {
        if let Some(resources) = self.config["bundle"]["resources"].as_array_mut() {
            if !resources.contains(&Value::String(resource.to_string())) {
                resources.push(resource.into());
            }
        }
    }

    // Removes a resource (path) from the `tauri.bundle.resources` array
    fn remove_resource(&mut self, resource: &str) {
        if let Some(resources) = self.config["bundle"]["resources"].as_array_mut() {
            resources.retain(|r| r != resource);
        }
    }

    // Returns the entire config as a JSON string "pretty"
    fn to_pretty_json(&self) -> String {
        serde_json::to_string_pretty(&self.config)
            .expect("Failed to serialize tauri.conf.json in memory")
    }
}

// --------------------------------------------------
// Management of the entire build process for rgb-lightning-node
// --------------------------------------------------
struct BuildManager {
    dependency_checker: DependencyChecker,
    project_builder: ProjectBuilder,
    cleaner: Cleaner,
}

impl BuildManager {
    fn new() -> Self {
        BuildManager {
            dependency_checker: DependencyChecker::new(),
            project_builder: ProjectBuilder::new(),
            cleaner: Cleaner::new(),
        }
    }

    fn build_rgb_lightning_node(&self) {
        let project_root = self.project_builder.find_project_root();
        let bin_dir = project_root.join("bin");
        let executable_path = if cfg!(target_os = "windows") {
            bin_dir.join("rgb-lightning-node.exe")
        } else {
            bin_dir.join("rgb-lightning-node")
        };

        // If the binary already exists, do not recompile it
        if executable_path.exists() {
            println!(
                "Executable already exists at: {}",
                executable_path.display()
            );
            return;
        }

        // Check the dependencies
        self.dependency_checker.check_all();

        // Clone the rgb-lightning-node repo
        self.project_builder.clone_repo();

        // Always build in release mode instead of checking the PROFILE env var
        // let is_release = env::var("PROFILE").unwrap_or_else(|_| "debug".to_string()) == "release";
        let is_release = true;  // Always build in release mode for better performance

        // Build the project
        self.project_builder.build(is_release);

        // Clean up after the build (remove the cloned folder)
        self.cleaner.clean_project();
    }
}

// --------------------------------------------------
// Checking dependencies (Cargo, curl, openssl, etc.)
// --------------------------------------------------
struct DependencyChecker;

impl DependencyChecker {
    fn new() -> Self {
        DependencyChecker
    }

    fn check_all(&self) {
        self.check_cargo();
        self.check_curl();
        self.check_openssl();
        self.check_compiler();
    }

    fn check_cargo(&self) {
        if !self.command_exists("cargo") {
            panic!("Cargo is not installed. Please install Cargo via Rustup.");
        }
    }

    fn check_curl(&self) {
        if !self.command_exists("curl") {
            panic!("'curl' is not installed. Please install 'curl' and try again.");
        }
    }

    fn check_openssl(&self) {
        let (openssl_include_dir, openssl_lib_dir) = if cfg!(target_os = "macos") {
            (
                "/opt/homebrew/opt/openssl@3/include".to_string(),
                "/opt/homebrew/opt/openssl@3/lib".to_string(),
            )
        } else if cfg!(target_os = "linux") {
            ("/usr/include/openssl".to_string(), "/usr/lib".to_string())
        } else if cfg!(target_os = "windows") {
            let include_dir = env::var("OPENSSL_INCLUDE_DIR")
                .unwrap_or_else(|_| "C:\\Program Files\\OpenSSL\\include".to_string());
            let lib_dir = env::var("OPENSSL_LIB_DIR")
                .unwrap_or_else(|_| "C:\\Program Files\\OpenSSL\\lib".to_string());
            (include_dir, lib_dir)
        } else {
            panic!("Unsupported operating system for OpenSSL checks");
        };

        let include_path = PathBuf::from(&openssl_include_dir);
        if !include_path.exists() {
            panic!(
                "OpenSSL include directory does not exist: {:?}",
                include_path
            );
        }
        let lib_path = PathBuf::from(&openssl_lib_dir);
        if !lib_path.exists() {
            panic!("OpenSSL lib directory does not exist: {:?}", lib_path);
        }

        // On Windows check vcpkg, elsewhere pkg-config
        if cfg!(target_os = "windows") {
            if !self.command_exists("vcpkg") {
                panic!("vcpkg is not installed. Please install vcpkg and OpenSSL via vcpkg.");
            }
        } else {
            if !self.command_exists("pkg-config") {
                panic!("pkg-config is not installed. (e.g. sudo apt-get install -y pkg-config)");
            }

            let openssl_check = Command::new("pkg-config")
                .args(&["--exists", "openssl"])
                .status()
                .expect("Failed to run pkg-config");
            if !openssl_check.success() {
                panic!("OpenSSL dev libraries not installed (sudo apt-get install -y libssl-dev).");
            }
        }
    }

    fn check_compiler(&self) {
        if cfg!(target_os = "macos") {
            if !self.command_exists("cc") {
                panic!("Compiler 'cc' not found. Install Xcode CLI tools: xcode-select --install.");
            }
        } else if cfg!(target_os = "linux") {
            if !self.command_exists("cc") {
                println!("Compiler 'cc' not found. Installing gcc...");
                let install_gcc = Command::new("sudo")
                    .args(&["apt-get", "update", "-y"])
                    .status()
                    .and_then(|_| {
                        Command::new("sudo")
                            .args(&["apt-get", "install", "-y", "build-essential"])
                            .status()
                    })
                    .expect("Failed to install gcc");
                if !install_gcc.success() {
                    panic!("Failed to install gcc. Please install it manually.");
                }
            }
        } else if cfg!(target_os = "windows") {
            // Try multiple compiler commands that might be available
            let compilers = ["cl", "cl.exe"];
            let mut compiler_found = false;
            
            for compiler in &compilers {
                if self.command_exists(compiler) {
                    compiler_found = true;
                    break;
                }
            }
            
            // Also check if we're in a CI environment where the compiler might be available
            // but not in the standard location
            if !compiler_found {
                // Check if we're in GitHub Actions or other CI environments
                if std::env::var("GITHUB_ACTIONS").is_ok() || std::env::var("CI").is_ok() {
                    println!("cargo:warning=MSVC compiler not found in PATH, but running in CI environment. Continuing build...");
                } else {
                    panic!(
                        "MSVC compiler not found. Please install Visual Studio with C++ build tools."
                    );
                }
            }
        } else {
            panic!("Unsupported OS for compiler checks.");
        }
    }

    fn command_exists(&self, command: &str) -> bool {
        if cfg!(target_os = "windows") {
            Command::new("where")
                .arg(command)
                .output()
                .map_or(false, |output| output.status.success())
        } else {
            Command::new("which")
                .arg(command)
                .output()
                .map_or(false, |output| output.status.success())
        }
    }
}

// --------------------------------------------------
// Clone the repo, build it and copy the executable
// --------------------------------------------------
struct ProjectBuilder;

impl ProjectBuilder {
    fn new() -> Self {
        ProjectBuilder
    }

    fn clone_repo(&self) {
        let project_root = self.find_project_root();
        let project_dir = project_root.join("rgb-lightning-node");

        // Remove the folder if it already exists
        if project_dir.exists() {
            println!("Directory rgb-lightning-node already exists. Removing...");
            if let Err(e) = self.retry_remove_dir_all(&project_dir) {
                panic!("Failed to remove existing directory: {:?}", e);
            }
        }

        // Clone
        let clone_status = Command::new("git")
            .args(&[
                "clone",
                "https://github.com/kaleidoswap/rgb-lightning-node",
                "--recurse-submodules",
                "--shallow-submodules",
            ])
            .current_dir(&project_root)
            .status()
            .expect("Failed to clone the repository");
        if !clone_status.success() {
            panic!("Failed to clone repository");
        }
    }

    fn retry_remove_dir_all(&self, path: &Path) -> std::io::Result<()> {
        for _ in 0..3 {
            match fs::remove_dir_all(path) {
                Ok(_) => return Ok(()),
                Err(_) => {
                    println!("Failed to remove directory. Retrying in 1 second...");
                    thread::sleep(Duration::from_secs(1));
                }
            }
        }
        fs::remove_dir_all(path)
    }

    fn build(&self, release: bool) {
        let project_root = self.find_project_root();
        let project_dir = project_root.join("rgb-lightning-node");
        let bin_dir = project_root.join("bin");
        let target_dir = project_dir.join("target");

        // Cleaning target folder
        if target_dir.exists() {
            println!("Cleaning target directory...");
            if let Err(e) = self.retry_remove_dir_all(&target_dir) {
                panic!("Failed to clean target directory: {:?}", e);
            }
        }
        fs::create_dir_all(&target_dir).expect("Failed to create target directory");

        // Launch cargo build
        let status = if release {
            self.run_cargo_build(&project_dir, true)
        } else {
            self.run_cargo_build(&project_dir, false)
        };
        if !status.success() {
            panic!("Failed to build rgb-lightning-node");
        }

        // Copy the executable from target/... to bin/
        self.copy_executable(&target_dir, &bin_dir, release);
    }

    fn run_cargo_build(&self, project_dir: &PathBuf, release: bool) -> ExitStatus {
        let mut cmd = Command::new("cargo");
        if release {
            cmd.args(&["build", "--release", "--manifest-path"]);
        } else {
            cmd.args(&["build", "--manifest-path"]);
        }
        cmd.arg(project_dir.join("Cargo.toml"))
            .status()
            .expect("Failed to run cargo build")
    }

    fn copy_executable(&self, target_dir: &PathBuf, bin_dir: &PathBuf, release: bool) {
        let source_path = if cfg!(target_os = "windows") {
            target_dir
                .join(if release { "release" } else { "debug" })
                .join("rgb-lightning-node.exe")
        } else {
            target_dir
                .join(if release { "release" } else { "debug" })
                .join("rgb-lightning-node")
        };

        if !source_path.exists() {
            panic!("Executable not found at: {}", source_path.display());
        }

        // Create bin directory if it doesn't exist
        if !bin_dir.exists() {
            fs::create_dir_all(bin_dir).expect("Failed to create bin directory");
        }

        let dest_path = if cfg!(target_os = "windows") {
            bin_dir.join("rgb-lightning-node.exe")
        } else {
            bin_dir.join("rgb-lightning-node")
        };

        fs::copy(&source_path, &dest_path).expect("Failed to copy executable");

        // Set executable permissions on Unix-like systems
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(&dest_path)
                .expect("Failed to get file metadata")
                .permissions();
            perms.set_mode(0o755); // rwxr-xr-x
            fs::set_permissions(&dest_path, perms).expect("Failed to set executable permissions");
        }

        println!("Copied executable to: {}", dest_path.display());
    }

    fn find_project_root(&self) -> PathBuf {
        let current_dir = env::current_dir().expect("Failed to get current directory");
        let project_root = current_dir
            .ancestors()
            .find(|dir| dir.join("src-tauri").exists())
            .expect("Failed to find project root");
        println!("Project root found at: {}", project_root.display());
        project_root.to_path_buf()
    }
}

// --------------------------------------------------
// Final cleanup (remove cloned rgb-lightning-node folder, etc.)
// --------------------------------------------------
struct Cleaner;

impl Cleaner {
    fn new() -> Self {
        Cleaner
    }

    fn clean_project(&self) {
        let project_root = ProjectBuilder::new().find_project_root();
        let project_dir = project_root.join("rgb-lightning-node");
        if let Err(e) = ProjectBuilder::new().retry_remove_dir_all(&project_dir) {
            panic!("Failed to clean project directory: {:?}", e);
        }
    }
}
