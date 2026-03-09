use std::sync::{Arc, Mutex, RwLock};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};
use tauri::Emitter;
use tauri::WebviewWindow;

const POLL_INTERVAL_SECS: u64 = 60;
const COINGECKO_URL: &str =
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DcaOrderInfo {
    pub id: String,
    pub order_type: String, // "scheduled" | "price-target"
    pub status: String,     // "active" | "paused" | "completed" | "cancelled"
    pub amount_usdt: f64,
    // Scheduled
    pub interval_secs: Option<u64>,
    pub last_executed_at: Option<u64>,
    // Price-target
    pub trigger_price_usd: Option<f64>,
}

#[derive(Debug, Serialize, Clone)]
struct DcaTriggerPayload {
    order_id: String,
    current_price: f64,
}

#[derive(Debug, Deserialize)]
struct CoinGeckoResponse {
    bitcoin: CoinGeckoPrice,
}

#[derive(Debug, Deserialize)]
struct CoinGeckoPrice {
    usd: f64,
}

pub struct DcaScheduler {
    orders: Arc<RwLock<Vec<DcaOrderInfo>>>,
    window: Arc<Mutex<Option<WebviewWindow>>>,
    running: Arc<Mutex<bool>>,
}

impl DcaScheduler {
    pub fn new() -> Self {
        DcaScheduler {
            orders: Arc::new(RwLock::new(Vec::new())),
            running: Arc::new(Mutex::new(false)),
            window: Arc::new(Mutex::new(None)),
        }
    }

    pub fn set_window(&self, window: WebviewWindow) {
        *self.window.lock().unwrap() = Some(window);
    }

    pub fn set_orders(&self, orders: Vec<DcaOrderInfo>) {
        *self.orders.write().unwrap() = orders;
    }

    pub fn update_last_executed(&self, order_id: &str, timestamp: u64) {
        let mut orders = self.orders.write().unwrap();
        if let Some(order) = orders.iter_mut().find(|o| o.id == order_id) {
            order.last_executed_at = Some(timestamp);
        }
    }

    pub fn start(&self) {
        {
            let mut running = self.running.lock().unwrap();
            if *running {
                return;
            }
            *running = true;
        }

        let orders = Arc::clone(&self.orders);
        let window = Arc::clone(&self.window);
        let running = Arc::clone(&self.running);

        thread::spawn(move || {
            let http = reqwest::blocking::Client::builder()
                .timeout(Duration::from_secs(10))
                .build()
                .unwrap_or_else(|_| reqwest::blocking::Client::new());

            loop {
                {
                    let is_running = running.lock().unwrap();
                    if !*is_running {
                        break;
                    }
                }

                let current_price = fetch_btc_price(&http);

                if let Some(price) = current_price {
                    let now = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs();

                    let triggers: Vec<DcaTriggerPayload> = {
                        let orders_guard = orders.read().unwrap();
                        orders_guard
                            .iter()
                            .filter(|o| o.status == "active")
                            .filter_map(|o| check_trigger(o, price, now))
                            .collect()
                    };

                    if !triggers.is_empty() {
                        let window_guard = window.lock().unwrap();
                        if let Some(win) = window_guard.as_ref() {
                            for trigger in triggers {
                                let _ = win.emit("dca:trigger", trigger);
                            }
                        }
                    }
                }

                thread::sleep(Duration::from_secs(POLL_INTERVAL_SECS));
            }
        });
    }

    #[allow(dead_code)]
    pub fn stop(&self) {
        *self.running.lock().unwrap() = false;
    }
}

fn fetch_btc_price(http: &reqwest::blocking::Client) -> Option<f64> {
    let response = http.get(COINGECKO_URL).send().ok()?;
    let data: CoinGeckoResponse = response.json().ok()?;
    Some(data.bitcoin.usd)
}

fn check_trigger(order: &DcaOrderInfo, current_price: f64, now: u64) -> Option<DcaTriggerPayload> {
    match order.order_type.as_str() {
        "scheduled" => {
            let interval = order.interval_secs?;
            let last = order.last_executed_at.unwrap_or(0);
            if now >= last + interval {
                Some(DcaTriggerPayload {
                    current_price,
                    order_id: order.id.clone(),
                })
            } else {
                None
            }
        }
        "price-target" => {
            let trigger_price = order.trigger_price_usd?;
            if current_price <= trigger_price {
                Some(DcaTriggerPayload {
                    current_price,
                    order_id: order.id.clone(),
                })
            } else {
                None
            }
        }
        _ => None,
    }
}
