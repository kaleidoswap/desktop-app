use rusqlite::{Connection, OptionalExtension};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::{env, fs};

#[derive(Debug, Serialize, Clone)]
pub struct Account {
    pub id: i32,
    pub name: String,
    pub network: String,
    pub datapath: Option<String>,
    pub rpc_connection_url: String,
    pub node_url: String,
    pub indexer_url: String,
    pub proxy_endpoint: String,
    pub default_lsp_url: String,
    pub maker_urls: String,
    pub default_maker_url: String,
    pub daemon_listening_port: String,
    pub ldk_peer_listening_port: String,
    pub bearer_token: Option<String>,
    pub encrypted_mnemonic: Option<String>,
    pub mnemonic_salt: Option<String>,
    pub mnemonic_nonce: Option<String>,
    pub language: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct ChannelOrder {
    pub id: i32,
    pub account_id: i32,
    pub order_id: String,
    pub created_at: String,
    pub status: String,
    pub payload: String,
}

/// A Nostr Wallet Connect (NIP-47) app connection.
///
/// Each connected app gets its own randomly generated `client_secret` (the key
/// handed out inside the `nostr+walletconnect://` URI). The service authorizes
/// incoming requests by `client_pubkey` and enforces the per-connection
/// `methods` allowlist and optional spend `budget_msat`.
#[derive(Debug, Serialize, Clone)]
pub struct NwcConnection {
    pub id: i32,
    pub account_id: i32,
    pub name: String,
    /// x-only hex public key derived from `client_secret`; identifies the app.
    pub client_pubkey: String,
    /// hex secret key handed to the app via the connection URI.
    pub client_secret: String,
    /// JSON array of relay URLs this connection uses.
    pub relays_json: String,
    /// JSON array of permitted NIP-47 method names.
    pub methods_json: String,
    /// Optional spend budget in millisatoshis (None = unlimited).
    pub budget_msat: Option<i64>,
    /// Millisatoshis spent against the current budget window.
    pub spent_msat: i64,
    /// Optional unix timestamp at which `spent_msat` resets to 0.
    pub budget_renews_at: Option<i64>,
    pub enabled: bool,
    pub created_at: i64,
    pub last_used_at: Option<i64>,
}

// Check if a database file exists, and create one if it does not.
pub fn init() {
    // Create database file if it doesn't exist
    if !db_file_exists() {
        create_db_file();
    }

    // Create/verify tables regardless of whether the file existed
    let path = get_db_path();
    let conn = Connection::open(path).unwrap();

    conn.execute(
        "CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            network TEXT NOT NULL,
            datapath TEXT,
            rpc_connection_url TEXT NOT NULL,
            node_url TEXT NOT NULL,
            indexer_url TEXT NOT NULL,
            proxy_endpoint TEXT NOT NULL,
            default_lsp_url TEXT NOT NULL,
            maker_urls TEXT NOT NULL,
            default_maker_url TEXT NOT NULL,
            daemon_listening_port TEXT NOT NULL,
            ldk_peer_listening_port TEXT NOT NULL,
            bearer_token TEXT,
            terms_accepted INTEGER DEFAULT 0,
            encrypted_mnemonic TEXT,
            mnemonic_salt TEXT,
            mnemonic_nonce TEXT,
            language TEXT DEFAULT 'en'
        )",
        [],
    )
    .unwrap();

    // Add mnemonic encryption columns if they don't exist (migration)
    let _ = conn.execute(
        "ALTER TABLE Accounts ADD COLUMN encrypted_mnemonic TEXT",
        (),
    );
    let _ = conn.execute("ALTER TABLE Accounts ADD COLUMN mnemonic_salt TEXT", ());
    let _ = conn.execute("ALTER TABLE Accounts ADD COLUMN mnemonic_nonce TEXT", ());

    // Add language column if it doesn't exist (migration)
    let _ = conn.execute(
        "ALTER TABLE Accounts ADD COLUMN language TEXT DEFAULT 'en'",
        (),
    );
    // Add ChannelOrders table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS 'ChannelOrders' (
            'id' INTEGER PRIMARY KEY AUTOINCREMENT,
            'account_id' INTEGER NOT NULL,
            'order_id' TEXT NOT NULL,
            'created_at' TEXT NOT NULL,
            'status' TEXT NOT NULL,
            'payload' TEXT NOT NULL,
            FOREIGN KEY(account_id) REFERENCES Accounts(id) ON DELETE CASCADE
        );",
        (),
    )
    .unwrap();

    // Add account_id column to existing ChannelOrders table if it doesn't exist
    let _ = conn.execute(
        "ALTER TABLE ChannelOrders ADD COLUMN account_id INTEGER",
        (),
    );
    // Note: We ignore the error if the column already exists

    // Migrate existing orders without account_id to the first available account
    migrate_existing_orders(&conn);

    // Add DcaOrders table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS 'DcaOrders' (
            'id' INTEGER PRIMARY KEY AUTOINCREMENT,
            'account_id' INTEGER NOT NULL,
            'order_id' TEXT NOT NULL,
            'payload' TEXT NOT NULL,
            UNIQUE(account_id, order_id),
            FOREIGN KEY(account_id) REFERENCES Accounts(id) ON DELETE CASCADE
        );",
        (),
    )
    .unwrap();

    // Add LimitOrders table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS 'LimitOrders' (
            'id' INTEGER PRIMARY KEY AUTOINCREMENT,
            'account_id' INTEGER NOT NULL,
            'order_id' TEXT NOT NULL,
            'payload' TEXT NOT NULL,
            UNIQUE(account_id, order_id),
            FOREIGN KEY(account_id) REFERENCES Accounts(id) ON DELETE CASCADE
        );",
        (),
    )
    .unwrap();

    // Add AppSettings table for key-value config (e.g. node backend type)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS 'AppSettings' (
            'key' TEXT PRIMARY KEY NOT NULL,
            'value' TEXT NOT NULL
        );",
        (),
    )
    .unwrap();

    // Add NwcConnections table (Nostr Wallet Connect app connections)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS 'NwcConnections' (
            'id' INTEGER PRIMARY KEY AUTOINCREMENT,
            'account_id' INTEGER NOT NULL,
            'name' TEXT NOT NULL,
            'client_pubkey' TEXT NOT NULL,
            'client_secret' TEXT NOT NULL,
            'relays_json' TEXT NOT NULL,
            'methods_json' TEXT NOT NULL,
            'budget_msat' INTEGER,
            'spent_msat' INTEGER NOT NULL DEFAULT 0,
            'budget_renews_at' INTEGER,
            'enabled' INTEGER NOT NULL DEFAULT 1,
            'created_at' INTEGER NOT NULL,
            'last_used_at' INTEGER,
            UNIQUE(account_id, client_pubkey),
            FOREIGN KEY(account_id) REFERENCES Accounts(id) ON DELETE CASCADE
        );",
        (),
    )
    .unwrap();
}

// Create the database file.
fn create_db_file() {
    let db_path = get_db_path();
    let db_dir = Path::new(&db_path).parent().unwrap();

    // If the parent directory does not exist, create it.
    if !db_dir.exists() {
        fs::create_dir_all(db_dir).unwrap();
    }

    // Create the database file.
    fs::File::create(db_path).unwrap();
}

// Check whether the database file exists.
pub fn db_file_exists() -> bool {
    let db_path = get_db_path();
    Path::new(&db_path).exists()
}

// Get the path where the database file should be located.
pub fn get_db_path() -> String {
    let app_data_dir = if cfg!(debug_assertions) {
        // During development, use the manifest directory
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
    } else {
        // In production, use the local app data directory
        let local_app_data = if cfg!(target_os = "macos") {
            let home = env::var("HOME").expect("Failed to get HOME directory");
            PathBuf::from(home).join("Library/Application Support/com.kaleidoswap.dev")
        } else if cfg!(target_os = "windows") {
            let local_app_data =
                env::var("LOCALAPPDATA").expect("Failed to get LOCALAPPDATA directory");
            PathBuf::from(local_app_data).join("com.kaleidoswap.dev")
        } else {
            // Linux
            let home = env::var("HOME").expect("Failed to get HOME directory");
            PathBuf::from(home).join(".local/share/com.kaleidoswap.dev")
        };

        // Create the directory if it doesn't exist
        fs::create_dir_all(&local_app_data).expect("Failed to create app data directory");
        local_app_data
    };

    let db_path = app_data_dir.join("db/database.sqlite");

    // Ensure the parent directory exists
    if let Some(parent) = db_path.parent() {
        fs::create_dir_all(parent).expect("Failed to create database directory");
    }

    db_path.to_str().unwrap().to_string()
}

fn migrate_existing_orders(conn: &Connection) {
    // Check if there are any orders without account_id
    let count_result: Result<i64, _> = conn.query_row(
        "SELECT COUNT(*) FROM ChannelOrders WHERE account_id IS NULL",
        [],
        |row| row.get(0),
    );

    if let Ok(count) = count_result {
        if count > 0 {
            // Get the first account id
            let first_account_result: Result<i32, _> =
                conn.query_row("SELECT id FROM Accounts ORDER BY id LIMIT 1", [], |row| {
                    row.get(0)
                });

            if let Ok(first_account_id) = first_account_result {
                // Update all orders without account_id to use the first account
                let _ = conn.execute(
                    "UPDATE ChannelOrders SET account_id = ?1 WHERE account_id IS NULL",
                    [first_account_id],
                );
                println!(
                    "Migrated {} existing channel orders to account {}",
                    count, first_account_id
                );
            }
        }
    }
}

pub fn get_accounts() -> Result<Vec<Account>, rusqlite::Error> {
    let conn = Connection::open(get_db_path())?;
    let mut stmt = conn.prepare("SELECT id, name, network, datapath, rpc_connection_url, node_url, indexer_url, proxy_endpoint, default_lsp_url, maker_urls, default_maker_url, daemon_listening_port, ldk_peer_listening_port, bearer_token, encrypted_mnemonic, mnemonic_salt, mnemonic_nonce, language FROM Accounts")?;
    let accounts = stmt
        .query_map([], |row| {
            Ok(Account {
                id: row.get(0)?,
                name: row.get(1)?,
                network: row.get(2)?,
                datapath: row.get(3)?,
                rpc_connection_url: row.get(4)?,
                node_url: row.get(5)?,
                indexer_url: row.get(6)?,
                proxy_endpoint: row.get(7)?,
                default_lsp_url: row.get(8)?,
                maker_urls: row.get(9)?,
                default_maker_url: row.get(10)?,
                daemon_listening_port: row.get(11)?,
                ldk_peer_listening_port: row.get(12)?,
                bearer_token: row.get(13)?,
                encrypted_mnemonic: row.get(14).ok(),
                mnemonic_salt: row.get(15).ok(),
                mnemonic_nonce: row.get(16).ok(),
                language: row.get(17).ok(),
            })
        })?
        .map(|res| res.unwrap())
        .collect();

    Ok(accounts)
}

#[allow(clippy::too_many_arguments)]
pub fn insert_account(
    name: String,
    network: String,
    datapath: Option<String>,
    rpc_connection_url: String,
    node_url: String,
    indexer_url: String,
    proxy_endpoint: String,
    default_lsp_url: String,
    maker_urls: String,
    default_maker_url: String,
    daemon_listening_port: String,
    ldk_peer_listening_port: String,
    bearer_token: Option<String>,
    language: Option<String>,
) -> Result<usize, rusqlite::Error> {
    let conn = Connection::open(get_db_path())?;

    // Check if an account with the same name already exists
    let mut stmt = conn.prepare("SELECT COUNT(*) FROM Accounts WHERE name = ?")?;
    let count: i64 = stmt.query_row([&name], |row| row.get(0))?;

    if count > 0 {
        return Err(rusqlite::Error::SqliteFailure(
            rusqlite::ffi::Error::new(19), // SQLITE_CONSTRAINT
            Some("Account with this name already exists".to_string()),
        ));
    }

    conn.execute(
        "INSERT INTO Accounts (name, network, datapath, rpc_connection_url, node_url, indexer_url, proxy_endpoint, default_lsp_url, maker_urls, default_maker_url, daemon_listening_port, ldk_peer_listening_port, bearer_token, terms_accepted, language)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, 1, ?14)",
        rusqlite::params![name, network, datapath, rpc_connection_url, node_url, indexer_url, proxy_endpoint, default_lsp_url, maker_urls, default_maker_url, daemon_listening_port, ldk_peer_listening_port, bearer_token, language],
    )
}

#[allow(clippy::too_many_arguments)]
pub fn update_account(
    name: String,
    network: String,
    datapath: Option<String>,
    rpc_connection_url: String,
    node_url: String,
    indexer_url: String,
    proxy_endpoint: String,
    default_lsp_url: String,
    maker_urls: String,
    default_maker_url: String,
    daemon_listening_port: String,
    ldk_peer_listening_port: String,
    bearer_token: Option<String>,
    language: Option<String>,
) -> Result<usize, rusqlite::Error> {
    let conn = Connection::open(get_db_path())?;
    conn.execute(
        "UPDATE Accounts SET
            network = ?1,
            datapath = ?2,
            rpc_connection_url = ?3,
            node_url = ?4,
            indexer_url = ?5,
            proxy_endpoint = ?6,
            default_lsp_url = ?7,
            maker_urls = ?8,
            default_maker_url = ?9,
            daemon_listening_port = ?10,
            ldk_peer_listening_port = ?11,
            bearer_token = ?12,
            language = ?13
         WHERE name = ?14",
        rusqlite::params![
            network,
            datapath,
            rpc_connection_url,
            node_url,
            indexer_url,
            proxy_endpoint,
            default_lsp_url,
            maker_urls,
            default_maker_url,
            daemon_listening_port,
            ldk_peer_listening_port,
            bearer_token,
            language,
            name
        ],
    )
}

pub fn get_account_by_name(name: &str) -> Result<Option<Account>, rusqlite::Error> {
    let conn = Connection::open(get_db_path())?;
    let mut stmt = conn.prepare("SELECT id, name, network, datapath, rpc_connection_url, node_url, indexer_url, proxy_endpoint, default_lsp_url, maker_urls, default_maker_url, daemon_listening_port, ldk_peer_listening_port, bearer_token, encrypted_mnemonic, mnemonic_salt, mnemonic_nonce, language FROM Accounts WHERE name = ?")?;
    let account = stmt
        .query_row([name], |row| {
            Ok(Account {
                id: row.get(0)?,
                name: row.get(1)?,
                network: row.get(2)?,
                datapath: row.get(3)?,
                rpc_connection_url: row.get(4)?,
                node_url: row.get(5)?,
                indexer_url: row.get(6)?,
                proxy_endpoint: row.get(7)?,
                default_lsp_url: row.get(8)?,
                maker_urls: row.get(9)?,
                default_maker_url: row.get(10)?,
                daemon_listening_port: row.get(11)?,
                ldk_peer_listening_port: row.get(12)?,
                bearer_token: row.get(13)?,
                encrypted_mnemonic: row.get(14).ok(),
                mnemonic_salt: row.get(15).ok(),
                mnemonic_nonce: row.get(16).ok(),
                language: row.get(17).ok(),
            })
        })
        .optional()?;

    Ok(account)
}

pub fn delete_account(name: String) -> Result<usize, rusqlite::Error> {
    // First get the account to check its datapath
    let account = get_account_by_name(&name)?;

    let conn = Connection::open(get_db_path())?;
    let result = conn.execute("DELETE FROM Accounts WHERE name = ?1", [name])?;

    // If account exists and has a datapath, delete the directory
    if let Some(account) = account {
        if let Some(datapath) = account.datapath {
            if !datapath.is_empty() {
                let full_path = PathBuf::from("../bin").join(datapath);
                let full_path_str = full_path.to_string_lossy();

                println!("Attempting to delete account folder at: {}", full_path_str);
                match std::fs::remove_dir_all(&full_path) {
                    Ok(_) => println!("Successfully deleted account folder at: {}", full_path_str),
                    Err(e) => println!(
                        "Failed to delete account folder at {}: {}",
                        full_path_str, e
                    ),
                }
            }
        }
    }

    Ok(result)
}

pub fn check_account_exists(name: &str) -> Result<bool, rusqlite::Error> {
    let conn = Connection::open(get_db_path())?;
    let mut stmt = conn.prepare("SELECT COUNT(*) FROM Accounts WHERE name = ?")?;
    let count: i64 = stmt.query_row([name], |row| row.get(0))?;
    Ok(count > 0)
}

pub fn insert_channel_order(
    account_id: i32,
    order_id: String,
    status: String,
    payload: String,
    created_at: String,
) -> Result<usize, rusqlite::Error> {
    let conn = Connection::open(get_db_path())?;
    let updated = conn.execute(
        "UPDATE ChannelOrders SET created_at = ?3, status = ?4, payload = ?5 WHERE account_id = ?1 AND order_id = ?2",
        rusqlite::params![account_id, order_id, created_at, status, payload],
    )?;

    if updated > 0 {
        return Ok(updated);
    }

    conn.execute(
        "INSERT INTO ChannelOrders (account_id, order_id, created_at, status, payload) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![account_id, order_id, created_at, status, payload],
    )
}

pub fn get_channel_orders(account_id: Option<i32>) -> Result<Vec<ChannelOrder>, rusqlite::Error> {
    let conn = Connection::open(get_db_path())?;

    match account_id {
        Some(id) => {
            let mut stmt = conn.prepare("SELECT id, account_id, order_id, created_at, status, payload FROM ChannelOrders WHERE account_id = ?1 ORDER BY created_at DESC")?;
            let orders = stmt
                .query_map([id], |row| {
                    Ok(ChannelOrder {
                        id: row.get(0)?,
                        account_id: row.get(1)?,
                        order_id: row.get(2)?,
                        created_at: row.get(3)?,
                        status: row.get(4)?,
                        payload: row.get(5)?,
                    })
                })?
                .map(|res| res.unwrap())
                .collect();
            Ok(orders)
        }
        None => {
            let mut stmt = conn.prepare("SELECT id, account_id, order_id, created_at, status, payload FROM ChannelOrders ORDER BY created_at DESC")?;
            let orders = stmt
                .query_map([], |row| {
                    Ok(ChannelOrder {
                        id: row.get(0)?,
                        account_id: row.get(1)?,
                        order_id: row.get(2)?,
                        created_at: row.get(3)?,
                        status: row.get(4)?,
                        payload: row.get(5)?,
                    })
                })?
                .map(|res| res.unwrap())
                .collect();
            Ok(orders)
        }
    }
}

pub fn delete_channel_order(account_id: i32, order_id: String) -> Result<usize, rusqlite::Error> {
    let conn = Connection::open(get_db_path())?;
    let rows_affected = conn.execute(
        "DELETE FROM ChannelOrders WHERE account_id = ?1 AND order_id = ?2",
        rusqlite::params![account_id, order_id],
    )?;
    Ok(rows_affected)
}

pub fn store_encrypted_mnemonic(
    account_name: &str,
    encrypted_mnemonic: &str,
    salt: &str,
    nonce: &str,
) -> Result<usize, rusqlite::Error> {
    let conn = Connection::open(get_db_path())?;
    conn.execute(
        "UPDATE Accounts SET encrypted_mnemonic = ?1, mnemonic_salt = ?2, mnemonic_nonce = ?3 WHERE name = ?4",
        rusqlite::params![encrypted_mnemonic, salt, nonce, account_name],
    )
}

pub fn upsert_dca_order(
    account_id: i32,
    order_id: String,
    payload: String,
) -> Result<usize, rusqlite::Error> {
    let conn = Connection::open(get_db_path())?;
    conn.execute(
        "INSERT INTO DcaOrders (account_id, order_id, payload) VALUES (?1, ?2, ?3)
         ON CONFLICT(account_id, order_id) DO UPDATE SET payload = excluded.payload",
        rusqlite::params![account_id, order_id, payload],
    )
}

pub fn get_dca_orders(account_id: i32) -> Result<Vec<String>, rusqlite::Error> {
    let conn = Connection::open(get_db_path())?;
    let mut stmt =
        conn.prepare("SELECT payload FROM DcaOrders WHERE account_id = ?1 ORDER BY id ASC")?;
    let payloads = stmt
        .query_map([account_id], |row| row.get(0))?
        .map(|r| r.unwrap())
        .collect();
    Ok(payloads)
}

pub fn delete_dca_order(account_id: i32, order_id: String) -> Result<usize, rusqlite::Error> {
    let conn = Connection::open(get_db_path())?;
    conn.execute(
        "DELETE FROM DcaOrders WHERE account_id = ?1 AND order_id = ?2",
        rusqlite::params![account_id, order_id],
    )
}

pub fn upsert_limit_order(
    account_id: i32,
    order_id: String,
    payload: String,
) -> Result<usize, rusqlite::Error> {
    let conn = Connection::open(get_db_path())?;
    conn.execute(
        "INSERT INTO LimitOrders (account_id, order_id, payload) VALUES (?1, ?2, ?3)
         ON CONFLICT(account_id, order_id) DO UPDATE SET payload = excluded.payload",
        rusqlite::params![account_id, order_id, payload],
    )
}

pub fn get_limit_orders(account_id: i32) -> Result<Vec<String>, rusqlite::Error> {
    let conn = Connection::open(get_db_path())?;
    let mut stmt =
        conn.prepare("SELECT payload FROM LimitOrders WHERE account_id = ?1 ORDER BY id ASC")?;
    let payloads = stmt
        .query_map([account_id], |row| row.get(0))?
        .map(|r| r.unwrap())
        .collect();
    Ok(payloads)
}

pub fn delete_limit_order(account_id: i32, order_id: String) -> Result<usize, rusqlite::Error> {
    let conn = Connection::open(get_db_path())?;
    conn.execute(
        "DELETE FROM LimitOrders WHERE account_id = ?1 AND order_id = ?2",
        rusqlite::params![account_id, order_id],
    )
}

pub fn get_encrypted_mnemonic(
    account_name: &str,
) -> Result<Option<(String, String, String)>, rusqlite::Error> {
    let conn = Connection::open(get_db_path())?;
    let mut stmt = conn.prepare(
        "SELECT encrypted_mnemonic, mnemonic_salt, mnemonic_nonce FROM Accounts WHERE name = ?",
    )?;

    let result = stmt
        .query_row([account_name], |row| {
            let encrypted: Option<String> = row.get(0)?;
            let salt: Option<String> = row.get(1)?;
            let nonce: Option<String> = row.get(2)?;

            match (encrypted, salt, nonce) {
                (Some(e), Some(s), Some(n)) => Ok(Some((e, s, n))),
                _ => Ok(None),
            }
        })
        .optional()?;

    Ok(result.flatten())
}

// ---------------------------------------------------------------------------
// App Settings (key-value store)
// ---------------------------------------------------------------------------

#[allow(dead_code)]
pub fn get_app_setting(key: &str) -> Result<Option<String>, rusqlite::Error> {
    let conn = Connection::open(get_db_path())?;
    let mut stmt = conn.prepare("SELECT value FROM AppSettings WHERE key = ?")?;
    let result = stmt.query_row([key], |row| row.get(0)).optional()?;
    Ok(result)
}

#[allow(dead_code)]
pub fn set_app_setting(key: &str, value: &str) -> Result<usize, rusqlite::Error> {
    let conn = Connection::open(get_db_path())?;
    conn.execute(
        "INSERT INTO AppSettings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        rusqlite::params![key, value],
    )
}

// ---------------------------------------------------------------------------
// NWC connections (Nostr Wallet Connect)
// ---------------------------------------------------------------------------

const NWC_COLUMNS: &str = "id, account_id, name, client_pubkey, client_secret, relays_json, methods_json, budget_msat, spent_msat, budget_renews_at, enabled, created_at, last_used_at";

fn row_to_nwc_connection(row: &rusqlite::Row) -> Result<NwcConnection, rusqlite::Error> {
    Ok(NwcConnection {
        id: row.get(0)?,
        account_id: row.get(1)?,
        name: row.get(2)?,
        client_pubkey: row.get(3)?,
        client_secret: row.get(4)?,
        relays_json: row.get(5)?,
        methods_json: row.get(6)?,
        budget_msat: row.get(7)?,
        spent_msat: row.get(8)?,
        budget_renews_at: row.get(9)?,
        enabled: row.get::<_, i64>(10)? != 0,
        created_at: row.get(11)?,
        last_used_at: row.get(12)?,
    })
}

#[allow(clippy::too_many_arguments)]
pub fn insert_nwc_connection(
    account_id: i32,
    name: &str,
    client_pubkey: &str,
    client_secret: &str,
    relays_json: &str,
    methods_json: &str,
    budget_msat: Option<i64>,
    budget_renews_at: Option<i64>,
    created_at: i64,
) -> Result<i64, rusqlite::Error> {
    let conn = Connection::open(get_db_path())?;
    conn.execute(
        "INSERT INTO NwcConnections
            (account_id, name, client_pubkey, client_secret, relays_json, methods_json, budget_msat, spent_msat, budget_renews_at, enabled, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, ?8, 1, ?9)",
        rusqlite::params![
            account_id,
            name,
            client_pubkey,
            client_secret,
            relays_json,
            methods_json,
            budget_msat,
            budget_renews_at,
            created_at
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get_nwc_connections(account_id: i32) -> Result<Vec<NwcConnection>, rusqlite::Error> {
    let conn = Connection::open(get_db_path())?;
    let sql = format!(
        "SELECT {} FROM NwcConnections WHERE account_id = ?1 ORDER BY created_at DESC",
        NWC_COLUMNS
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt
        .query_map([account_id], row_to_nwc_connection)?
        .map(|r| r.unwrap())
        .collect();
    Ok(rows)
}

/// All enabled connections across every account, used to bootstrap the service.
#[allow(dead_code)]
pub fn get_all_enabled_nwc_connections() -> Result<Vec<NwcConnection>, rusqlite::Error> {
    let conn = Connection::open(get_db_path())?;
    let sql = format!(
        "SELECT {} FROM NwcConnections WHERE enabled = 1",
        NWC_COLUMNS
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt
        .query_map([], row_to_nwc_connection)?
        .map(|r| r.unwrap())
        .collect();
    Ok(rows)
}

pub fn get_enabled_nwc_connections_for_account(
    account_id: i32,
) -> Result<Vec<NwcConnection>, rusqlite::Error> {
    let conn = Connection::open(get_db_path())?;
    let sql = format!(
        "SELECT {} FROM NwcConnections WHERE account_id = ?1 AND enabled = 1",
        NWC_COLUMNS
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt
        .query_map([account_id], row_to_nwc_connection)?
        .map(|r| r.unwrap())
        .collect();
    Ok(rows)
}

pub fn set_nwc_connection_enabled(id: i32, enabled: bool) -> Result<usize, rusqlite::Error> {
    let conn = Connection::open(get_db_path())?;
    conn.execute(
        "UPDATE NwcConnections SET enabled = ?1 WHERE id = ?2",
        rusqlite::params![enabled as i64, id],
    )
}

pub fn delete_nwc_connection(account_id: i32, id: i32) -> Result<usize, rusqlite::Error> {
    let conn = Connection::open(get_db_path())?;
    conn.execute(
        "DELETE FROM NwcConnections WHERE id = ?1 AND account_id = ?2",
        rusqlite::params![id, account_id],
    )
}

/// Record spend against a connection's budget and bump `last_used_at`.
pub fn add_nwc_spend(
    client_pubkey: &str,
    amount_msat: i64,
    now: i64,
) -> Result<usize, rusqlite::Error> {
    let conn = Connection::open(get_db_path())?;
    conn.execute(
        "UPDATE NwcConnections SET spent_msat = spent_msat + ?1, last_used_at = ?2 WHERE client_pubkey = ?3",
        rusqlite::params![amount_msat, now, client_pubkey],
    )
}

/// Touch `last_used_at` without recording spend (non-payment requests).
pub fn touch_nwc_connection(client_pubkey: &str, now: i64) -> Result<usize, rusqlite::Error> {
    let conn = Connection::open(get_db_path())?;
    conn.execute(
        "UPDATE NwcConnections SET last_used_at = ?1 WHERE client_pubkey = ?2",
        rusqlite::params![now, client_pubkey],
    )
}

/// Reset spent budget windows that have elapsed.
pub fn reset_expired_nwc_budgets(now: i64) -> Result<usize, rusqlite::Error> {
    let conn = Connection::open(get_db_path())?;
    conn.execute(
        "UPDATE NwcConnections SET spent_msat = 0, budget_renews_at = NULL
         WHERE budget_renews_at IS NOT NULL AND budget_renews_at <= ?1",
        rusqlite::params![now],
    )
}

/// The NWC wallet-service secret key (hex) for an account. This is a random
/// Nostr identity independent of the wallet seed, generated once and reused so
/// connection URIs stay valid across restarts. Stored in AppSettings.
pub fn get_nwc_service_secret(account_id: i32) -> Result<Option<String>, rusqlite::Error> {
    get_app_setting(&format!("nwc_service_secret_{account_id}"))
}

pub fn set_nwc_service_secret(
    account_id: i32,
    secret_hex: &str,
) -> Result<usize, rusqlite::Error> {
    set_app_setting(&format!("nwc_service_secret_{account_id}"), secret_hex)
}
