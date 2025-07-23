#!/usr/bin/env node

/**
 * Utility script to clear Kaleidoswap update cache and localStorage data
 * Run this if you're experiencing persistent update notifications after updating to the latest version
 * run with `node scripts/clear-update-cache.js`
*/

const fs = require('fs')
const path = require('path')
const os = require('os')

console.log('🧹 Kaleidoswap Update Cache Cleaner')
console.log('=====================================')

// Common paths where Tauri apps store data
const possiblePaths = [
  // macOS
  path.join(os.homedir(), 'Library', 'Application Support', 'com.kaleidoswap.dev'),
  path.join(os.homedir(), 'Library', 'WebKit', 'com.kaleidoswap.dev'),
  path.join(os.homedir(), 'Library', 'Saved Application State', 'com.kaleidoswap.dev.savedState'),
  
  // Linux
  path.join(os.homedir(), '.config', 'com.kaleidoswap.dev'),
  path.join(os.homedir(), '.local', 'share', 'com.kaleidoswap.dev'),
  
  // Windows
  path.join(os.homedir(), 'AppData', 'Roaming', 'com.kaleidoswap.dev'),
  path.join(os.homedir(), 'AppData', 'Local', 'com.kaleidoswap.dev'),
]

let cleanedSomething = false

console.log('🔍 Searching for Kaleidoswap app data directories...')

for (const dirPath of possiblePaths) {
  try {
    if (fs.existsSync(dirPath)) {
      console.log(`📁 Found: ${dirPath}`)
      
      // Look for specific files that might contain update state
      const filesToCheck = [
        'Local Storage',
        'localStorage',
        'WebData',
        'preferences.json',
        'config.json'
      ]
      
      for (const fileName of filesToCheck) {
        const filePath = path.join(dirPath, fileName)
        if (fs.existsSync(filePath)) {
          console.log(`  🗑️  Found cache file: ${fileName}`)
          try {
            // Instead of deleting, let's backup and clear
            const backupPath = `${filePath}.backup.${Date.now()}`
            fs.renameSync(filePath, backupPath)
            console.log(`  ✅ Backed up to: ${path.basename(backupPath)}`)
            cleanedSomething = true
          } catch (err) {
            console.log(`  ❌ Could not backup ${fileName}: ${err.message}`)
          }
        }
      }
    }
  } catch (err) {
    // Silently continue if we can't access a directory
  }
}

if (!cleanedSomething) {
  console.log('📝 No cache files found to clean.')
  console.log('   The update notification issue may be resolved by:')
  console.log('   1. Restarting the Kaleidoswap app')
  console.log('   2. Checking if you\'re actually on the latest version')
  console.log('   3. Manually clearing browser data from the app settings')
} else {
  console.log('')
  console.log('✅ Cache cleanup completed!')
  console.log('   Please restart Kaleidoswap to see if the update notifications are resolved.')
  console.log('   If issues persist, you can restore the backup files if needed.')
}

console.log('')
console.log('💡 Additional troubleshooting:')
console.log('   - Check that you\'re running version 0.1.1')
console.log('   - Try a manual update check from the app menu')
console.log('   - Restart your computer if the issue persists') 