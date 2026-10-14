## [Version 0.6.0] - 2026-10-14

A clearer desktop experience for managing an RGB Lightning node, trading assets and using KaleidoMind. These notes cover the complete upgrade from 0.5.0, including the changes previously listed under 0.5.1.

### Security

- The local node's API now accepts connections only from this computer instead of the whole local network. Local wallets created with an earlier build keep their previous binding; recreate them to get it.
- Each release runs one exact node version. If a wallet uses a different node image, the app switches it to the pinned version on start.
- Nostr Wallet Connect keys are no longer stored in plaintext. The service key is kept in the system keychain (macOS Keychain, Windows Credential Manager, Secret Service on Linux), and app connection keys are only shown once, in the connection link.
- The Nostr Wallet Connect service can no longer start twice, so the same request cannot be paid twice.
- Apply the upstream GLib iterator safety fix to the Linux GTK dependency.
- Update XML parsers and event-listener to patched versions.
- Remove unused browser crypto polyfills and React Native dependencies from the desktop build.

### Upgrade compatibility

- **RGB Lightning Node 0.10.0 or later is required.** The bundled node is pinned to 0.10.0; remote nodes must also run a supported version.
- **Older local wallets need a separate migration.** Node 0.9.0 changed recovery-phrase storage without an automatic migration. Wallets and backups created with the node bundled in desktop 0.5.0 or earlier cannot be opened directly with the newer node. Updating the desktop does not migrate those wallets.
- Updating an existing 0.5.1 installation to 0.6.0 was verified on macOS Apple Silicon, preserving accounts, orders, settings and balances. This test does not establish compatibility for older node wallets.

### Wallet and node

- Slow node responses show a non-blocking notice instead of freezing navigation; connection retries show progress and their outcome. Local HTTP probes run asynchronously.
- Completed payments show Done without the previous Cancel and Send actions.
- Settings is available directly in the sidebar; Help and Support lives in the profile menu. Remove the support and notification buttons from the top bar.
- Docker node startup pulls the pinned node image when it is missing, preserving existing data volumes. A failed pull is reported instead of silently using a stale image.
- Swaps below the smallest Lightning payment an RGB channel accepts (3,000 sats) are blocked before a quote is requested, instead of expiring without executing.
- A channel order that the provider marks as failed after it already funded the channel now shows "Channel funded, waiting for the provider" and no longer offers to pay again.
- Creating colored UTXOs with too little BTC shows a clear message with a shortcut to receive BTC, and never sends an invalid size to the node.
- Peer addresses are checked for the `pubkey@host:port` format before connecting.
- Recheck Docker availability from local setup without restarting the app; returning to the window also refreshes availability. Docker checks time out instead of blocking indefinitely.
- Clearer typography, spacing, navigation, dashboard balances and channel liquidity displays.
- Redesigned receive and payment-confirmation screens, with larger QR codes, copyable addresses, pinned BTC/USDT choices and transaction explorer links.
- Incoming on-chain payments appear while awaiting confirmation; Lightning deposits show a completion state.
- More reliable reconnection and account switching, clearer locked/offline/unsupported-node errors, and safer handling of database failures.
- Indexer-only synchronization when no Bitcoin Core endpoint is configured. Bitcoin Core settings are optional; existing endpoints are retained.
- Node logs persist across restarts and can be exported for local Docker nodes, including those reached through a remote URL.
- Recovery phrases remain hidden until revealed, and backup verification requires viewing the phrase first.

### Trading, channels and app connections

- Unavailable maker quotes disable the trade action, including the missing-channel shortcut and keyboard submission.
- Correct BTC/satoshi and RGB display units in balances, channel orders, swap quotes and confirmation screens.
- Quote refresh no longer depends on window animation frames; Lightning settlement layers and complete fees are included in requests and reviews.
- Maker and LSP settings follow the selected account. Missing endpoints produce clear setup guidance instead of calls to an unrelated default service.
- Limit-order prices no longer default to the current market price; immediately executable orders show a warning.
- Nostr Wallet Connect is available under **App Connections**, with permissions, budgets, last-use details, pause controls and revoke confirmation. RGB invoice and payment requests include required node fields.

### KaleidoMind — beta

- Starting a new chat saves the previous conversation in a read-only local archive. Previously deleted conversations are not recovered.
- Preserve streamed Markdown when the final response contains the same text, while allowing corrected final answers to replace it.
- Stable **Mind core/provider 0.11.1** and **runtime assets 0.11.1**, downloaded on demand for macOS Apple Silicon, macOS Intel, Linux x64 and Windows x64.
- Local model recommendations based on device memory, a clearer chat composer, model controls and visible start/stop feedback.
- Optional Thinking with a bounded reasoning phase and a direct-answer fallback. Thinking can be slow or reach the timeout on busy or lower-powered devices; reduce its budget or turn it off for faster replies.
- Stop cancels active inference and tool work; clearing a chat resets its conversation state. Cancelled or failed turns are excluded from subsequent context.
- Correct tool arguments, wallet units and swap status. Node-health questions keep access to the full agent workflow.
- Switching accounts resets the agent's node context. Standalone Mind shows general chat actions and does not inherit wallet tools from the previous account.
- Desktop skills focus on RGB Lightning node management, channels, trading and portfolio reads. Phone pairing and remote model serving are unavailable in this release.
- **Mind remains beta.** Responses can be incorrect; review the amounts and details before confirming an action.

### Reliability and distribution

- Accessible dialogs, settings tabs, immediate language switching and synchronized translations across eight languages.
- A usable update dialog even with long release notes, with clearer stalled-download feedback and no silent fallback to mock answers.
- Updated security dependencies and removal of unused packages.
- Signed and notarized macOS installers with matching native app/node architectures; Windows and Linux installers are also available.

[Download 0.6.0](https://github.com/kaleidoswap/desktop-app/releases/tag/v0.6.0) · [Changes since 0.5.0](https://github.com/kaleidoswap/desktop-app/compare/v0.5.0...v0.6.0)

## [Version 0.5.0] - 2026-06-21

Introduced KaleidoMind as an experimental on-device assistant and refreshed the wallet, channel and trading interfaces.

### Highlights

- On-device chat with wallet and node tools, visible tool activity and reasoning, a Stop control, and confirmation screens for swaps and channel purchases.
- An agent workspace for scheduled tasks, with risk limits and a dry-run default.
- A shared design system, redesigned history filters, deposit/withdraw dialogs and channel-purchase reviews.
- Consolidated maker/LSP settings, support for all RGB asset schemas, and clearer Lightning deposit limits.
- Node password changes from Settings, a Docker regtest connection preset and Korean translations.
- Fixes for asset precision, chat swap quotes, node reconnection and failed channel-order history.

[Download 0.5.0](https://github.com/kaleidoswap/desktop-app/releases/tag/v0.5.0)

## [Version 0.4.0] - 2026-04-15

### 🚀 Features

- **Docker Node Backend**: Run the RGB Lightning Node via Docker directly from the app — automatic image pull, container lifecycle management, and health monitoring with no manual setup required
- **Node Reachability Monitoring**: Continuous background health checks with automatic reconnection and clear status indicators when the node becomes unreachable
- **Reverse Quote Support**: Accept quotes from the maker side, enabling two-way RFQ trading
- **BIP21 Deposit URIs**: Generate BIP21-compliant deposit URIs for easier on-chain Bitcoin deposits
- **Limit Orders**: Added limit order trading with Tauri-backed persistence, form validation, and scheduler integration
- **Dollar-Cost Averaging (DCA)**: Added automated BTC buying with scheduled and price-target execution modes using USDT Lightning balance
- **Redesigned Buy Channel Flow**: Reworked the channel purchase and order flow with richer payment states, improved summaries, wallet funding guidance, and order restart handling
- **Desktop Node Lifecycle Controls**: Added stronger local node startup, readiness, tray, background-running, and shutdown behavior for desktop usage
- **Local or Remote Node Setup**: Expanded setup and unlock flows for both managed local nodes and remote node connections
- **Port Conflict Resolution**: Automatically detect and resolve port conflicts when starting the local node
- **Expanded Internationalization**: Broadened multi-language coverage across trading, wallet history, setup, and channel management flows

### 🔧 Improvements

- **Backend Selection UX**: Always show backend selection (native/Docker/remote) during local node setup for clearer onboarding; Docker backend is prioritized when available
- **Trading Page Refactor**: Extracted market-maker and limit-orders into separate view components for better maintainability
- **Channel Order Payment Monitoring**: Improved channel order payment tracking, persistence, and duration selector
- **DCA and Limit Order Scheduler Gating**: Schedulers now only run when the node is unlocked, preventing errors on locked nodes
- **DCA Dashboard and Execution Reliability**: Improved order persistence, account-aware hydration, retry behavior, queueing, timeout handling, and DCA status visibility
- **Trading Experience Refresh**: Updated market-maker and swap surfaces with better liquidity visibility, improved asset selection, clearer connection states, and stronger error messaging
- **Wallet and Channel UX**: Refined dashboard, channel list, transaction history, deposit, withdrawal, backup, and support surfaces for better clarity and usability
- **Shared Liquidity Components**: Extracted reusable liquidity, quote, and order-summary UI primitives used across channel purchase and trading flows
- **Tooling and CI Checks**: Standardized frontend format, lint, type-check, and PR verification commands for more consistent local and CI validation
- **SDK Migration**: Migrated to kaleido-sdk v0.1.0
- **Code Formatting**: Reordered object properties and cleaned up code formatting across multiple components and hooks

### 🐛 Bug Fixes

- **Light Mode Disabled**: Disabled light mode to prevent UI inconsistencies; dark mode is now the only supported theme
- **Issues #95 and #96**: Resolved reported bugs related to wallet and UI behavior
- **Wallet Actions Visibility**: Fixed wallet actions not showing when only the native backend is available
- **Unlock Timeout Extended**: Increased unlock retry timeout from ~3 minutes to ~1 hour so slow-syncing nodes no longer hit false "maximum attempts reached" errors
- **Unlock Timeout Error Handling**: Fixed missing timeout error detection in the unlock retry loop that could cause premature failures
- **Node Readiness and Unlock Handling**: Fixed cases where node startup or unlock could appear stalled without surfacing useful progress or retry behavior
- **Tray and Window Closing Behavior**: Fixed desktop close flows so the app can hide to tray, keep the node running in the background, or shut down cleanly before exit
- **Update Detection**: Improved update checks to avoid surfacing non-newer releases as available updates
- **Channel and Trading State Refresh**: Reduced stale UI states around channel availability, payment progress, and trading readiness
- **CoinGecko Parsing**: Hardened CoinGecko price data parsing to handle unexpected responses
- **Duplicate State Fix**: Removed duplicate `bearer_token` property in nodeSettings initial state

### 🏗️ Infrastructure

- **Dependency Updates**: Refreshed frontend and Tauri-related dependencies and aligned project scripts with the current toolchain
- **Security Fixes**: Updated rustls-webpki (0.103.9 → 0.103.10) and tar (0.4.44 → 0.4.45) to patch known vulnerabilities
- **CI: macOS DMG Bundle**: Added DMG bundle target to macOS builds
- **CI: Linux Tray Support**: Added `libappindicator3-dev` dependency for Linux tray icon support
- **Test Coverage**: Added unit tests for channel order utilities
- **Code Cleanup**: Removed dead code and unused layout configuration across desktop app flows
- **Build and Release Readiness**: Updated documentation and project configuration to match the current Tauri 2 and pnpm-based workflow

## [Version 0.3.2] - 2025-11-10

### 🚀 Features

- **Witness RGB Asset Sending**: Added support for sending RGB assets to witness recipients with a new input field for specifying Bitcoin amount (in sats) required for witness UTXOs, with validation ensuring at least 512 sats
- **RGB Invoice Assignment**: Enhanced RGB invoice handling with improved assignment functionality in deposit and withdrawal flows
- **Windows Installer Enhancement**: Added WebView2 embedBootstrapper configuration to Tauri config, improving Windows installation experience by automatically installing required WebView2 components

### 🔧 Improvements

- **Withdrawal Form**: Enhanced error handling and validation for witness amount inputs, providing better user feedback during asset withdrawals
- **Deposit Flow**: Improved RGB invoice assignment handling in Step2 component with better validation and user guidance

## [Version 0.3.1] - 2025-11-03

### 🚀 Features

- **Mnemonic Viewer Modal**: Secure access to view your recovery phrase directly from the app with proper security warnings and confirmation
- **Windows Installer Enhancement**: Improved Windows installation experience with NSIS configuration for better integration with Windows OS

### 🐛 Bug Fixes

- **RGB Asset On-chain Payments**: Fixed missing amount parameter when sending RGB assets on-chain, ensuring proper transaction amounts
- **Withdrawal Form**: Fixed handling of null or undefined assignments in amount extraction, preventing crashes during withdrawals
- **Invoice Details**: Improved clarity and user guidance in RGB invoice details and withdrawal forms

### 🔧 Improvements

- **Layout & Settings UI**: Enhanced user experience with improved layout and settings components
- **Code Cleanup**: Removed unused assignment extraction logic for better code maintainability

## [Version 0.3.0] - 2025-10-20

### 🚀 Features

- **Direct Asset Purchase in Channels**: Buy assets directly in a channel even if you don't have a channel yet - the app will automatically set up the channel for you during the purchase process
- **Fee Estimation for Channel Setup**: View estimated setup, capacity, and duration fees in real-time, helping you plan your channel configurations better
- **Order Detail View**: Access detailed information about channel orders, including status and payment details, via the new Order Detail Card
- **Asset and Bitcoin Channel Selectors**: Easily manage your asset and Bitcoin channel configurations with new selector components
- **Enhanced Wallet Setup UI**: The application version is now displayed in the sidebar, and button styles are improved for better visual feedback
- **Mnemonic Display Options**: You can now skip the backup step with a warning, offering more flexibility in setting up your recovery phrase
- **Privacy Mode for RGB Invoices**: Toggle between enhanced privacy using blinded UTXOs and standard on-chain addresses for your deposits
- **Order Flow Restart**: Restart the order process easily with the new functionality, providing more control during order management
- **Asset Delivery Status and Retry**: View the delivery status of your assets, and retry delivery for pending orders directly from the Order Detail Card

### 🚀 Improvements

- **Mac Installation Fixed**: Seamless installation on macOS with Apple code signing - no more security warnings or installation issues!
- **Trading Flexibility**: Trade using on-chain balance even when no channels are available, and get prompted to create channels for specific assets
- **User Interface Enhancements**: Enjoy improved button styles, layout, and animations for a more engaging user experience
- **Trading and Asset Management**: Improved handling of trading pairs and peer connections, making it easier to trade assets you don't own yet
- **Deposit and Withdrawal Enhancements**: Calculate maximum deposit and withdrawal amounts based on channel capacities effortlessly
- **Channel Management**: Enhanced error handling and feedback for channel statuses, ensuring you're always informed about your trading capabilities
- **Buy Channel Modal Improvements**: New components and better organized sections for a smoother payment and order summary experience

### 🐛 Bug Fixes

- **Database Migration Crash Fix**: Fixed critical crash when upgrading from previous versions due to missing database columns. The app now automatically migrates the database schema when detecting an older version
- **Improved Error Messaging**: Enhanced conditions for displaying connection errors and managing error message timeouts, reducing confusion during rapid actions
- **Wallet Status Loading State**: Clearer feedback with a loading animation when checking wallet status, ensuring you know when the wallet is being unlocked

## [Version 0.2.0] - 2025-07-23

### 🚀 Features

- Enhance `IssueAssetModal` with amount calculation and preview using `useMemo` hooks for better user feedback (70f3cee0)
- Implement `CloseChannelModal` for channel closure confirmation with state management and logic updates (f68639a9)
- Enhance `create-new-channel` flow with improved error handling and UI updates, including alert designs and action buttons (440bd432)
- Introduce error handling and UI enhancements for UTXO management, including error constants and usability indicators (1617cf02)
- Refactor `DepositModal` components for improved UI and usability, including layout and styling enhancements (cd2e73c9)
- Update `create-new-channel` flow with navigation and UI enhancements (fb9b8271)
- Enhance `WebSocketService` with message queue and network handling improvements (a75c5451)
- Update GitHub Actions workflow and build process for improved version handling and consistency (85d1826d)
- Revamp channel creation and order process UI with enhanced user guidance and error handling (8a791df5)
- Enhance trading functionality with asset conflict validation and improved size handling (8f0ae4f5)
- Add build-time versioning information and display in UI (ca5df1e2)
- Enhance `UpdateModal` with timeout protection and improved UI elements (8bd6e595)
- Add address validation and connected peers functionality, allowing selection from existing connections (d97e05a8)
- Introduce `AssetSelectionField` for asset input handling with precision management (c922bfb8)
- Enhance WebSocketService and introduce new asset selection components for improved user interaction (2da08c47)
- Enhance order processing flow and error handling in order channel components with new `OrderProcessingDisplay` (1058bb8f)
- Implement quote clearing functionality in WebSocketService and UI with error handling improvements (b34d7aed)
- Enhance Windows build process with MSVC setup and verification for CI environments (40aaf690)
- Add donation option for RGB transfers in `WithdrawModal`, including transfer type display and amount adjustments (8d5a786f)
- Enhance database schema and functionality for Nostr accounts and channel orders, including migration logic (a15fab98)
- Implement terms and privacy policy components and routing for user agreements (d85a40f4)
- Enhance node management and port handling with checks and user feedback for node status (0abddf4b)
- Auto-generate BTC address on component mount in Step2 with loading state management (47c6507d)

### 🐛 Bug Fixes

- Update max sendable amount in step3 of channel buy to use max HTLC limit for clarity (adffe031)
- Fix error modal not closing in open channel scenarios (eccea6ff)
- Update Tauri prerequisites link in README for installation instructions (888f749c, f08f4276)
- Update intervalId type in market-maker component for type safety (1ce123f9)
- Prevent negative values in input fields and validation logic improvements (64b60651)
- Fix Windows manifest file on pipeline for proper CI integration (3853a14a)

### 🔧 Improvements

- Improve WebSocketService with retry logic and connection management for better performance (965dbed9)
- Refactor `UnlockingProgress` and `SetupLayout` components for improved layout and styling (1e1c446c)
- Enhance WithdrawModal with new components and improved functionality for balance display and invoice handling (e5cc2faa)
- Improve error handling and user experience in WithdrawModal with detailed messages and modal behavior changes (1d234ff9)
- Enhance UpdateChecker with version comparison and logging enhancements for clarity on update availability (5d747b4c)

### 🏗️ Infrastructure

- Update package dependencies and configuration for improved functionality and security (124691ce)
- Enhance GitHub Actions workflow with version tagging and release management improvements (1bdfec21)
- Improve WebSocket connection handling and trading setup with simplified state management (866fc070)

### 📚 Documentation

- Update README and build instructions to reflect changes in build processes and prerequisites (c1b909cc, 40aaf690)

### 🧹 Refactoring

- Remove `UnlockingProgress` component and refactor related components for better maintainability (51b15eb0)
- Clean up WebSocketService and enhance number formatting utilities (7427137e)
- Remove SwapForm and QuickAmountSection components to streamline trading interface (2245de2e)
- Simplify update handling by removing skipped version logic for clarity (11fefd05)
- Streamline artifact path handling and checksum calculation in build workflow (b4f79d48)
- Improve error handling and retry logic in wallet unlock process for better user experience (965dbed9)

This changelog provides a comprehensive overview of significant changes and improvements made to the application, focusing on enhancing user experience, improving performance, and maintaining code quality.
