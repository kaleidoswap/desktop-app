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