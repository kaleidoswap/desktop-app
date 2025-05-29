# Guide for Intel (x86_64) Mac Users: Compiling a Compatible rgb-lightning-node

## 1. Introduction

This guide is for users of Intel-based (x86_64) Macs who are using KaleidoSwap. The default KaleidoSwap application might ship with an ARM64 (Apple Silicon) version of the `rgb-lightning-node` binary. This binary is incompatible with Intel Macs and will prevent the RGB node features from working.

These instructions will help you compile an x86_64 version of `rgb-lightning-node` from the source and replace the incompatible binary within your KaleidoSwap application.

## 2. Prerequisites

Before you begin, ensure you have the following installed on your Mac:

*   **Xcode Command Line Tools**: These provide essential development tools like `git` and compilers. If you don't have them, running `make check_dependencies` in the project (see compilation steps) should prompt you to install them. You can also manually install them by running `xcode-select --install` in your Terminal.
*   **Rust and Cargo**: The Rust programming language and its package manager, Cargo, are required. If you don't have them, the `make check_cargo_env` step (or simply `make`) in the project's Makefile will guide you through the installation via [rustup.rs](https://rustup.rs/).
*   **`x86_64-apple-darwin` Rust Target**: This specific Rust target is needed to compile for Intel Macs. You can install it by running the following command in your Terminal:
    ```bash
    rustup target add x86_64-apple-darwin
    ```
    The `make build-x86-macos` command will also check for this and provide an error if it's missing.

## 3. Compilation Steps

Follow these steps to compile the x86_64 `rgb-lightning-node` binary:

1.  **Clone the KaleidoSwap Desktop Repository**:
    Open your Terminal and run:
    ```bash
    git clone https://github.com/kaleidoswap/kaleidoswap-desktop.git
    ```
    *Note: If the `rgb-lightning-node` is part of a different repository that KaleidoSwap Desktop uses as a submodule (e.g., `rgb-lightning-node` itself), you'd clone that specific repository. However, the `make build-x86-macos` target is defined in the `kaleidoswap-desktop` Makefile, which handles the `rgb-lightning-node` submodule.*

2.  **Navigate to the Project Directory**:
    ```bash
    cd kaleidoswap-desktop
    ```

3.  **Run the Makefile Target to Build for x86 macOS**:
    This command will check dependencies, update the `rgb-lightning-node` submodule, and compile the binary for the x86_64 architecture.
    ```bash
    make build-x86-macos
    ```

4.  **Locate the Compiled Binary**:
    After a successful build, the binary will be located at:
    `bin/rgb-lightning-node-x86_64`
    (Relative to the `kaleidoswap-desktop` project directory).

## 4. Replacing the Binary in KaleidoSwap.app

Once you have compiled the `rgb-lightning-node-x86_64` binary, you need to replace the existing one inside your `KaleidoSwap.app` package.

1.  **Locate `KaleidoSwap.app`**: This is usually in your `/Applications` folder.
2.  **Show Package Contents**: Right-click on `KaleidoSwap.app` and select "Show Package Contents".
3.  **Navigate to the Binary Directory**: In the new Finder window that opens, navigate to:
    `Contents/Resources/_up_/bin/`
4.  **Back Up the Existing Binary (Important!)**:
    Inside this `bin` directory, you might see an existing `rgb-lightning-node` file. Before proceeding, **back this file up**. You can rename it to `rgb-lightning-node_ARM_backup` or copy it to a safe location.
5.  **Copy the Compiled Binary**:
    Copy the `rgb-lightning-node-x86_64` file from your `kaleidoswap-desktop/bin/` directory into the app bundle's `Contents/Resources/_up_/bin/` directory.
6.  **Rename the Copied Binary**:
    Inside the app bundle (`Contents/Resources/_up_/bin/`), rename the file you just copied from `rgb-lightning-node-x86_64` to `rgb-lightning-node`.
7.  **Ensure Executability**:
    Open your Terminal application and run the `chmod +x` command to make sure the new binary is executable. Adjust the path if your `KaleidoSwap.app` is not in the `/Applications` folder:
    ```bash
    chmod +x /Applications/KaleidoSwap.app/Contents/Resources/_up_/bin/rgb-lightning-node
    ```

After these steps, try launching KaleidoSwap. The application should now use your compiled x86_64 `rgb-lightning-node`.

## 5. Troubleshooting/Notes

*   **Application Updates**: If you update the KaleidoSwap application (e.g., by downloading a new version), it will likely overwrite your custom `rgb-lightning-node` binary. You will need to repeat the steps in Section 4 ("Replacing the Binary in KaleidoSwap.app") after each update.
*   **Node Startup Issues**: If the RGB node still fails to start, the enhanced error reporting (recently added to the node management code) should provide more specific error messages within the KaleidoSwap application or its logs.
*   **Checking Logs**: You can find detailed logs from the `rgb-lightning-node` which might help diagnose issues. On macOS, these logs are typically stored at:
    `~/Library/Logs/com.kaleidoswap.dev/rgb-lightning-node.log`
    You can open this file with Console.app or any text editor to view the logs.

By following this guide, Intel Mac users should be able to run the `rgb-lightning-node` and utilize its features within KaleidoSwap.
