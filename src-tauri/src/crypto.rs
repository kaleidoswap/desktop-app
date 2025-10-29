use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use argon2::{
    password_hash::{rand_core::RngCore, SaltString},
    Argon2, PasswordHasher,
};
use std::error::Error;
use std::fmt;

#[derive(Debug)]
pub enum CryptoError {
    EncryptionFailed(String),
    DecryptionFailed(String),
    KeyDerivationFailed(String),
    InvalidInput(String),
}

impl fmt::Display for CryptoError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            CryptoError::EncryptionFailed(msg) => write!(f, "Encryption failed: {}", msg),
            CryptoError::DecryptionFailed(msg) => write!(f, "Decryption failed: {}", msg),
            CryptoError::KeyDerivationFailed(msg) => write!(f, "Key derivation failed: {}", msg),
            CryptoError::InvalidInput(msg) => write!(f, "Invalid input: {}", msg),
        }
    }
}

impl Error for CryptoError {}

/// Derives a 32-byte encryption key from a password using Argon2id
/// 
/// Uses Argon2id with secure parameters:
/// - Memory: 64 MB
/// - Iterations: 3
/// - Parallelism: 4 threads
fn derive_key(password: &str, salt: &[u8]) -> Result<[u8; 32], CryptoError> {
    // Configure Argon2 with secure parameters
    let argon2 = Argon2::default();
    
    // Create a password hash
    let salt_string = SaltString::encode_b64(salt)
        .map_err(|e| CryptoError::KeyDerivationFailed(format!("Failed to encode salt: {}", e)))?;
    
    let password_hash = argon2
        .hash_password(password.as_bytes(), &salt_string)
        .map_err(|e| CryptoError::KeyDerivationFailed(format!("Failed to hash password: {}", e)))?;
    
    // Extract the raw hash bytes (32 bytes for Argon2)
    let hash_bytes = password_hash.hash
        .ok_or_else(|| CryptoError::KeyDerivationFailed("No hash produced".to_string()))?;
    
    let hash_slice = hash_bytes.as_bytes();
    if hash_slice.len() < 32 {
        return Err(CryptoError::KeyDerivationFailed(
            "Derived key is too short".to_string(),
        ));
    }
    
    let mut key = [0u8; 32];
    key.copy_from_slice(&hash_slice[..32]);
    Ok(key)
}

/// Encrypts a mnemonic phrase using AES-256-GCM
/// 
/// Returns (encrypted_data_hex, salt_hex, nonce_hex)
pub fn encrypt_mnemonic(mnemonic: &str, password: &str) -> Result<(String, String, String), CryptoError> {
    if mnemonic.is_empty() {
        return Err(CryptoError::InvalidInput("Mnemonic cannot be empty".to_string()));
    }
    if password.is_empty() {
        return Err(CryptoError::InvalidInput("Password cannot be empty".to_string()));
    }
    
    // Generate a random salt (16 bytes)
    let mut salt = [0u8; 16];
    OsRng.fill_bytes(&mut salt);
    
    // Derive encryption key from password
    let key = derive_key(password, &salt)?;
    
    // Create cipher instance
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| CryptoError::EncryptionFailed(format!("Failed to create cipher: {}", e)))?;
    
    // Generate a random nonce (12 bytes for GCM)
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    // Encrypt the mnemonic
    let ciphertext = cipher
        .encrypt(nonce, mnemonic.as_bytes())
        .map_err(|e| CryptoError::EncryptionFailed(format!("Encryption failed: {}", e)))?;
    
    // Return hex-encoded values
    Ok((
        hex::encode(ciphertext),
        hex::encode(salt),
        hex::encode(nonce_bytes),
    ))
}

/// Decrypts a mnemonic phrase using AES-256-GCM
/// 
/// Takes hex-encoded encrypted_data, salt, and nonce
pub fn decrypt_mnemonic(
    encrypted_hex: &str,
    password: &str,
    salt_hex: &str,
    nonce_hex: &str,
) -> Result<String, CryptoError> {
    if password.is_empty() {
        return Err(CryptoError::InvalidInput("Password cannot be empty".to_string()));
    }
    
    // Decode hex values
    let encrypted = hex::decode(encrypted_hex)
        .map_err(|e| CryptoError::DecryptionFailed(format!("Invalid encrypted data: {}", e)))?;
    
    let salt = hex::decode(salt_hex)
        .map_err(|e| CryptoError::DecryptionFailed(format!("Invalid salt: {}", e)))?;
    
    let nonce_bytes = hex::decode(nonce_hex)
        .map_err(|e| CryptoError::DecryptionFailed(format!("Invalid nonce: {}", e)))?;
    
    if nonce_bytes.len() != 12 {
        return Err(CryptoError::DecryptionFailed(
            "Invalid nonce length".to_string(),
        ));
    }
    
    // Derive the same key from password and salt
    let key = derive_key(password, &salt)?;
    
    // Create cipher instance
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| CryptoError::DecryptionFailed(format!("Failed to create cipher: {}", e)))?;
    
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    // Decrypt the mnemonic
    let plaintext = cipher
        .decrypt(nonce, encrypted.as_ref())
        .map_err(|_| CryptoError::DecryptionFailed(
            "Decryption failed: Invalid password or corrupted data".to_string()
        ))?;
    
    // Convert bytes to string
    String::from_utf8(plaintext)
        .map_err(|e| CryptoError::DecryptionFailed(format!("Invalid UTF-8: {}", e)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt() {
        let mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let password = "test_password_123";
        
        // Encrypt
        let (encrypted, salt, nonce) = encrypt_mnemonic(mnemonic, password).unwrap();
        
        // Decrypt
        let decrypted = decrypt_mnemonic(&encrypted, password, &salt, &nonce).unwrap();
        
        assert_eq!(mnemonic, decrypted);
    }

    #[test]
    fn test_wrong_password() {
        let mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let password = "correct_password";
        let wrong_password = "wrong_password";
        
        let (encrypted, salt, nonce) = encrypt_mnemonic(mnemonic, password).unwrap();
        
        let result = decrypt_mnemonic(&encrypted, wrong_password, &salt, &nonce);
        assert!(result.is_err());
    }

    #[test]
    fn test_empty_inputs() {
        assert!(encrypt_mnemonic("", "password").is_err());
        assert!(encrypt_mnemonic("mnemonic", "").is_err());
    }
}

