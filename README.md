# Kaleidoswap Desktop App

<img src="./docs/logo-kaleido.png" alt="Kaleidoswap Logo" style="width: 50px; height: 50px;">

## Overview

**Kaleidoswap** is an open-source desktop application for decentralized, trustless trading of digital assets over the Bitcoin Lightning Network using the **RGB protocol**. By integrating seamlessly with an [RGB Lightning Node](https://github.com/RGB-Tools/rgb-lightning-node), the app enables multi-asset trading without intermediaries—giving you sovereignty over your funds.

- **Alpha Software Caution**: This software is still in alpha. Swaps may fail or get stuck, and **mainnet usage is not recommended**.  
- **Documentation**: Visit [docs.kaleidoswap.com](https://docs.kaleidoswap.com) for comprehensive guides and additional details.

## Table of Contents

- [Kaleidoswap Desktop App](#kaleidoswap-desktop-app)
  - [Overview](#overview)
  - [Table of Contents](#table-of-contents)
  - [Screenshots](#screenshots)
  - [Features 🚀](#features-)
  - [Supported Networks](#supported-networks)
  - [Installation 🛠️](#installation-️)
    - [1. Download Binaries](#1-download-binaries)
    - [2. Building Locally](#2-building-locally)
      - [Common Prerequisites](#common-prerequisites)
      - [Windows-Specific Instructions](#windows-specific-instructions)
      - [Linux-Specific Instructions](#linux-specific-instructions)
      - [Building and Running](#building-and-running)
  - [Usage 💡](#usage-)
    - [Connecting to an RGB Lightning Node](#connecting-to-an-rgb-lightning-node)
    - [Trading and Swapping Assets](#trading-and-swapping-assets)
    - [Managing Channels](#managing-channels)
    - [Deposits and Withdrawals](#deposits-and-withdrawals)
    - [Backup](#backup)
  - [Security Considerations 🔒](#security-considerations-)
  - [Roadmap 🛣️](#roadmap-️)
    - [Coming Soon](#coming-soon)
  - [Contributing 🤝](#contributing-)
    - [How to Contribute](#how-to-contribute)
  - [Support 📞](#support-)
  - [License 📜](#license-)
  - [No Responsibility Disclaimer ⚠️](#no-responsibility-disclaimer-️)

## Screenshots

![App Screenshot](./docs/trade-screenshot.png)

## Features 🚀

- **Asset Trading and Swapping**: Connect to market makers over the Lightning Network to trade BTC and RGB assets.
- **Channel Management**: Open, close, and manage Lightning channels with optional RGB assets.
- **Deposits & Withdrawals**: Handle on-chain and LN transactions for both Bitcoin and RGB assets.
- **Channel Requests**: Request channels from Lightning Service Providers (LSPs) with configurable capacity and included assets.
- **Transaction History**: View deposits, withdrawals, and swap history.
- **Node Backup**: Secure node data backups directly from the settings.

## Supported Networks

- **Regtest**
- **Signet**
- **Testnet3**

> **Note**: These networks are recommended for testing and development. Avoid using real funds on mainnet until further notice.

## Installation 🛠️

You can install the app in two ways:

### 1. Download Binaries

1. Download the appropriate binary for your operating system from the [Releases](https://github.com/kaleidoswap/desktop-app/releases) page.
2. Download both the binary file and its corresponding `.sig` signature file.
3. Import our public GPG key:
   ```sh
      curl https://keybase.io/bitwalt/pgp_keys.asc | gpg --import
   ```
4. Verify the signature:
   ```sh
   # For Linux
   gpg --verify kaleido-swap_0.0.1_amd64.AppImage.sig kaleido-swap_0.0.1_amd64.AppImage

   # For macOS
   gpg --verify Kaleido-Swap_0.0.1_x64.dmg.sig Kaleido-Swap_0.0.1_x64.dmg

   # For Windows
   gpg --verify KaleidoSwap_0.0.1_x64-setup.exe.sig KaleidoSwap_0.0.1_x64-setup.exe
   ```
5. Verify the SHA256 checksum of the binary.
6. Run the app by executing the binary.

### 2. Building Locally

#### Common Prerequisites

- **Tauri 1.6.0**  
  Make sure you have installed all the [official Tauri prerequisites](https://tauri.app/start/prerequisites/) (Rust, Node.js, npm, pnpm).
- **Repository**  
  ```sh
  git clone https://github.com/kaleidoswap/desktop-app
  cd desktop-app
  ```

#### Windows-Specific Instructions

1. **Disable RLN Integration (Temporarily)**  
   The `rgb-lightning-node` integration is not yet fully supported on Windows. To get started with RLN on Windows, consider using it in a Docker container and connect remotely.
2. **Install vcpkg**  
   Use [vcpkg](https://github.com/microsoft/vcpkg) to install libraries like **openssl** and **sqlite3**.
3. **MSVC for C++ Linking**  
   Ensure **Microsoft Visual C++** is installed (usually via Visual Studio or Build Tools).

#### Linux-Specific Instructions

1. **Build Tools and Libraries**  
   Install `build-essential`, `pkg-config`, and SSL libraries on Debian/Ubuntu (or equivalents on other distros).
2. **GTK and WebKit Requirements**  
   Install **libsoup 2.4**, **javascriptcoregtk 4.0**, **webkit2gtk 4.0**, etc.
3. **Tauri Prerequisites**  
   Confirm correct installation of Rust, Node.js, npm, and pnpm.

#### Building and Running

1. **Install dependencies**:  
   ```sh
   npm install
   ```
2. **Build the Tauri app**:  
   ```sh
   # For current platform
   pnpm run tauri:build
   
   # For Windows specifically
   pnpm run tauri:build:windows
   
   # Using Make
   make build-app
   ```
3. **Run Kaleidoswap in development mode**:  
   ```sh
   pnpm run tauri:dev
   ```

## Usage 💡

### Connecting to an RGB Lightning Node

1. **Launch** Kaleidoswap.
2. **Configure the Node** in the **Settings** page:
   - Connect to a local or remote instance of [rgb-lightning-node](https://github.com/RGB-Tools/rgb-lightning-node).
   - Provide the correct host/port and any additional configuration details required.

### Trading and Swapping Assets

1. **Select or Add a Market Maker** on the **Settings** page.
   - KaleidoSwap currently provides two built-in makers: one for **regtest** and another for **signet** (mutinynet). Supported assets and pairs can be found at [KaleidoSwap RGB Registry](https://registry.kaleidoswap.com/).
2. **Check Supported Pairs**: Ensure you have at least one Lightning channel funded with the RGB asset you want to trade.
   - If you lack a channel, you can **buy one** from an LSP that supports your chosen RGB asset.
3. **Initiate the Swap**:
   - Go to the trading interface, pick your maker and select a supported trading pair.
   - Accept the RFQ price to execute the swap.

> **Important**: Since Kaleidoswap is in alpha, swaps may fail or get stuck. Check the [docs](https://docs.kaleidoswap.com) for troubleshooting, and feel free to [open an issue](#support-) if you encounter problems.

### Managing Channels

- **Open Channels**: Create channels with custom liquidity and optional RGB assets.
- **Close Channels**: Close channels within the app when no longer needed.
- **Request Channels**: Use the **Buy New Channel** page to request a channel from an LSP, specifying capacity and asset details.

### Deposits and Withdrawals

- Perform Bitcoin or RGB asset deposits/withdrawals either on-chain or via Lightning.
- Monitor your transaction history to verify operations.

### Backup

- Use the **Settings** page to back up your node data. Store your backup securely to prevent data loss.

## Security Considerations 🔒

- **Node Availability**: Keep your node online to ensure consistent Lightning functionality.
- **No API Authentication Yet**: Avoid exposing the node's API to untrusted networks.
- **Alpha Software**: This is alpha software; do not risk real funds or large amounts on mainnet.

## Roadmap 🛣️

### Coming Soon

- **🌍 Multi-language Support:** Broaden accessibility by adding support for multiple languages.

- **📊 Advanced Trading Dashboard:** Support for limit orders, stop-loss, and more advanced trading features.
- **🔗 P2P Trading via Nostr:** Enable decentralized peer-to-peer trading using the Nostr protocol.
- **🔐 TOR Support:** Integrate TOR for enhanced privacy and anonymity.
- **✨ Improved UI/UX Design:** Further refine the user interface for a better overall experience.
  
## Contributing 🤝

We welcome contributions of all forms—bug reports, feature requests, and pull requests!

### How to Contribute

1. Fork and clone the repository:
   ```sh
   git clone https://github.com/your-username/desktop-app.git
   cd desktop-app
   ```
2. Create a new branch:
   ```sh
   git checkout -b feature/YourFeatureName
   ```
3. Commit and push your changes, then open a pull request.

## Support 📞

- If you run into any issues or want to request a feature, please [open an issue](https://github.com/kaleidoswap/desktop-app/issues).  
- Additional documentation is available at [docs.kaleidoswap.com](https://docs.kaleidoswap.com).

## License 📜

Kaleidoswap is licensed under the [MIT License](LICENSE.md).

## No Responsibility Disclaimer ⚠️

**USE AT YOUR OWN RISK**: Kaleidoswap is provided "as is" without any warranties of any kind, either express or implied.

- The developers and contributors of Kaleidoswap assume **NO RESPONSIBILITY** for any losses, damages, or other liabilities that may arise from using this software.
- By using Kaleidoswap, you acknowledge that you are using experimental software and accept all associated risks.
- You are solely responsible for the security of your funds, private keys, and any transactions conducted through the application.
- We strongly recommend testing with minimal amounts on test networks before considering any use on mainnet.
- The software may contain bugs, errors, or security vulnerabilities that could result in the loss of funds.
---  

*Thanks for using Kaleidoswap! We're excited to see what you build, and we appreciate your feedback and contributions.*